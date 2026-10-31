const notificationService = require("../services/notification.service");
const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const httpStatus = require("../constants/httpStatus");

const registerDevice = asyncHandler(async (req, res) => {
  const result = await notificationService.registerDevice(req.user.id, req.body);
  return ApiResponse.success(res, httpStatus.CREATED, "Device registered", result);
});

const unregisterDevice = asyncHandler(async (req, res) => {
  await notificationService.unregisterDevice(req.body.token);
  return ApiResponse.success(res, httpStatus.OK, "Device unregistered", null);
});

const list = asyncHandler(async (req, res) => {
  const { items, meta } = await notificationService.list(req.user.id, req.query);
  return ApiResponse.success(res, httpStatus.OK, "Notifications retrieved", items, meta);
});

const markRead = asyncHandler(async (req, res) => {
  await notificationService.markRead(req.user.id, req.params.id);
  return ApiResponse.success(res, httpStatus.OK, "Notification marked as read", null);
});

const markAllRead = asyncHandler(async (req, res) => {
  await notificationService.markAllRead(req.user.id);
  return ApiResponse.success(res, httpStatus.OK, "All notifications marked as read", null);
});

const markTypeRead = asyncHandler(async (req, res) => {
  await notificationService.markTypeRead(req.user.id, req.params.type);
  return ApiResponse.success(res, httpStatus.OK, "Notifications marked as read", null);
});

const unreadCount = asyncHandler(async (req, res) => {
  const count = await notificationService.unreadCount(req.user.id, req.query.type);
  return ApiResponse.success(res, httpStatus.OK, "Unread notification count retrieved", { count });
});

const getPreferences = asyncHandler(async (req, res) => {
  const prefs = await notificationService.getPreferences(req.user.id);
  return ApiResponse.success(res, httpStatus.OK, "Notification preferences retrieved", prefs);
});

const updatePreferences = asyncHandler(async (req, res) => {
  const prefs = await notificationService.updatePreferences(req.user.id, req.body);
  return ApiResponse.success(res, httpStatus.OK, "Notification preferences updated", prefs);
});

module.exports = {
  registerDevice,
  unregisterDevice,
  list,
  markRead,
  markAllRead,
  markTypeRead,
  unreadCount,
  getPreferences,
  updatePreferences
};
