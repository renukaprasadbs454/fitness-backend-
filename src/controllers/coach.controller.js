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

const updateCoachProfile = asyncHandler(async (req, res) => {
  const coach = await coachService.updateCoachProfileAsHead(req.user.id, req.params.id, req.body);
  return ApiResponse.success(res, httpStatus.OK, "Coach profile updated", coach);
});

const createCoach = asyncHandler(async (req, res) => {
  const coach = await coachService.createCoachAsHead(req.user.id, req.body);
  return ApiResponse.success(res, httpStatus.CREATED, "Coach added", coach);
});

const deleteCoach = asyncHandler(async (req, res) => {
  await coachService.deleteCoachAsHead(req.user.id, req.params.id);
  return ApiResponse.success(res, httpStatus.OK, "Coach removed", null);
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

const updateAvailabilitySlot = asyncHandler(async (req, res) => {
  const slot = await coachService.updateAvailabilitySlot(req.user.id, req.params.coachId, req.params.slotId, req.body);
  return ApiResponse.success(res, httpStatus.OK, "Availability slot updated", slot);
});

const deleteAvailabilitySlot = asyncHandler(async (req, res) => {
  await coachService.deleteAvailabilitySlot(req.user.id, req.params.coachId, req.params.slotId);
  return ApiResponse.success(res, httpStatus.OK, "Availability slot deleted", null);
});

const listAvailability = asyncHandler(async (req, res) => {
  const slots = await coachService.listAvailability(req.params.coachId);
  return ApiResponse.success(res, httpStatus.OK, "Availability retrieved", slots);
});

const listMyClients = asyncHandler(async (req, res) => {
  const result = await coachService.listMyClients(req.user.id);
  return ApiResponse.success(res, httpStatus.OK, "Clients retrieved", result);
});

const listMyAppointments = asyncHandler(async (req, res) => {
  const { items, meta } = await coachService.listMyAppointments(req.user.id, req.query);
  return ApiResponse.success(res, httpStatus.OK, "Appointments retrieved", items, meta);
});

module.exports = {
  getMyCoachProfile,
  updateMyCoachProfile,
  updateCoachProfile,
  createCoach,
  deleteCoach,
  deleteMyCoachProfile,
  getCoachById,
  listCoaches,
  upsertAvailability,
  updateAvailabilitySlot,
  deleteAvailabilitySlot,
  listAvailability,
  listMyClients,
  listMyAppointments,
};
