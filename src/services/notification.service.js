const notificationRepository = require("../repositories/notification.repository");
const userRepository = require("../repositories/user.repository");
const { parsePagination, buildMeta } = require("../utils/pagination");
const { getMessaging } = require("../config/firebase");
const logger = require("../config/logger");
const prisma = require("../database/prismaClient");

// Maps a NotificationType to the NotificationPreference column that gates it.
// SYSTEM notifications have no opt-out — they're account/security related.
const TYPE_TO_PREFERENCE_FIELD = {
  WORKOUT_REMINDER: "workoutReminders",
  WORKOUT_ASSIGNED: "workoutReminders",
  APPOINTMENT_REMINDER: "appointmentReminders",
  APPOINTMENT_CHANGED: "appointmentReminders",
  COACH_MESSAGE: "coachMessages",
  ANNOUNCEMENT: "announcements"
};

async function registerDevice(userId, { token, platform }) {
  const latestConsent = await prisma.privacyConsentRecord.findFirst({
    where: { userId, purposeKey: "notifications" },
    orderBy: { createdAt: "desc" },
    select: { granted: true }
  });
  if (!latestConsent?.granted) {
    const ApiError = require("../utils/ApiError");
    throw ApiError.forbidden("Enable push notifications in Profile → Privacy & Security before registering this device.");
  }
  return notificationRepository.upsertDeviceToken(userId, token, platform);
}

async function unregisterDevice(token) {
  await notificationRepository.removeDeviceToken(token);
}

async function list(userId, query) {
  const { page, limit, skip } = parsePagination(query);
  const unreadOnly = query.unreadOnly === true;
  const type = query.type || undefined;
  const [items, total] = await Promise.all([
    notificationRepository.list(userId, { skip, take: limit, unreadOnly, type }),
    notificationRepository.count(userId, unreadOnly, type)
  ]);
  return { items, meta: buildMeta(page, limit, total) };
}

async function markRead(userId, id) {
  await notificationRepository.markRead(id, userId);
}

async function markAllRead(userId) {
  await notificationRepository.markAllRead(userId);
}

async function markTypeRead(userId, type) {
  await notificationRepository.markTypeRead(userId, type);
}

async function unreadCount(userId, type) {
  return notificationRepository.countUnread(userId, type);
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

function getChannelIdForType(type) {
  switch (type) {
    case "APPOINTMENT_REMINDER":
    case "APPOINTMENT_CHANGED":
      return "meetings";
    case "WORKOUT_REMINDER":
    case "WORKOUT_ASSIGNED":
      return "workouts";
    case "COACH_MESSAGE":
      return "messages";
    case "ANNOUNCEMENT":
      return "announcements";
    default:
      return "default";
  }
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

  const type = data.type || "SYSTEM";
  const channelId = getChannelIdForType(type);

  const message = {
    notification: { title, body },
    android: {
      priority: "high",
      notification: {
        title,
        body,
        channelId,
        sound: "default",
        defaultSound: true,
        defaultVibrateTimings: true,
        notificationCount: 1,
        clickAction: "OPEN_APP"
      }
    },
    data: Object.fromEntries(
      Object.entries({ ...data, type, title, body, channelId }).map(([k, v]) => [k, String(v ?? "")])
    ),
    tokens: tokens.map((t) => t.token)
  };

  try {
    const response = await messaging.sendEachForMulticast(message);
    if (response.failureCount > 0) {
      response.responses.forEach((r, idx) => {
        if (
          !r.success &&
          (r.error?.code === "messaging/registration-token-not-registered" ||
            r.error?.code === "messaging/invalid-registration-token")
        ) {
          notificationRepository.removeDeviceToken(tokens[idx].token).catch(() => {});
        }
      });
    }
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
    try {
      const { enqueueNotification } = require("../queues/notification.queue");
      await enqueueNotification(userId, type, title, body, { data });
    } catch (queueErr) {
      logger.warn(`[notification] Queue dispatch failed, falling back to direct push: ${queueErr.message}`);
      await dispatchPush(userId, title, body, { type, ...data });
    }
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

/**
 * Sends custom push notification from the admin panel to:
 * - "ALL": all active clients and coaches
 * - "USERS": all active clients
 * - "COACHES": all active coaches
 * - "SPECIFIC": a single user by ID or email
 */
async function sendAdminNotification({ target = "ALL", userId, userEmail, title, body, type = "ANNOUNCEMENT", data = {} }) {
  const ApiError = require("../utils/ApiError");
  let targetIds = [];

  if (target === "SPECIFIC" || userId || userEmail) {
    if (userId) {
      const user = await userRepository.findById(userId);
      if (!user) throw ApiError.notFound(`No user found with ID: ${userId}`);
      targetIds = [userId];
    } else if (userEmail) {
      const user = await userRepository.findByEmail(userEmail.trim().toLowerCase());
      if (!user) throw ApiError.notFound(`No user found with email: ${userEmail}`);
      targetIds = [user.id];
    } else {
      throw ApiError.badRequest("Please provide either userId or userEmail for SPECIFIC target");
    }
  } else if (target === "USERS" || target === "USER") {
    targetIds = await userRepository.listActiveUserIdsByRole("USER");
  } else if (target === "COACHES" || target === "COACH") {
    targetIds = await userRepository.listActiveUserIdsByRole("COACH");
  } else {
    // "ALL"
    const [userIds, coachIds] = await Promise.all([
      userRepository.listActiveUserIdsByRole("USER"),
      userRepository.listActiveUserIdsByRole("COACH")
    ]);
    targetIds = Array.from(new Set([...userIds, ...coachIds]));
  }

  if (!targetIds.length) {
    return { recipientCount: 0, message: "No active recipients found for selected target" };
  }

  await notifyMany(targetIds, type, title, body, { data });
  return { recipientCount: targetIds.length, target, type };
}

module.exports = {
  registerDevice,
  unregisterDevice,
  list,
  markRead,
  markAllRead,
  markTypeRead,
  unreadCount,
  getPreferences,
  updatePreferences,
  notify,
  notifyMany,
  broadcastAnnouncement,
  sendAdminNotification,
  dispatchPush,
  getChannelIdForType
};
