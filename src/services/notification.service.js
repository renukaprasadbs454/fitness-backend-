const notificationRepository = require("../repositories/notification.repository");
const userRepository = require("../repositories/user.repository");
const { parsePagination, buildMeta } = require("../utils/pagination");
const { getMessaging } = require("../config/firebase");
const logger = require("../config/logger");

// Maps a NotificationType to the NotificationPreference column that gates it.
// SYSTEM notifications have no opt-out — they're account/security related.
const TYPE_TO_PREFERENCE_FIELD = {
  WORKOUT_REMINDER: "workoutReminders",
  WORKOUT_ASSIGNED: "workoutReminders",
  APPOINTMENT_REMINDER: "appointmentReminders",
  COACH_MESSAGE: "coachMessages",
  ANNOUNCEMENT: "announcements"
};

async function registerDevice(userId, { token, platform }) {
  return notificationRepository.upsertDeviceToken(userId, token, platform);
}

async function unregisterDevice(token) {
  await notificationRepository.removeDeviceToken(token);
}

async function list(userId, query) {
  const { page, limit, skip } = parsePagination(query);
  const unreadOnly = query.unreadOnly === true;
  const [items, total] = await Promise.all([
    notificationRepository.list(userId, { skip, take: limit, unreadOnly }),
    notificationRepository.count(userId, unreadOnly)
  ]);
  return { items, meta: buildMeta(page, limit, total) };
}

async function markRead(userId, id) {
  await notificationRepository.markRead(id, userId);
}

async function markAllRead(userId) {
  await notificationRepository.markAllRead(userId);
}

async function unreadCount(userId) {
  return notificationRepository.countUnread(userId);
}

async function getPreferences(userId) {
  const pref = await notificationRepository.getPreference(userId);
  return (
    pref || {
      userId,
      workoutReminders: true,
      appointmentReminders: true,
      coachMessages: true,
      announcements: true
    }
  );
}

async function updatePreferences(userId, data) {
  return notificationRepository.upsertPreference(userId, data);
}

/**
 * Sends a push notification to every device token registered for a user,
 * pruning tokens Firebase reports as unregistered/invalid along the way.
 * No-ops silently (with a log) if Firebase Admin isn't configured, so
 * local/dev environments never crash on a missing FCM credential.
 */
async function dispatchPush(userId, title, body, data = {}) {
  const messaging = getMessaging();
  if (!messaging) return;

  const tokens = await notificationRepository.listDeviceTokens(userId);
  if (!tokens.length) return;

  const message = {
    notification: { title, body },
    data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
    tokens: tokens.map((t) => t.token)
  };

  try {
    const response = await messaging.sendEachForMulticast(message);
    response.responses.forEach((r, idx) => {
      if (
        !r.success &&
        (r.error?.code === "messaging/registration-token-not-registered" ||
          r.error?.code === "messaging/invalid-registration-token")
      ) {
        notificationRepository.removeDeviceToken(tokens[idx].token).catch(() => {});
      }
    });
  } catch (err) {
    logger.error(`[notification] FCM dispatch failed for user ${userId}: ${err.message}`);
  }
}

/**
 * Creates the in-app notification row and, unless the user has opted
 * out for this notification type, also fires a push via FCM.
 */
async function notify(userId, type, title, body, { dispatchPush: shouldPush = true, data = {} } = {}) {
  const created = await notificationRepository.create({ userId, type, title, body });

  if (shouldPush) {
    const prefField = TYPE_TO_PREFERENCE_FIELD[type];
    if (prefField) {
      const pref = await getPreferences(userId);
      if (pref[prefField] === false) return created;
    }
    await dispatchPush(userId, title, body, { type, ...data });
  }

  return created;
}

/**
 * Sends the same notification to many users at once — used for admin
 * announcements. Runs dispatch in small batches to avoid hammering FCM.
 */
async function notifyMany(userIds, type, title, body, options = {}) {
  const batchSize = 25;
  for (let i = 0; i < userIds.length; i += batchSize) {
    const batch = userIds.slice(i, i + batchSize);
    await Promise.all(batch.map((id) => notify(id, type, title, body, options)));
  }
}

/**
 * Broadcasts an announcement to all active users (or a specific role).
 */
async function broadcastAnnouncement(title, body, { role } = {}) {
  const userIds = await userRepository.listActiveUserIdsByRole(role);
  await notifyMany(userIds, "ANNOUNCEMENT", title, body);
  return { recipientCount: userIds.length };
}

module.exports = {
  registerDevice,
  unregisterDevice,
  list,
  markRead,
  markAllRead,
  unreadCount,
  getPreferences,
  updatePreferences,
  notify,
  notifyMany,
  broadcastAnnouncement,
  dispatchPush
};
