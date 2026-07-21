const progressService = require("../services/progress.service");
const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const httpStatus = require("../constants/httpStatus");
const ApiError = require("../utils/ApiError");

const logWeight = asyncHandler(async (req, res) => {
  const result = await progressService.logWeight(req.user.id, req.body);
  return ApiResponse.success(res, httpStatus.CREATED, "Weight logged", result);
});

const logMeasurement = asyncHandler(async (req, res) => {
  const result = await progressService.logMeasurement(req.user.id, req.body);
  return ApiResponse.success(res, httpStatus.CREATED, "Measurement logged", result);
});

const logPhoto = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest("No file provided");
  const result = await progressService.logPhoto(req.user.id, req.file);
  return ApiResponse.success(res, httpStatus.CREATED, "Progress photo uploaded", result);
});

const report = asyncHandler(async (req, res) => {
  const result = await progressService.report(req.user.id, req.query);
  return ApiResponse.success(res, httpStatus.OK, "Progress report retrieved", result);
});

module.exports = { logWeight, logMeasurement, logPhoto, report };
