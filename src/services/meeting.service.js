const { google } = require("googleapis");
const jwt = require("jsonwebtoken");
const env = require("../config/env");
const logger = require("../config/logger");
const ApiError = require("../utils/ApiError");
const tokenCrypto = require("../utils/googleTokenCrypto");
const platformIntegrationRepository = require("../repositories/platformIntegration.repository");

/**
 * One Google account for the whole platform.
 *
 * An admin connects it once (OAuth consent with the calendar.events scope).
 * After that, every session gets its own Calendar event on that account with
 * a Google Meet conference attached, which gives each session a unique Meet
 * link. The client and coach are added as guests, so they receive the invite
 * and can join without waiting to be admitted.
 */

const PROVIDER = "GOOGLE_MEET";
const SCOPES = ["openid", "email", "https://www.googleapis.com/auth/calendar.events"];
const STATE_PURPOSE = "google-meet-connect";
const TIME_ZONE = "Asia/Kolkata";

// The OAuth `state` travels through the browser, so it is signed with a key
// derived from (not equal to) the access-token secret: a leaked state can
// never be replayed as an API access token.
function stateSecret() {
  return `${env.jwt.accessSecret}:${STATE_PURPOSE}`;
}

function isConfigured() {
  return Boolean(env.google.webClientId && env.google.webClientSecret && env.google.tokenEncryptionKey);
}

function assertConfigured() {
  if (!isConfigured()) {
    throw ApiError.badRequest(
      "Google Meet isn't configured on the server. Set GOOGLE_WEB_CLIENT_ID, GOOGLE_WEB_CLIENT_SECRET and GOOGLE_TOKEN_ENCRYPTION_KEY."
    );
  }
}

function oauthClient(redirectUri) {
  return new google.auth.OAuth2({
    clientId: env.google.webClientId,
    clientSecret: env.google.webClientSecret,
    redirectUri
  });
}

async function getStatus() {
  const row = await platformIntegrationRepository.findByProvider(PROVIDER);
  return {
    configured: isConfigured(),
    connected: Boolean(row?.refreshToken),
    accountEmail: row?.accountEmail || null,
    connectedAt: row?.createdAt || null
  };
}

async function isConnected() {
  if (!isConfigured()) return false;
  const row = await platformIntegrationRepository.findByProvider(PROVIDER);
  return Boolean(row?.refreshToken);
}

function buildConnectUrl(adminId, redirectUri) {
  assertConfigured();
  const state = jwt.sign({ sub: adminId, purpose: STATE_PURPOSE, redirectUri }, stateSecret(), { expiresIn: "10m" });
  return oauthClient(redirectUri).generateAuthUrl({
    access_type: "offline",
    // Forces Google to issue a refresh token even if this account consented before.
    prompt: "consent",
    scope: SCOPES,
    state
  });
}

/** Handles Google's redirect back: verifies state, exchanges the code, stores the encrypted tokens. */
async function completeConnect({ code, state }) {
  assertConfigured();

  let payload;
  try {
    payload = jwt.verify(state || "", stateSecret());
  } catch {
    throw ApiError.badRequest("This connection link has expired. Start again from the admin portal.");
  }
  if (payload.purpose !== STATE_PURPOSE) throw ApiError.badRequest("Invalid connection request");

  const client = oauthClient(payload.redirectUri);
  let tokens;
  try {
    ({ tokens } = await client.getToken(code));
  } catch (err) {
    logger.warn(`[meet] Code exchange failed: ${err.message}`);
    throw ApiError.badRequest("Google rejected the authorization. Please try connecting again.");
  }

  if (!tokens.refresh_token) {
    throw ApiError.badRequest(
      "Google did not return a refresh token. Remove FitNerve from the Google account's third-party access, then connect again."
    );
  }

  let accountEmail = null;
  if (tokens.id_token) {
    try {
      const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: env.google.webClientId });
      accountEmail = ticket.getPayload()?.email || null;
    } catch (err) {
      logger.warn(`[meet] id_token verification failed: ${err.message}`);
    }
  }

  await platformIntegrationRepository.upsert(PROVIDER, {
    accountEmail,
    accessToken: tokenCrypto.encrypt(tokens.access_token),
    refreshToken: tokenCrypto.encrypt(tokens.refresh_token),
    expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    scope: tokens.scope || null,
    connectedById: payload.sub
  });

  return { accountEmail, adminId: payload.sub };
}

async function disconnect() {
  const row = await platformIntegrationRepository.findByProvider(PROVIDER);
  if (row?.refreshToken) {
    try {
      await new google.auth.OAuth2().revokeToken(tokenCrypto.decrypt(row.refreshToken));
    } catch (err) {
      logger.warn(`[meet] Token revoke failed (continuing with local disconnect): ${err.message}`);
    }
  }
  await platformIntegrationRepository.deleteByProvider(PROVIDER);
}

async function getCalendar() {
  if (!isConfigured()) return null;
  const row = await platformIntegrationRepository.findByProvider(PROVIDER);
  if (!row?.refreshToken) return null;

  const client = oauthClient();
  client.setCredentials({
    access_token: tokenCrypto.decrypt(row.accessToken),
    refresh_token: tokenCrypto.decrypt(row.refreshToken),
    expiry_date: row.expiresAt ? row.expiresAt.getTime() : undefined
  });
  client.on("tokens", (tokens) => {
    const data = {
      accessToken: tokenCrypto.encrypt(tokens.access_token),
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null
    };
    if (tokens.refresh_token) data.refreshToken = tokenCrypto.encrypt(tokens.refresh_token);
    platformIntegrationRepository
      .upsert(PROVIDER, data)
      .catch((err) => logger.warn(`[meet] Failed to persist refreshed token: ${err.message}`));
  });

  return google.calendar({ version: "v3", auth: client });
}

function isRevokedGrant(err) {
  return err?.response?.data?.error === "invalid_grant" || /invalid_grant/i.test(err?.message || "");
}

async function handleGoogleError(err, action) {
  if (isRevokedGrant(err)) {
    await platformIntegrationRepository.deleteByProvider(PROVIDER).catch(() => {});
    throw ApiError.badRequest("The platform Google account was disconnected. Reconnect it in the admin portal.");
  }
  logger.warn(`[meet] ${action} failed: ${err.message}`);
  throw new ApiError(502, `Google couldn't ${action}. Please try again in a moment.`);
}

function eventWindow(appointment) {
  const start = new Date(appointment.scheduledAt);
  const end = new Date(start.getTime() + (appointment.durationMinutes || 45) * 60000);
  return {
    start: { dateTime: start.toISOString(), timeZone: TIME_ZONE },
    end: { dateTime: end.toISOString(), timeZone: TIME_ZONE }
  };
}

function sendUpdates() {
  return env.google.meetSendInvites ? "all" : "none";
}

function meetLinkFrom(event) {
  return event.hangoutLink || event.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri || null;
}

/**
 * Creates the Calendar event + Meet conference for one session.
 * `appointment` must include user.email/fullName and coach.user.email/fullName.
 */
async function createMeetLink(appointment) {
  const calendar = await getCalendar();
  if (!calendar) {
    throw ApiError.badRequest("Automatic Google Meet links aren't set up yet. An admin can connect a Google account in the admin portal, or paste a link instead.");
  }

  const attendees = [appointment.user?.email, appointment.coach?.user?.email].filter(Boolean).map((email) => ({ email }));

  try {
    let { data: event } = await calendar.events.insert({
      calendarId: "primary",
      conferenceDataVersion: 1,
      sendUpdates: sendUpdates(),
      requestBody: {
        summary: `${appointment.title} · FitNerve`,
        description: `FitNerve 1:1 session between ${appointment.user?.fullName || "client"} and ${appointment.coach?.user?.fullName || "coach"}.`,
        ...eventWindow(appointment),
        attendees,
        guestsCanInviteOthers: false,
        conferenceData: {
          createRequest: {
            requestId: `fitnerve-${appointment.id}-${Date.now()}`,
            conferenceSolutionKey: { type: "hangoutsMeet" }
          }
        }
      }
    });

    // Conference creation is usually immediate but may come back "pending".
    for (let attempt = 0; attempt < 3 && !meetLinkFrom(event); attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      ({ data: event } = await calendar.events.get({ calendarId: "primary", eventId: event.id }));
    }

    const meetingLink = meetLinkFrom(event);
    if (!meetingLink) throw new Error("no Meet link on the created event");
    return { meetingLink, meetingEventId: event.id };
  } catch (err) {
    if (err instanceof ApiError) throw err;
    return handleGoogleError(err, "create the Meet link");
  }
}

/** Moves an existing generated meeting to the appointment's new time. Never throws. */
async function rescheduleMeeting(appointment) {
  if (!appointment.meetingEventId) return;
  try {
    const calendar = await getCalendar();
    if (!calendar) return;
    await calendar.events.patch({
      calendarId: "primary",
      eventId: appointment.meetingEventId,
      sendUpdates: sendUpdates(),
      requestBody: eventWindow(appointment)
    });
  } catch (err) {
    logger.warn(`[meet] Failed to move event ${appointment.meetingEventId}: ${err.message}`);
  }
}

/** Deletes a generated meeting's Calendar event (cancelled/removed sessions). Never throws. */
async function cancelMeeting(eventId) {
  if (!eventId) return;
  try {
    const calendar = await getCalendar();
    if (!calendar) return;
    await calendar.events.delete({ calendarId: "primary", eventId, sendUpdates: sendUpdates() });
  } catch (err) {
    const status = err?.code || err?.response?.status;
    if (status !== 404 && status !== 410) logger.warn(`[meet] Failed to delete event ${eventId}: ${err.message}`);
  }
}

module.exports = {
  getStatus,
  isConnected,
  isConfigured,
  buildConnectUrl,
  completeConnect,
  disconnect,
  createMeetLink,
  rescheduleMeeting,
  cancelMeeting
};
