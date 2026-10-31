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

  list: (userId, { skip, take, unreadOnly }) =>
    prisma.notification.findMany({
      where: { userId, isRead: unreadOnly ? false : undefined },
      orderBy: { createdAt: "desc" },
      skip,
      take
    }),

  count: (userId, unreadOnly) =>
    prisma.notification.count({ where: { userId, isRead: unreadOnly ? false : undefined } }),

  countUnread: (userId) => prisma.notification.count({ where: { userId, isRead: false } }),

  markRead: (id, userId) =>
    prisma.notification.updateMany({ where: { id, userId }, data: { isRead: true } }),

  markAllRead: (userId) =>
    prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } }),

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
