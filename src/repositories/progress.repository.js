const prisma = require("../database/prismaClient");
const crypto = require("crypto");

const progressRepository = {
  createProgressPhoto: (userId, mediaData, requestedSessionId) =>
    prisma.$transaction(async (tx) => {
      // Serialize photo uploads for this account so simultaneous first uploads
      // cannot create two sets inside the 24-hour window.
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
      const latestSet = await tx.progressPhotoSetLock.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" }
      });
      const now = new Date();
      const withinSetWindow = latestSet && now.getTime() - latestSet.createdAt.getTime() < 24 * 60 * 60 * 1000;
      if (withinSetWindow && latestSet.frozenAt) {
        const remainingMs = Math.max(0, latestSet.createdAt.getTime() + 24 * 60 * 60 * 1000 - now.getTime());
        const hours = Math.floor(remainingMs / (60 * 60 * 1000));
        const minutes = Math.ceil((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
        const error = new Error(`This photo set is saved. You can start a new set in ${hours}h ${minutes}m. One set is allowed every 24 hours so your progress comparisons stay consistent.`);
        error.statusCode = 409;
        error.code = "PROGRESS_PHOTO_SET_FROZEN";
        throw error;
      }
      const sessionId = withinSetWindow
        ? latestSet.id
        : latestSet?.id === requestedSessionId
          ? crypto.randomUUID()
          : requestedSessionId || crypto.randomUUID();

      if (!withinSetWindow) {
        await tx.progressPhotoSetLock.create({ data: { id: sessionId, userId, createdAt: now } });
      }

      const existing = await tx.media.findFirst({
        where: { userId, type: "PROGRESS_IMAGE", sessionId, angle: mediaData.angle },
        orderBy: { createdAt: "desc" }
      });
      const created = await tx.media.create({ data: { ...mediaData, userId, type: "PROGRESS_IMAGE", sessionId } });
      if (existing) await tx.media.delete({ where: { id: existing.id } });
      return {
        media: created,
        replacedStorageKey: existing?.storageKey ?? null,
        replacedId: existing?.id ?? null
      };
    }),

  freezeProgressPhotoSet: (userId, sessionId) =>
    prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
      const set = await tx.progressPhotoSetLock.findFirst({ where: { id: sessionId, userId } });
      if (!set) return null;
      return tx.progressPhotoSetLock.update({ where: { id: set.id }, data: { frozenAt: new Date() } });
    }),

  createWeightLog: (userId, data) => prisma.weightLog.create({ data: { userId, ...data } }),

  weightLogsSince: (userId, since) =>
    prisma.weightLog.findMany({
      where: { userId, loggedAt: { gte: since } },
      orderBy: { loggedAt: "asc" }
    }),

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

  progressPhotoSessions: async (userId) => {
    const [photos, locks] = await Promise.all([
      prisma.media.findMany({
        where: { userId, type: "PROGRESS_IMAGE", sessionId: { not: null } },
        orderBy: { createdAt: "desc" }
      }),
      prisma.progressPhotoSetLock.findMany({ where: { userId }, select: { id: true, frozenAt: true, createdAt: true } })
    ]);
    const setsById = new Map(locks.map((set) => [set.id, set]));
    return photos.map((photo) => {
      const set = setsById.get(photo.sessionId);
      return { ...photo, setFrozen: Boolean(set?.frozenAt), setCreatedAt: set?.createdAt ?? photo.createdAt };
    });
  },

  activityTimelineSince: (userId, since, take = 10) =>
    prisma.activityLog.findMany({
      where: { userId, createdAt: { gte: since } },
      orderBy: { createdAt: "asc" },
      take
    })
};

module.exports = progressRepository;
