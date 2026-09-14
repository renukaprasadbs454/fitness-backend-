const { google } = require("googleapis");
const env = require("../config/env");
const ApiError = require("../utils/ApiError");
const logger = require("../config/logger");
const tokenCrypto = require("../utils/googleTokenCrypto");
const googleCalendarConnectionRepository = require("../repositories/googleCalendarConnection.repository");

const CLIENT_IDS = {
  ANDROID: env.google.androidClientId,
  IOS: env.google.iosClientId,
  WEB: env.google.webClientId
};

function clientIdForPlatform(platform) {
  const clientId = CLIENT_IDS[platform];
  if (!clientId) {
    throw ApiError.badRequest(`Google OAuth is not configured for platform "${platform}"`);
  }
  return clientId;
}

function anyConfiguredClientId() {
  return env.google.androidClientId || env.google.iosClientId || env.google.webClientId;
}

/**
 * The authorization request itself happens entirely on the mobile app via
 * expo-auth-session (PKCE + state are generated/validated there). This
 * client is only used server-side to exchange the resulting code and later
 * to refresh tokens — so the redirectUri only matters for the code-exchange
 * call and can be omitted once tokens are already issued.
 */
function createOAuthClient(platform, redirectUri) {
  return new google.auth.OAuth2({
    clientId: clientIdForPlatform(platform),
    // Only a Web client is issued a secret; Android/iOS are public clients
    // secured by PKCE alone, per Google's installed-app OAuth model.
    clientSecret: platform === "WEB" ? env.google.webClientSecret || undefined : undefined,
    redirectUri
  });
}

/**
 * Exchanges an authorization code (+ PKCE verifier) for tokens and stores
 * them against the authenticated FitNerve user — never a client-supplied id.
 */
async function connect({ userId, platform, code, codeVerifier, redirectUri }) {
  const client = createOAuthClient(platform, redirectUri);

  let tokens;
  try {
    ({ tokens } = await client.getToken({ code, codeVerifier }));
  } catch (err) {
    logger.warn(`[googleOAuth] Code exchange failed: ${err.message}`);
    throw ApiError.badRequest("Unable to exchange Google authorization code");
  }

  if (!tokens.refresh_token) {
    // Google only issues a refresh_token on first consent for a given
    // client+scope pair. If the user revoked access outside the app, they
    // must re-consent (prompt=consent on the client) to get a new one.
    throw ApiError.badRequest(
      "Google did not return a refresh token. Revoke FitNerve's access in your Google Account settings and reconnect."
    );
  }

  let googleAccountId = null;
  if (tokens.id_token) {
    try {
      const ticket = await client.verifyIdToken({
        idToken: tokens.id_token,
        audience: clientIdForPlatform(platform)
      });
      googleAccountId = ticket.getPayload()?.sub || null;
    } catch (err) {
      logger.warn(`[googleOAuth] id_token verification failed: ${err.message}`);
    }
  }

  await googleCalendarConnectionRepository.upsertForUser(userId, {
    googleAccountId,
    accessToken: tokenCrypto.encrypt(tokens.access_token),
    refreshToken: tokenCrypto.encrypt(tokens.refresh_token),
    expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    scope: tokens.scope || null,
    tokenType: tokens.token_type || null
  });

  return { connected: true, googleAccountId };
}

/** Returns an OAuth2 client pre-loaded with the user's stored credentials, or null if not connected. */
async function getAuthorizedClient(userId) {
  const connection = await googleCalendarConnectionRepository.findByUserId(userId);
  if (!connection) return null;

  const client = new google.auth.OAuth2({
    clientId: anyConfiguredClientId(),
    clientSecret: env.google.webClientSecret || undefined
  });

  client.setCredentials({
    access_token: tokenCrypto.decrypt(connection.accessToken),
    refresh_token: tokenCrypto.decrypt(connection.refreshToken),
    expiry_date: connection.expiresAt ? connection.expiresAt.getTime() : undefined
  });

  // Fires when the library transparently refreshes an expired access token.
  client.on("tokens", (tokens) => {
    const data = {
      accessToken: tokenCrypto.encrypt(tokens.access_token),
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null
    };
    if (tokens.refresh_token) data.refreshToken = tokenCrypto.encrypt(tokens.refresh_token);

    googleCalendarConnectionRepository
      .upsertForUser(userId, data)
      .catch((err) => logger.warn(`[googleOAuth] Failed to persist refreshed token: ${err.message}`));
  });

  return client;
}

/** Marks a connection disconnected after Google reports the grant is no longer valid. */
async function markDisconnected(userId) {
  await googleCalendarConnectionRepository.deleteForUser(userId);
}

async function disconnect(userId) {
  const connection = await googleCalendarConnectionRepository.findByUserId(userId);

  if (connection?.refreshToken) {
    const client = new google.auth.OAuth2();
    try {
      await client.revokeToken(tokenCrypto.decrypt(connection.refreshToken));
    } catch (err) {
      logger.warn(`[googleOAuth] Token revoke failed (continuing with local disconnect): ${err.message}`);
    }
  }

  await googleCalendarConnectionRepository.deleteForUser(userId);
}

module.exports = { connect, getAuthorizedClient, disconnect, markDisconnected };
