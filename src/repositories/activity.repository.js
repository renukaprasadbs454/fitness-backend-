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

  workoutCompletionsSince: (userId, sinceDate) => prisma.workoutCompletion.count({ where: { userId, completedAt: { gte: sinceDate } } }),

  customWorkoutCompletionsSince: (userId, sinceDate) => prisma.customWorkout.count({ where: { userId, completedAt: { gte: sinceDate } } }),

  recentActivityFeed: (userId, take = 10) =>
    prisma.activityLog.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take
    }),

  listActivityFeed: (userId, { skip, take }) =>
    prisma.activityLog.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip,
      take
    }),

  countActivityFeed: (userId) => prisma.activityLog.count({ where: { userId } })
};

module.exports = activityRepository;
