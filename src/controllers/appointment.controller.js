const appointmentService = require("../services/appointment.service");
const meetingService = require("../services/meeting.service");
const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const httpStatus = require("../constants/httpStatus");

const create = asyncHandler(async (req, res) => {
  const appointment = await appointmentService.create(req.user.id, req.body, {
    onChatMessage: (recipientId, message) => req.app.get("chatSocketEmitter")?.(recipientId, message)
  });
  return ApiResponse.success(res, httpStatus.CREATED, "Appointment booked", appointment);
});

const list = asyncHandler(async (req, res) => {
  const { items, meta } = await appointmentService.list(req.user.id, req.query);
  return ApiResponse.success(res, httpStatus.OK, "Appointments retrieved", items, meta);
});

const getById = asyncHandler(async (req, res) => {
  const appointment = await appointmentService.getById(req.user.id, req.params.id, req.user.role);
  return ApiResponse.success(res, httpStatus.OK, "Appointment retrieved", appointment);
});

const updateStatus = asyncHandler(async (req, res) => {
  const appointment = await appointmentService.updateStatus(
    req.user.id,
    req.user.role,
    req.params.id,
    req.body.status
  );
  return ApiResponse.success(res, httpStatus.OK, "Appointment status updated", appointment);
});

const reschedule = asyncHandler(async (req, res) => {
  const appointment = await appointmentService.reschedule(
    req.user.id,
    req.user.role,
    req.params.id,
    req.body
  );
  return ApiResponse.success(res, httpStatus.OK, "Appointment rescheduled", appointment);
});

const updateDetails = asyncHandler(async (req, res) => {
  const appointment = await appointmentService.updateDetails(
    req.user.id,
    req.user.role,
    req.params.id,
    req.body
  );
  return ApiResponse.success(res, httpStatus.OK, "Appointment updated", appointment);
});

const remove = asyncHandler(async (req, res) => {
  await appointmentService.remove(req.user.id, req.user.role, req.params.id);
  return ApiResponse.success(res, httpStatus.OK, "Appointment deleted", null);
});

// Lets coach-facing screens decide whether to offer "Generate Google Meet link".
const meetingStatus = asyncHandler(async (req, res) => {
  const googleMeetConnected = await meetingService.isConnected();
  return ApiResponse.success(res, httpStatus.OK, "Meeting link options", { googleMeetConnected });
});

const setMeetingLink = asyncHandler(async (req, res) => {
  const appointment = await appointmentService.setMeetingLink(req.user.id, req.user.role, req.params.id, req.body.meetingLink);
  return ApiResponse.success(res, httpStatus.OK, req.body.meetingLink ? "Meeting link saved" : "Meeting link removed", appointment);
});

const generateMeetingLink = asyncHandler(async (req, res) => {
  const appointment = await appointmentService.generateMeetingLink(req.user.id, req.user.role, req.params.id);
  return ApiResponse.success(res, httpStatus.OK, "Google Meet link created", appointment);
});

const schedulableClients = asyncHandler(async (req, res) => {
  const result = await appointmentService.schedulableClients(req.user.id);
  return ApiResponse.success(res, httpStatus.OK, "Clients you can schedule sessions with", result);
});

const scheduleSessions = asyncHandler(async (req, res) => {
  const result = await appointmentService.scheduleSessions(req.user.id, req.body);
  const message = result.skipped.length
    ? `${result.created.length} session(s) scheduled, ${result.skipped.length} skipped`
    : `${result.created.length} session(s) scheduled`;
  return ApiResponse.success(res, httpStatus.CREATED, message, result);
});

module.exports = {
  create,
  list,
  getById,
  updateStatus,
  reschedule,
  updateDetails,
  remove,
  meetingStatus,
  setMeetingLink,
  generateMeetingLink,
  schedulableClients,
  scheduleSessions
};
