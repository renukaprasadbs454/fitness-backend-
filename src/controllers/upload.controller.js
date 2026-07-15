const mediaService = require("../services/media.service");
const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const httpStatus = require("../constants/httpStatus");
const ApiError = require("../utils/ApiError");

const VALID_TYPES = ["PROFILE_IMAGE", "PROGRESS_IMAGE", "COACH_IMAGE"];

const uploadImage = asyncHandler(async (req, res) => {
  const type = (req.body.type || "").toUpperCase();
  if (!VALID_TYPES.includes(type)) {
    throw ApiError.badRequest(`type must be one of: ${VALID_TYPES.join(", ")}`);
  }
  const media = await mediaService.uploadImage(req.user.id, req.file, type);
  return ApiResponse.success(res, httpStatus.CREATED, "Image uploaded", media);
});

const listMyMedia = asyncHandler(async (req, res) => {
  const type = req.query.type ? req.query.type.toUpperCase() : undefined;
  const media = await mediaService.listMyMedia(req.user.id, type);
  return ApiResponse.success(res, httpStatus.OK, "Media retrieved", media);
});

const deleteMedia = asyncHandler(async (req, res) => {
  await mediaService.deleteMedia(req.user.id, req.params.id);
  return ApiResponse.success(res, httpStatus.OK, "Media deleted", null);
});

module.exports = { uploadImage, listMyMedia, deleteMedia };
