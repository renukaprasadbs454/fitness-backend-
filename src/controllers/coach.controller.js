const coachService = require("../services/coach.service");
const coachDbService = require("../services/coachDb.service");
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

const listMyAppointments = asyncHandler(async (req, res) => {
  const { items, meta } = await coachService.listMyAppointments(req.user.id, req.query);
  return ApiResponse.success(res, httpStatus.OK, "Appointments retrieved", items, meta);
});

// ── Database explorer (subset of the admin one — User/Coach/Payment are
// excluded; see coachDb.service.js) ─────────────────────────────────

const listDbTables = asyncHandler(async (req, res) => {
  const tables = coachDbService.listTables();
  return ApiResponse.success(res, httpStatus.OK, "Database schema retrieved", tables);
});

const getDbTableData = asyncHandler(async (req, res) => {
  const result = await coachDbService.getTableData(req.params.tableName, req.query);
  return ApiResponse.success(res, httpStatus.OK, "Table data retrieved", result.items, result.meta);
});

const createDbRow = asyncHandler(async (req, res) => {
  const item = await coachDbService.createModelRow(req.params.tableName, req.body);
  return ApiResponse.success(res, httpStatus.CREATED, "Row created", item);
});

const updateDbRow = asyncHandler(async (req, res) => {
  const item = await coachDbService.updateModelRow(req.params.tableName, req.params.id, req.body);
  return ApiResponse.success(res, httpStatus.OK, "Row updated", item);
});

const deleteDbRow = asyncHandler(async (req, res) => {
  await coachDbService.deleteModelRow(req.params.tableName, req.params.id);
  return ApiResponse.success(res, httpStatus.OK, "Row deleted", null);
});

const getDbRelationOptions = asyncHandler(async (req, res) => {
  const options = await coachDbService.getRelationOptions(req.params.modelName);
  return ApiResponse.success(res, httpStatus.OK, "Relation options retrieved", options);
});

module.exports = {
  getMyCoachProfile,
  updateMyCoachProfile,
  deleteMyCoachProfile,
  getCoachById,
  listCoaches,
  upsertAvailability,
  listAvailability,
  listMyAppointments,
  listDbTables,
  getDbTableData,
  createDbRow,
  updateDbRow,
  deleteDbRow,
  getDbRelationOptions
};
