const favoriteService = require("../services/favorite.service");
const coachReportService = require("../services/coachReport.service");
const supportService = require("../services/support.service");
const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const httpStatus = require("../constants/httpStatus");

// ── Favourite coaches ─────────────────────────────────────
const listFavoriteCoaches = asyncHandler(async (req, res) => {
  const coaches = await favoriteService.list(req.user.id);
  return ApiResponse.success(res, httpStatus.OK, "Favourite coaches retrieved", coaches);
});

const listFavoriteCoachIds = asyncHandler(async (req, res) => {
  const ids = await favoriteService.listIds(req.user.id);
  return ApiResponse.success(res, httpStatus.OK, "Favourite coach ids retrieved", ids);
});

const addFavoriteCoach = asyncHandler(async (req, res) => {
  const ids = await favoriteService.add(req.user.id, req.params.coachId);
  return ApiResponse.success(res, httpStatus.OK, "Coach added to favourites", ids);
});

const removeFavoriteCoach = asyncHandler(async (req, res) => {
  const ids = await favoriteService.remove(req.user.id, req.params.coachId);
  return ApiResponse.success(res, httpStatus.OK, "Coach removed from favourites", ids);
});

// ── Coach reports (user side) ─────────────────────────────
const createCoachReport = asyncHandler(async (req, res) => {
  const report = await coachReportService.create(req.user.id, req.body);
  return ApiResponse.success(res, httpStatus.CREATED, "Report submitted. Our team will review it.", report);
});

const listMyCoachReports = asyncHandler(async (req, res) => {
  const reports = await coachReportService.listMine(req.user.id);
  return ApiResponse.success(res, httpStatus.OK, "Reports retrieved", reports);
});

// ── Support tickets (user side) ───────────────────────────
const createSupportTicket = asyncHandler(async (req, res) => {
  const ticket = await supportService.create(req.user.id, req.body);
  return ApiResponse.success(res, httpStatus.CREATED, "Support request sent. We'll get back to you soon.", ticket);
});

const updateMySupportTicket = asyncHandler(async (req, res) => {
  const ticket = await supportService.updateMine(req.user.id, req.params.id, req.body);
  return ApiResponse.success(res, httpStatus.OK, "Support request updated", ticket);
});

const deleteMySupportTicket = asyncHandler(async (req, res) => {
  await supportService.removeMine(req.user.id, req.params.id);
  return ApiResponse.success(res, httpStatus.OK, "Support request deleted", null);
});

const listMySupportTickets = asyncHandler(async (req, res) => {
  const tickets = await supportService.listMine(req.user.id);
  return ApiResponse.success(res, httpStatus.OK, "Support requests retrieved", tickets);
});

module.exports = {
  listFavoriteCoaches,
  listFavoriteCoachIds,
  addFavoriteCoach,
  removeFavoriteCoach,
  createCoachReport,
  listMyCoachReports,
  createSupportTicket,
  updateMySupportTicket,
  deleteMySupportTicket,
  listMySupportTickets
};
