const { google } = require("googleapis");
const logger = require("../config/logger");
const googleOAuthService = require("./googleOAuth.service");
const googleCalendarConnectionRepository = require("../repositories/googleCalendarConnection.repository");

// All-day events carry only a date (no dateTime), so duration in minutes isn't meaningful for them.
function durationMinutes(start, end) {
  if (!start?.dateTime || !end?.dateTime) return null;
  return Math.round((new Date(end.dateTime).getTime() - new Date(start.dateTime).getTime()) / 60000);
}

function normalizeEvent(event) {
  return {
    id: `google:${event.id}`,
    type: "GOOGLE_EVENT",
    title: event.summary || "Untitled event",
    coach: null,
    scheduledAt: event.start?.dateTime || event.start?.date || null,
    durationMinutes: durationMinutes(event.start, event.end),
    status: "SCHEDULED",
    source: "GOOGLE_CALENDAR"
  };
}

async function status(userId) {
  const connection = await googleCalendarConnectionRepository.findByUserId(userId);
  if (!connection) return { connected: false };

  return {
    connected: true,
    googleAccountId: connection.googleAccountId,
    scope: connection.scope,
    connectedAt: connection.createdAt
  };
}

/**
 * Best-effort: a disconnected user or a Google API hiccup must never break
 * the existing internal calendar, so this always resolves to an array.
 */
async function upcomingEvents(userId, maxResults = 20) {
  const client = await googleOAuthService.getAuthorizedClient(userId);
  if (!client) return [];

  try {
    const calendar = google.calendar({ version: "v3", auth: client });
    const result = await calendar.events.list({
      calendarId: "primary",
      timeMin: new Date().toISOString(),
      maxResults,
      singleEvents: true,
      orderBy: "startTime"
    });

    return (result.data.items || []).map(normalizeEvent);
  } catch (err) {
    if (err.code === 401 || err.response?.data?.error === "invalid_grant") {
      logger.warn(`[googleCalendar] Grant revoked for user ${userId}, marking disconnected`);
      await googleOAuthService.markDisconnected(userId);
    } else {
      logger.warn(`[googleCalendar] events.list failed for user ${userId}: ${err.message}`);
    }
    return [];
  }
}

module.exports = { status, upcomingEvents };
