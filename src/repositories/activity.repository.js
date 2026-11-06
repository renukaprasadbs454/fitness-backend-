const prisma = require("../database/prismaClient");

const activityRepository = {
  findStepLog: (userId, date) =>
    prisma.stepLog.findUnique({ where: { userId_date: { userId, date } } }),

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

  customWorkoutCompletionsSince: async (userId, sinceDate) => {
    const [recorded, legacy] = await Promise.all([
      prisma.customWorkoutCompletion.count({ where: { userId, completedAt: { gte: sinceDate } } }),
      prisma.customWorkout.count({ where: { userId, completedAt: { gte: sinceDate }, completions: { none: {} } } })
    ]);
    return recorded + legacy;
  },

  completedWorkoutsSince: async (userId, sinceDate) => {
    const [plans, custom, legacyCustom, profile] = await Promise.all([
      prisma.workoutCompletion.findMany({
        where: { userId, completedAt: { gte: sinceDate } },
        select: { completedAt: true, caloriesBurned: true, plan: { select: { durationMinutes: true, categoryKey: true } } }
      }),
      prisma.customWorkoutCompletion.findMany({
        where: { userId, completedAt: { gte: sinceDate } },
        select: { completedAt: true, customWorkout: { select: { durationMinutes: true, categoryKey: true } } }
      }),
      prisma.customWorkout.findMany({
        where: { userId, completedAt: { gte: sinceDate }, completions: { none: {} } },
        select: { completedAt: true, durationMinutes: true, categoryKey: true }
      }),
      prisma.userProfile.findUnique({ where: { userId }, select: { weightKg: true } })
    ]);
    const customRows = [
      ...custom.map((completion) => ({ ...completion.customWorkout, completedAt: completion.completedAt })),
      ...legacyCustom
    ];
    return { plans, custom: customRows, weightKg: Number(profile?.weightKg) || 70 };
  },

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
