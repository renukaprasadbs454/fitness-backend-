const mediaRepository = require("../repositories/media.repository");
const userRepository = require("../repositories/user.repository");
const coachRepository = require("../repositories/coach.repository");
const { saveFile, deleteFile } = require("../utils/storage");
const ApiError = require("../utils/ApiError");

const SUBFOLDER_BY_TYPE = {
  PROFILE_IMAGE: "profile",
  PROGRESS_IMAGE: "progress",
  COACH_IMAGE: "coach"
};

async function uploadImage(userId, file, type) {
  if (!file) throw ApiError.badRequest("No file provided");

  const subfolder = SUBFOLDER_BY_TYPE[type];
  const { url, storageKey } = await saveFile(file, subfolder);

  const media = await mediaRepository.create({
    userId,
    type,
    url,
    storageKey,
    mimeType: file.mimetype,
    sizeBytes: file.size
  });

  // Keep the denormalized "current" image URL on the owning profile in sync
  // so screens like ProfileScreen can read it with a single query.
  if (type === "PROFILE_IMAGE") {
    await userRepository.upsertProfile(userId, { profileImageUrl: url });
  } else if (type === "COACH_IMAGE") {
    const coach = await coachRepository.findByUserId(userId);
    if (coach) await coachRepository.update(coach.id, { profileImageUrl: url });
  }

  return media;
}

async function listMyMedia(userId, type) {
  return mediaRepository.listByUser(userId, type);
}

async function deleteMedia(userId, mediaId) {
  const media = await mediaRepository.findById(mediaId);
  if (!media) throw ApiError.notFound("Media not found");
  if (media.userId !== userId) throw ApiError.forbidden("You cannot delete another user's media");

  await deleteFile(media.storageKey);
  await mediaRepository.delete(mediaId);
}

module.exports = { uploadImage, listMyMedia, deleteMedia };
