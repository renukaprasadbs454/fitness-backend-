const prisma = require("../database/prismaClient");

const progressRepository = {
  createWeightLog: (userId, data) => prisma.weightLog.create({ data: { userId, ...data } }),

  weightLogsSince: (userId, since) =>
    prisma.weightLog.findMany({
      where: { userId, loggedAt: { gte: since } },
      orderBy: { loggedAt: "asc" }
    }),

  latestWeightLog: (userId) =>
    prisma.weightLog.findFirst({ where: { userId }, orderBy: { loggedAt: "desc" } }),

  createMeasurement: (userId, data) =>
    prisma.bodyMeasurement.create({ data: { userId, ...data } }),

  latestMeasurement: (userId) =>
    prisma.bodyMeasurement.findFirst({ where: { userId }, orderBy: { loggedAt: "desc" } }),

  bmiLogsSince: (userId, since) =>
    prisma.bmiLog.findMany({
      where: { userId, createdAt: { gte: since } },
      orderBy: { createdAt: "asc" }
    }),

  workoutCompletionsSince: (userId, since) =>
    prisma.workoutCompletion.count({ where: { userId, completedAt: { gte: since } } }),

  progressPhotos: (userId, take = 12) =>
    prisma.media.findMany({
      where: { userId, type: "PROGRESS_IMAGE" },
      orderBy: { createdAt: "desc" },
      take
    }),

  progressPhotoSessions: (userId) =>
    prisma.media.findMany({
      where: { userId, type: "PROGRESS_IMAGE", sessionId: { not: null } },
      orderBy: { createdAt: "desc" }
    }),

  activityTimelineSince: (userId, since, take = 10) =>
    prisma.activityLog.findMany({
      where: { userId, createdAt: { gte: since } },
      orderBy: { createdAt: "asc" },
      take
    })
};

module.exports = progressRepository;
