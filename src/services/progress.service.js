const progressRepository = require("../repositories/progress.repository");
const activityFeed = require("./activityFeed.service");
const { saveFile, deleteFile } = require("../utils/storage");
const ApiError = require("../utils/ApiError");

async function logWeight(userId, { weightKg, loggedAt }) {
  const log = await progressRepository.createWeightLog(userId, {
    weightKg,
    ...(loggedAt ? { loggedAt: new Date(loggedAt) } : {})
  });
  await activityFeed.record(userId, "WEIGHT_LOGGED", `Logged weight: ${weightKg}kg`);
  return log;
}

async function logMeasurement(userId, data) {
  const { loggedAt, ...rest } = data;
  return progressRepository.createMeasurement(userId, {
    ...rest,
    ...(loggedAt ? { loggedAt: new Date(loggedAt) } : {})
  });
}

async function logPhoto(userId, file, { angle, sessionId }) {
  if (!file) throw ApiError.badRequest("No file provided");
  const { url, storageKey, mimeType } = await saveFile(file, "progress");
  try {
    const result = await progressRepository.createProgressPhoto(userId, {
      url,
      storageKey,
      mimeType,
      sizeBytes: file.size,
      angle
    }, sessionId);
    if (result.replacedStorageKey) await deleteFile(result.replacedStorageKey);
    return result.media;
  } catch (error) {
    await deleteFile(storageKey).catch(() => {});
    throw error;
  }
}

async function freezePhotoSet(userId, sessionId) {
  const frozen = await progressRepository.freezeProgressPhotoSet(userId, sessionId);
  if (!frozen) throw ApiError.notFound("Photo set not found");
  return frozen;
}

async function photoSessions(userId) {
  const photos = await progressRepository.progressPhotoSessions(userId);

  const sessionsById = new Map();
  for (const photo of photos) {
    if (!sessionsById.has(photo.sessionId)) {
      sessionsById.set(photo.sessionId, { sessionId: photo.sessionId, createdAt: photo.setCreatedAt || photo.createdAt, frozen: photo.setFrozen, photos: [] });
    }
    const session = sessionsById.get(photo.sessionId);
    session.photos.push({ id: photo.id, angle: photo.angle, url: photo.url, createdAt: photo.createdAt });
    session.frozen = session.frozen || photo.setFrozen;
  }

  return [...sessionsById.values()].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function daysForRange(range) {
  return range === "monthly" ? 30 : 7;
}

async function report(userId, { range = "weekly" } = {}) {
  const days = daysForRange(range);
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);

  const [weightLogs, bmiLogs, workoutsCompleted, photos, timeline, latestMeasurement] =
    await Promise.all([
      progressRepository.weightLogsSince(userId, since),
      progressRepository.bmiLogsSince(userId, since),
      progressRepository.workoutCompletionsSince(userId, since),
      progressRepository.progressPhotos(userId, 6),
      progressRepository.activityTimelineSince(userId, since),
      progressRepository.latestMeasurement(userId)
    ]);

  const weightTrend = weightLogs.map((w) => Number(w.weightKg));
  const bmiTrend = bmiLogs.map((b) => Number(b.bmi));
  const weightChange =
    weightTrend.length >= 2
      ? Math.round((weightTrend[0] - weightTrend[weightTrend.length - 1]) * 10) / 10
      : 0;

  return {
    range,
    since: since.toISOString().slice(0, 10),
    weightTrend,
    bmiTrend,
    latestMeasurement,
    stats: [
      { label: "Workouts", value: `${workoutsCompleted}` },
      { label: "Weight Change", value: `${weightChange}kg` },
      { label: "Entries Logged", value: `${weightLogs.length}` }
    ],
    photos: photos.map((p) => ({ id: p.id, url: p.url, createdAt: p.createdAt })),
    timeline: timeline.map((t) => t.description)
  };
}

module.exports = { logWeight, logMeasurement, logPhoto, freezePhotoSet, photoSessions, report };
