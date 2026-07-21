const coachService = require("../services/coach.service");
const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const httpStatus = require("../constants/httpStatus");

const getMyCoachProfile = asyncHandler(async (req, res) => {
  const coach = await coachService.getMyCoachProfile(req.user.id);
  return ApiResponse.success(res, httpStatus.OK, "Coach profile retrieved", coach);
});

const updateMyCoachProfile = asyncHandler(async (req, res) => {
  const coach = await coachService.updateMyCoachProfile(req.user.id, req.body);
  return ApiResponse.success(res, httpStatus.OK, "Coach profile updated", coach);
});

const deleteMyCoachProfile = asyncHandler(async (req, res) => {
  await coachService.deleteMyCoachProfile(req.user.id);
  return ApiResponse.success(res, httpStatus.OK, "Coach profile deleted", null);
});

const getCoachById = asyncHandler(async (req, res) => {
  const coach = await coachService.getCoachById(req.params.id);
  return ApiResponse.success(res, httpStatus.OK, "Coach retrieved", coach);
});

const listCoaches = asyncHandler(async (req, res) => {
  const { items, meta } = await coachService.listCoaches(req.query);
  return ApiResponse.success(res, httpStatus.OK, "Coaches retrieved", items, meta);
});

const upsertAvailability = asyncHandler(async (req, res) => {
  const slot = await coachService.setAvailability(req.user.id, req.params.coachId, req.body);
  return ApiResponse.success(res, httpStatus.OK, "Availability updated", slot);
});

const listAvailability = asyncHandler(async (req, res) => {
  const slots = await coachService.listAvailability(req.params.coachId);
  return ApiResponse.success(res, httpStatus.OK, "Availability retrieved", slots);
});

module.exports = {
  getMyCoachProfile,
  updateMyCoachProfile,
  deleteMyCoachProfile,
  getCoachById,
  listCoaches,
  upsertAvailability,
  listAvailability
};
