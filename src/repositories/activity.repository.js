const prisma = require("../database/prismaClient");

const activityRepository = {
  upsertStepLog: (userId, date, data) =>
    prisma.stepLog.upsert({
      where: { userId_date: { userId, date } },
      update: data,
      create: { userId, date, ...data }
    }),

  listStepLogs: (userId, { skip, take, from, to }) =>
    prisma.stepLog.findMany({
      where: {
        userId,
        date: {
          gte: from ? new Date(from) : undefined,
          lte: to ? new Date(to) : undefined
        }
      },
      orderBy: { date: "desc" },
      skip,
      take
    }),

  countStepLogs: (userId, { from, to }) =>
    prisma.stepLog.count({
      where: {
        userId,
        date: {
          gte: from ? new Date(from) : undefined,
          lte: to ? new Date(to) : undefined
        }
      }
    }),

  stepLogsSince: (userId, sinceDate) =>
    prisma.stepLog.findMany({
      where: { userId, date: { gte: sinceDate } },
      orderBy: { date: "asc" }
    }),

  recentActivityFeed: (userId, take = 10) =>
    prisma.activityLog.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take
    })
};

module.exports = activityRepository;
