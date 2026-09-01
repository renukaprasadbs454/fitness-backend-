const appointmentRepository = require("../repositories/appointment.repository");
const coachRepository = require("../repositories/coach.repository");
const ApiError = require("../utils/ApiError");
const activityFeed = require("./activityFeed.service");
const { parsePagination, buildMeta } = require("../utils/pagination");

const DAY_NAMES = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY"
];

function toHHMM(date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

async function assertNoConflict(coachId, scheduledAt, durationMinutes, excludeAppointmentId) {
  const startsAt = new Date(scheduledAt);
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60000);

  // Availability check: coach must have an active slot covering this window.
  const dayOfWeek = DAY_NAMES[startsAt.getDay()];
  const slots = await coachRepository.listAvailability(coachId);
  const withinAvailability = slots.some(
    (s) =>
      s.isActive &&
      s.dayOfWeek === dayOfWeek &&
      s.startTime <= toHHMM(startsAt) &&
      s.endTime >= toHHMM(endsAt)
  );
  if (slots.length > 0 && !withinAvailability) {
    throw ApiError.badRequest("Requested time is outside the coach's availability");
  }

  // Double-booking check: any existing PENDING/CONFIRMED appointment overlapping this window.
  const candidates = await appointmentRepository.overlappingForCoach(coachId, startsAt, endsAt);
  const conflict = candidates.some((c) => {
    if (excludeAppointmentId && c.id === excludeAppointmentId) return false;
    const cStart = new Date(c.scheduledAt);
    const cEnd = new Date(cStart.getTime() + c.durationMinutes * 60000);
    return cStart < endsAt && cEnd > startsAt;
  });
  if (conflict) {
    throw ApiError.conflict("This coach already has an appointment during that time slot");
  }
}

async function create(userId, { coachId, title, scheduledAt, durationMinutes = 45, notes }) {
  const coach = await coachRepository.findById(coachId);
  if (!coach) throw ApiError.notFound("Coach not found");

  await assertNoConflict(coachId, scheduledAt, durationMinutes);

  const appointment = await appointmentRepository.create({
    userId,
    coachId,
    title,
    scheduledAt: new Date(scheduledAt),
    durationMinutes,
    notes
  });

  await activityFeed.record(
    userId,
    "APPOINTMENT_BOOKED",
    `Booked ${title} with ${coach.user?.fullName || "coach"}`
  );

  return appointment;
}

async function list(userId, query) {
  const { page, limit, skip } = parsePagination(query);
  const [items, total] = await Promise.all([
    appointmentRepository.listForUser(userId, { skip, take: limit, status: query.status }),
    appointmentRepository.countForUser(userId, query.status)
  ]);
  return { items, meta: buildMeta(page, limit, total) };
}

async function getById(userId, id) {
  const appointment = await appointmentRepository.findById(id);
  if (!appointment) throw ApiError.notFound("Appointment not found");
  if (appointment.userId !== userId) throw ApiError.forbidden("Not your appointment");
  return appointment;
}

async function updateStatus(userId, userRole, id, status) {
  const appointment = await appointmentRepository.findById(id);
  if (!appointment) throw ApiError.notFound("Appointment not found");

  const isOwner = appointment.userId === userId;
  const isCoachOnAppointment = appointment.coach?.userId === userId;
  if (!isOwner && !isCoachOnAppointment && userRole !== "ADMIN") {
    throw ApiError.forbidden("You cannot modify this appointment");
  }

  // Users may only cancel their own appointment; coaches/admins can confirm/complete/cancel.
  if (isOwner && !isCoachOnAppointment && userRole !== "ADMIN" && status !== "CANCELLED") {
    throw ApiError.forbidden("You can only cancel your own appointment");
  }

  return appointmentRepository.updateStatus(id, status);
}

async function reschedule(userId, userRole, id, { scheduledAt, durationMinutes }) {
  const appointment = await appointmentRepository.findById(id);
  if (!appointment) throw ApiError.notFound("Appointment not found");

  const isOwner = appointment.userId === userId;
  const isCoachOnAppointment = appointment.coach?.userId === userId;
  if (!isOwner && !isCoachOnAppointment && userRole !== "ADMIN") {
    throw ApiError.forbidden("You cannot modify this appointment");
  }
  if (appointment.status === "CANCELLED" || appointment.status === "COMPLETED") {
    throw ApiError.badRequest("Cannot reschedule a cancelled or completed appointment");
  }

  await assertNoConflict(
    appointment.coachId,
    scheduledAt,
    durationMinutes || appointment.durationMinutes,
    id
  );

  return appointmentRepository.updateSchedule(id, { scheduledAt: new Date(scheduledAt), durationMinutes });
}

async function updateDetails(userId, userRole, id, { title, notes }) {
  const appointment = await appointmentRepository.findById(id);
  if (!appointment) throw ApiError.notFound("Appointment not found");

  const isOwner = appointment.userId === userId;
  const isCoachOnAppointment = appointment.coach?.userId === userId;
  if (!isOwner && !isCoachOnAppointment && userRole !== "ADMIN") {
    throw ApiError.forbidden("You cannot modify this appointment");
  }

  return appointmentRepository.updateDetails(id, { title, notes });
}

async function remove(userId, userRole, id) {
  const appointment = await appointmentRepository.findById(id);
  if (!appointment) throw ApiError.notFound("Appointment not found");

  const isOwner = appointment.userId === userId;
  const isCoachOnAppointment = appointment.coach?.userId === userId;
  if (!isOwner && !isCoachOnAppointment && userRole !== "ADMIN") {
    throw ApiError.forbidden("You cannot delete this appointment");
  }
  const isResolved = appointment.status === "CANCELLED" || appointment.status === "COMPLETED";
  const isPast = new Date(appointment.scheduledAt).getTime() < Date.now();
  if (!isResolved && !isPast) {
    throw ApiError.badRequest("Only cancelled, completed, or past appointments can be deleted");
  }

  await appointmentRepository.remove(id);
}

module.exports = { create, list, getById, updateStatus, reschedule, updateDetails, remove };
