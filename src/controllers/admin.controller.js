const adminService = require("../services/admin.service");
const notificationService = require("../services/notification.service");
const chatService = require("../services/chat.service");
const appointmentService = require("../services/appointment.service");
const userRepository = require("../repositories/user.repository");
const coachReportService = require("../services/coachReport.service");
const supportService = require("../services/support.service");
const ApiError = require("../utils/ApiError");
const logger = require("../config/logger");
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
  const previous = await userRepository.findById(req.params.id);
  const user = await adminService.changeUserRole(req.user.id, req.params.id, req.body.role);
  if (previous?.assignedCoachId && req.body.role !== "USER") {
    try {
      await appointmentService.releaseUpcomingSessions(req.params.id, previous.assignedCoachId, "the account role changed");
    } catch (err) {
      logger.warn(`[appointments] releasing sessions after role change failed: ${err.message}`);
    }
  }
  return ApiResponse.success(res, httpStatus.OK, "User role updated", user);
});

/**
 * Assigns (or with null, removes) a user's coach and, when the coach actually
 * changed, greets the user from the new coach in Chats. The greeting is
 * best-effort: a chat failure must not make a successful assignment look failed.
 */
async function assignAndGreet(req, userId, coachId) {
  const previous = await userRepository.findById(userId);
  const user = await adminService.assignCoach(req.user.id, userId, coachId);

  // Swapped to a different coach (or unassigned): the old coach's upcoming sessions are cancelled.
  if (previous?.assignedCoachId && previous.assignedCoachId !== (coachId || null)) {
    try {
      await appointmentService.releaseUpcomingSessions(userId, previous.assignedCoachId);
    } catch (err) {
      logger.warn(`[appointments] releasing sessions failed: ${err.message}`);
    }
  }

  if (coachId && previous?.assignedCoachId !== coachId) {
    try {
      const sent = await chatService.sendCoachAssignmentMessage(userId, coachId);
      req.app.get("chatSocketEmitter")?.(userId, sent.message);
    } catch (err) {
      logger.warn(`[chat] coach assignment message failed: ${err.message}`);
    }
  }
  return user;
}

const assignCoach = asyncHandler(async (req, res) => {
  const user = await assignAndGreet(req, req.params.id, req.body.coachId);
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

const createUser = asyncHandler(async (req, res) => {
  const result = await adminService.createUser(req.user.id, req.body);
  return ApiResponse.success(res, httpStatus.CREATED, "User created", result);
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

const updateCoachCredentials = asyncHandler(async (req, res) => {
  const result = await adminService.updateCoachCredentials(req.user.id, req.params.id, req.body);
  return ApiResponse.success(res, httpStatus.OK, "Coach credentials updated", result);
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

// ── Image storage self-test ───────────────────────────────
const checkStorage = asyncHandler(async (req, res) => {
  const report = await require("../utils/storage").diagnose();
  return ApiResponse.success(res, httpStatus.OK, report.ok ? "Image storage is working" : "Image storage has problems", report);
});

// ── Coach reports ──────────────────────────────────────────
const listCoachReports = asyncHandler(async (req, res) => {
  const { items, meta } = await coachReportService.adminList(req.query);
  return ApiResponse.success(res, httpStatus.OK, "Coach reports retrieved", items, meta);
});

const updateCoachReport = asyncHandler(async (req, res) => {
  const report = await coachReportService.adminUpdate(req.user.id, req.params.id, req.body);
  return ApiResponse.success(res, httpStatus.OK, "Report updated", report);
});

// Resolves a report by moving the user to another coach (or removing theirs).
const reassignFromCoachReport = asyncHandler(async (req, res) => {
  const report = await coachReportService.findOrFail(req.params.id);
  const { coachId, adminNote } = req.body;
  if (coachId && coachId === report.coachId) {
    throw ApiError.badRequest("Pick a different coach from the one that was reported");
  }

  await assignAndGreet(req, report.userId, coachId);
  // The reported coach may not have been the assigned one (the user booked them directly), so release those sessions too.
  try {
    await appointmentService.releaseUpcomingSessions(report.userId, report.coachId, "of your report");
  } catch (err) {
    logger.warn(`[appointments] releasing reported coach sessions failed: ${err.message}`);
  }
  const updated = await coachReportService.markReassigned(req.user.id, report.id, coachId, adminNote);
  return ApiResponse.success(res, httpStatus.OK, coachId ? "User moved to the new coach" : "Coach removed from user", updated);
});

// ── Support tickets ───────────────────────────────────────
const listSupportTickets = asyncHandler(async (req, res) => {
  const { items, meta } = await supportService.adminList(req.query);
  return ApiResponse.success(res, httpStatus.OK, "Support requests retrieved", items, meta);
});

const deleteSupportTicket = asyncHandler(async (req, res) => {
  await supportService.adminRemove(req.user.id, req.params.id);
  return ApiResponse.success(res, httpStatus.OK, "Support request deleted", null);
});

const updateSupportTicket = asyncHandler(async (req, res) => {
  const ticket = await supportService.adminUpdate(req.user.id, req.params.id, req.body);
  return ApiResponse.success(res, httpStatus.OK, "Support request updated", ticket);
});

module.exports = {
  checkStorage,
  listCoachReports,
  updateCoachReport,
  reassignFromCoachReport,
  listSupportTickets,
  updateSupportTicket,
  deleteSupportTicket,
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
  createUser,
  deleteUser,
  listCoaches,
  createCoach,
  updateCoach,
  updateCoachCredentials,
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

