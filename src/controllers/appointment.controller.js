const appointmentService = require("../services/appointment.service");
const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const httpStatus = require("../constants/httpStatus");

const create = asyncHandler(async (req, res) => {
  const appointment = await appointmentService.create(req.user.id, req.body);
  return ApiResponse.success(res, httpStatus.CREATED, "Appointment booked", appointment);
});

const list = asyncHandler(async (req, res) => {
  const { items, meta } = await appointmentService.list(req.user.id, req.query);
  return ApiResponse.success(res, httpStatus.OK, "Appointments retrieved", items, meta);
});

const getById = asyncHandler(async (req, res) => {
  const appointment = await appointmentService.getById(req.user.id, req.params.id);
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

module.exports = { create, list, getById, updateStatus, reschedule, updateDetails, remove };
