const adminService = require("../services/admin.service");
const notificationService = require("../services/notification.service");
const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const httpStatus = require("../constants/httpStatus");

// ── Dashboard ────────────────────────────────────────────
const dashboardStats = asyncHandler(async (req, res) => {
  const stats = await adminService.dashboardStats();
  return ApiResponse.success(res, httpStatus.OK, "Dashboard stats retrieved", stats);
});

// ── Users ──────────────────────────────────────────────────
const listUsers = asyncHandler(async (req, res) => {
  const { items, meta } = await adminService.listUsers(req.query);
  return ApiResponse.success(res, httpStatus.OK, "Users retrieved", items, meta);
});

const getUserById = asyncHandler(async (req, res) => {
  const user = await adminService.getUserById(req.params.id);
  return ApiResponse.success(res, httpStatus.OK, "User retrieved", user);
});

const updateUser = asyncHandler(async (req, res) => {
  const user = await adminService.updateUser(req.user.id, req.params.id, req.body);
  return ApiResponse.success(res, httpStatus.OK, "User updated", user);
});

const suspendUser = asyncHandler(async (req, res) => {
  const user = await adminService.setUserActive(req.user.id, req.params.id, false);
  return ApiResponse.success(res, httpStatus.OK, "User suspended", user);
});

const activateUser = asyncHandler(async (req, res) => {
  const user = await adminService.setUserActive(req.user.id, req.params.id, true);
  return ApiResponse.success(res, httpStatus.OK, "User activated", user);
});

const changeUserRole = asyncHandler(async (req, res) => {
  const user = await adminService.changeUserRole(req.user.id, req.params.id, req.body.role);
  return ApiResponse.success(res, httpStatus.OK, "User role updated", user);
});

const assignCoach = asyncHandler(async (req, res) => {
  const user = await adminService.assignCoach(req.user.id, req.params.id, req.body.coachId);
  return ApiResponse.success(res, httpStatus.OK, req.body.coachId ? "Coach assigned" : "Coach unassigned", user);
});

const listCoachClients = asyncHandler(async (req, res) => {
  const clients = await adminService.listCoachClients(req.params.id);
  return ApiResponse.success(res, httpStatus.OK, "Coach clients retrieved", clients);
});

const resetUserPassword = asyncHandler(async (req, res) => {
  const result = await adminService.resetUserPassword(
    req.user.id,
    req.params.id,
    req.body.newPassword
  );
  return ApiResponse.success(res, httpStatus.OK, "Password reset", result);
});

const deleteUser = asyncHandler(async (req, res) => {
  await adminService.deleteUser(req.user.id, req.params.id);
  return ApiResponse.success(res, httpStatus.OK, "User deleted", null);
});

// ── Coaches ────────────────────────────────────────────────
const listCoaches = asyncHandler(async (req, res) => {
  const { items, meta } = await adminService.listCoaches(req.query);
  return ApiResponse.success(res, httpStatus.OK, "Coaches retrieved", items, meta);
});

const createCoach = asyncHandler(async (req, res) => {
  const coach = await adminService.createCoach(req.user.id, req.body);
  return ApiResponse.success(res, httpStatus.CREATED, "Coach created", coach);
});

const updateCoach = asyncHandler(async (req, res) => {
  const coach = await adminService.updateCoach(req.user.id, req.params.id, req.body);
  return ApiResponse.success(res, httpStatus.OK, "Coach updated", coach);
});

const deleteCoach = asyncHandler(async (req, res) => {
  await adminService.deleteCoach(req.user.id, req.params.id);
  return ApiResponse.success(res, httpStatus.OK, "Coach deleted", null);
});

// ── Audit logs ─────────────────────────────────────────────
const listAuditLogs = asyncHandler(async (req, res) => {
  const { items, meta } = await adminService.listAuditLogs(req.query);
  return ApiResponse.success(res, httpStatus.OK, "Audit logs retrieved", items, meta);
});

// ── Payments ───────────────────────────────────────────────
const listPayments = asyncHandler(async (req, res) => {
  const { items, meta } = await adminService.listPayments(req.query);
  return ApiResponse.success(res, httpStatus.OK, "Payments retrieved", items, meta);
});

const broadcastAnnouncement = asyncHandler(async (req, res) => {
  const { title, body, role } = req.body;
  const result = await notificationService.broadcastAnnouncement(title, body, { role });
  return ApiResponse.success(res, httpStatus.OK, "Announcement broadcast", result);
});

const getDatabaseSchema = asyncHandler(async (req, res) => {
  const schema = adminService.getDatabaseSchema();
  return ApiResponse.success(res, httpStatus.OK, "Database schema retrieved", schema);
});

const getModelData = asyncHandler(async (req, res) => {
  const result = await adminService.getModelData(req.params.tableName, req.query);
  return ApiResponse.success(res, httpStatus.OK, "Table data retrieved", result.items, result.meta);
});

const createModelRow = asyncHandler(async (req, res) => {
  const item = await adminService.createModelRow(req.params.tableName, req.body);
  return ApiResponse.success(res, httpStatus.CREATED, "Row created", item);
});

const updateModelRow = asyncHandler(async (req, res) => {
  const item = await adminService.updateModelRow(req.params.tableName, req.params.id, req.body);
  return ApiResponse.success(res, httpStatus.OK, "Row updated", item);
});

const deleteModelRow = asyncHandler(async (req, res) => {
  await adminService.deleteModelRow(req.params.tableName, req.params.id);
  return ApiResponse.success(res, httpStatus.OK, "Row deleted", null);
});

const getRelationOptions = asyncHandler(async (req, res) => {
  const options = await adminService.getRelationOptions(req.params.modelName);
  return ApiResponse.success(res, httpStatus.OK, "Relation options retrieved", options);
});

module.exports = {
  dashboardStats,
  listUsers,
  getUserById,
  updateUser,
  suspendUser,
  activateUser,
  changeUserRole,
  assignCoach,
  listCoachClients,
  resetUserPassword,
  deleteUser,
  listCoaches,
  createCoach,
  updateCoach,
  deleteCoach,
  listAuditLogs,
  listPayments,
  broadcastAnnouncement,
  getDatabaseSchema,
  getModelData,
  createModelRow,
  updateModelRow,
  deleteModelRow,
  getRelationOptions
};

