const prisma = require("../database/prismaClient");

const notificationRepository = {
  upsertDeviceToken: (userId, token, platform) =>
    prisma.deviceToken.upsert({
      where: { token },
      update: { userId, platform },
      create: { userId, token, platform }
    }),

  listDeviceTokens: (userId) => prisma.deviceToken.findMany({ where: { userId } }),

  create: (data) => prisma.notification.create({ data }),

  list: (userId, { skip, take, unreadOnly, type }) =>
    prisma.notification.findMany({
      where: { userId, type: type || undefined, isRead: unreadOnly ? false : undefined },
      orderBy: { createdAt: "desc" },
      skip,
      take
    }),

  count: (userId, unreadOnly, type) =>
    prisma.notification.count({ where: { userId, type: type || undefined, isRead: unreadOnly ? false : undefined } }),

  countUnread: (userId, type) => prisma.notification.count({ where: { userId, type: type || undefined, isRead: false } }),

  markRead: (id, userId) =>
    prisma.notification.updateMany({ where: { id, userId }, data: { isRead: true } }),

  markAllRead: (userId) =>
    prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } }),

  markTypeRead: (userId, type) =>
    prisma.notification.updateMany({ where: { userId, type, isRead: false }, data: { isRead: true } }),

  removeDeviceToken: (token) => prisma.deviceToken.deleteMany({ where: { token } }),

  getPreference: (userId) => prisma.notificationPreference.findUnique({ where: { userId } }),

  upsertPreference: (userId, data) =>
    prisma.notificationPreference.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data }
    })
};

module.exports = notificationRepository;
