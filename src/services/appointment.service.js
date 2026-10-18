const appointmentRepository = require("../repositories/appointment.repository");
const coachRepository = require("../repositories/coach.repository");
const userRepository = require("../repositories/user.repository");
const ApiError = require("../utils/ApiError");
const logger = require("../config/logger");
const activityFeed = require("./activityFeed.service");
const meetingService = require("./meeting.service");
const chatService = require("./chat.service");
const chatRepository = require("../repositories/chat.repository");
const notificationService = require("./notification.service");
const { parsePagination, buildMeta } = require("../utils/pagination");

// Coach availability ("09:00"-"17:00") is entered assuming IST, so it must be
// read back in IST too — using the server's local timezone (Date#getHours /
// Date#getDay) works only by coincidence on a machine already set to IST and
// silently breaks once deployed to a host running in UTC (e.g. Render).
const IST_TIME_ZONE = "Asia/Kolkata";

function getIstParts(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: IST_TIME_ZONE,
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  const hour = get("hour") === "24" ? "00" : get("hour");
  return { dayOfWeek: get("weekday").toUpperCase(), hhmm: `${hour}:${get("minute")}` };
}

function toHHMM(date) {
  return getIstParts(date).hhmm;
}

function formatIst(date) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(date));
}

// `checkAvailability` is skipped when a coach schedules a session themselves:
// their weekly slots describe when clients may book, not when the coach may work.
async function assertNoConflict(coachId, scheduledAt, durationMinutes, excludeAppointmentId, { checkAvailability = true } = {}) {
  const startsAt = new Date(scheduledAt);
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60000);

  if (checkAvailability) {
    // Availability check: coach must have an active slot covering this window.
    const dayOfWeek = getIstParts(startsAt).dayOfWeek;
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

async function create(userId, { coachId, title, scheduledAt, durationMinutes = 45, notes }, { onChatMessage } = {}) {
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

  // The coach's custom "thanks for booking" note lands in the client's Chats.
  // Best-effort: a chat hiccup must never make a successful booking look failed.
  try {
    const sent = await chatService.sendBookingMessage(userId, coachId);
    if (sent && onChatMessage) onChatMessage(userId, sent.message);
  } catch (err) {
    logger.warn(`[chat] booking message failed: ${err.message}`);
  }

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
  if (appointment.userId !== userId && appointment.coach?.userId !== userId) {
    throw ApiError.forbidden("Not your appointment");
  }
  return appointment;
}

// ── Meeting links ─────────────────────────────────────────

async function notifyMeetingLink(appointment) {
  await notificationService.notify(
    appointment.userId,
    "APPOINTMENT_REMINDER",
    "Meeting link ready",
    `Your join link for "${appointment.title}" on ${formatIst(appointment.scheduledAt)} is ready.`,
    { data: { appointmentId: appointment.id } }
  );
}

/** Best-effort Meet link for a newly confirmed session; never blocks the confirmation itself. */
async function autoGenerateMeeting(appointment) {
  if (appointment.meetingLink || !(await meetingService.isConnected())) return appointment;
  try {
    const meeting = await meetingService.createMeetLink(appointment);
    const updated = await appointmentRepository.updateMeeting(appointment.id, { ...meeting, meetingProvider: "GOOGLE_MEET" });
    await notifyMeetingLink(updated);
    return updated;
  } catch (err) {
    logger.warn(`[meet] Auto-generate for appointment ${appointment.id} failed: ${err.message}`);
    return appointment;
  }
}

async function loadForMeetingChange(userId, userRole, id) {
  const appointment = await appointmentRepository.findById(id);
  if (!appointment) throw ApiError.notFound("Appointment not found");
  if (appointment.coach?.userId !== userId && userRole !== "ADMIN") {
    throw ApiError.forbidden("Only the session's coach or an admin can manage its meeting link");
  }
  if (appointment.status === "CANCELLED" || appointment.status === "COMPLETED") {
    throw ApiError.badRequest("This session is closed, so its meeting link can't be changed");
  }
  return appointment;
}

/** Sets (or clears, with null) a pasted meeting link. Replaces any generated meeting. */
async function setMeetingLink(userId, userRole, id, meetingLink) {
  const appointment = await loadForMeetingChange(userId, userRole, id);
  if (appointment.meetingEventId) await meetingService.cancelMeeting(appointment.meetingEventId);

  const updated = await appointmentRepository.updateMeeting(
    id,
    meetingLink
      ? { meetingLink, meetingProvider: "MANUAL", meetingEventId: null }
      : { meetingLink: null, meetingProvider: null, meetingEventId: null }
  );
  if (meetingLink && meetingLink !== appointment.meetingLink) await notifyMeetingLink(updated);
  return updated;
}

/** Creates a fresh, unique Google Meet link through the platform account. */
async function generateMeetingLink(userId, userRole, id) {
  const appointment = await loadForMeetingChange(userId, userRole, id);
  const meeting = await meetingService.createMeetLink(appointment);
  if (appointment.meetingEventId) await meetingService.cancelMeeting(appointment.meetingEventId);

  const updated = await appointmentRepository.updateMeeting(id, { ...meeting, meetingProvider: "GOOGLE_MEET" });
  await notifyMeetingLink(updated);
  return updated;
}

// ── Status, schedule, details ─────────────────────────────

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

  let updated = await appointmentRepository.updateStatus(id, status);

  if (status === "CONFIRMED") {
    updated = await autoGenerateMeeting(updated);
  } else if (status === "CANCELLED" && (appointment.meetingEventId || appointment.meetingLink)) {
    await meetingService.cancelMeeting(appointment.meetingEventId);
    updated = await appointmentRepository.updateMeeting(id, { meetingLink: null, meetingProvider: null, meetingEventId: null });
  }

  return updated;
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

  // Weekly availability describes when clients may book. A coach (or admin) moving a session
  // isn't bound by it; a client moving their own booking is.
  await assertNoConflict(
    appointment.coachId,
    scheduledAt,
    durationMinutes || appointment.durationMinutes,
    id,
    { checkAvailability: isOwner && !isCoachOnAppointment && userRole !== "ADMIN" }
  );

  const updated = await appointmentRepository.updateSchedule(id, { scheduledAt: new Date(scheduledAt), durationMinutes });
  await meetingService.rescheduleMeeting(updated);

  // Tell everyone on the session except whoever moved it. Best-effort: never undoes the move.
  const recipients = [updated.userId, updated.coach?.userId].filter((recipient) => recipient && recipient !== userId);
  for (const recipient of recipients) {
    await notificationService
      .notify(
        recipient,
        "APPOINTMENT_REMINDER",
        "Session rescheduled",
        `"${updated.title}" has moved to ${formatIst(updated.scheduledAt)}.`,
        { data: { appointmentId: updated.id } }
      )
      .catch((err) => logger.warn(`[appointments] reschedule notice failed: ${err.message}`));
  }
  return updated;
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

  await meetingService.cancelMeeting(appointment.meetingEventId);
  await appointmentRepository.remove(id);
}

/**
 * A user's coach was swapped or removed: cancel their upcoming sessions with the old
 * coach (clearing any meeting link) and tell both people. Past/completed sessions stay
 * as history. Their chat with that coach drops out of the Chats tab on its own, because
 * chats are listed only for coaches the user is assigned to or has an active session with.
 */
async function releaseUpcomingSessions(userId, coachId, reason = "your coach was changed") {
  const upcoming = await appointmentRepository.upcomingForUserWithCoach(userId, coachId);
  for (const appt of upcoming) {
    await appointmentRepository.updateStatus(appt.id, "CANCELLED");
    if (appt.meetingEventId) await meetingService.cancelMeeting(appt.meetingEventId);
    if (appt.meetingLink || appt.meetingEventId) {
      await appointmentRepository.updateMeeting(appt.id, { meetingLink: null, meetingProvider: null, meetingEventId: null });
    }
    const when = formatIst(appt.scheduledAt);
    await notificationService
      .notify(userId, "SYSTEM", "Session cancelled", `Your session "${appt.title}" on ${when} with ${appt.coach?.user?.fullName || "your coach"} was cancelled because ${reason}.`, {
        data: { appointmentId: appt.id }
      })
      .catch((err) => logger.warn(`[appointments] notify user failed: ${err.message}`));
    if (appt.coach?.userId) {
      await notificationService
        .notify(appt.coach.userId, "SYSTEM", "Session cancelled", `"${appt.title}" on ${when} with ${appt.user?.fullName || "a client"} was cancelled because the client was reassigned.`, {
          data: { appointmentId: appt.id }
        })
        .catch((err) => logger.warn(`[appointments] notify coach failed: ${err.message}`));
    }
  }
  // Take the chat with that coach off the user's list (history is kept for if they return).
  await chatRepository.closeRoomForUser(userId, coachId);
  return upcoming.length;
}

// ── Coach-scheduled sessions ──────────────────────────────

/** The clients a coach can schedule sessions with: the same rule `scheduleSessions` enforces. */
async function schedulableClients(coachUserId) {
  const coach = await coachRepository.findByUserId(coachUserId);
  if (!coach) throw ApiError.forbidden("Coach profile not found for this account");

  const ids = [...(await chatService.eligibleClientIdsForCoach(coach.id))];
  const users = ids.length ? await userRepository.listClientsLiteByIds(ids) : [];
  return {
    clients: users.map(({ assignedCoachId, ...user }) => ({ ...user, assigned: assignedCoachId === coach.id })),
    // The head coach can also schedule with any other client, found through the client search.
    canScheduleAnyone: Boolean(coach.isHeadCoach)
  };
}

/**
 * Lets a coach put one session — or a weekly series of up to 12 — on a
 * client's calendar. Sessions are created CONFIRMED. Each one gets its own
 * Google Meet link when the platform account is connected, unless the coach
 * supplies a link of their own. Slots that clash with existing bookings are
 * skipped and reported back rather than failing the whole series.
 */
async function scheduleSessions(coachUserId, { userId, title, scheduledAt, durationMinutes = 45, notes, repeatWeeks = 0, meetingLink }) {
  const coach = await coachRepository.findByUserId(coachUserId);
  if (!coach) throw ApiError.forbidden("Coach profile not found for this account");

  const client = await userRepository.findById(userId);
  if (!client || client.role !== "USER") throw ApiError.notFound("Client not found");

  // The head coach can work with any client (as with workouts and chats). Other coaches only with
  // clients who are currently theirs: assigned to them, or booked with them since any coach swap.
  if (!coach.isHeadCoach && !(await chatService.chatEligibleCoachIds(userId)).has(coach.id)) {
    throw ApiError.forbidden("You can only schedule sessions with your own clients");
  }

  const generateMeet = !meetingLink && (await meetingService.isConnected());
  const created = [];
  const skipped = [];

  for (let week = 0; week <= repeatWeeks; week += 1) {
    const when = new Date(new Date(scheduledAt).getTime() + week * 7 * 24 * 60 * 60 * 1000);
    if (when.getTime() < Date.now()) {
      skipped.push({ scheduledAt: when, reason: "That time has already passed" });
      continue;
    }

    try {
      await assertNoConflict(coach.id, when, durationMinutes, undefined, { checkAvailability: false });
      let appointment = await appointmentRepository.create({
        userId,
        coachId: coach.id,
        title,
        scheduledAt: when,
        durationMinutes,
        notes,
        status: "CONFIRMED",
        ...(meetingLink ? { meetingLink, meetingProvider: "MANUAL" } : {})
      });

      if (generateMeet) {
        try {
          const meeting = await meetingService.createMeetLink(appointment);
          appointment = await appointmentRepository.updateMeeting(appointment.id, { ...meeting, meetingProvider: "GOOGLE_MEET" });
        } catch (err) {
          logger.warn(`[meet] Link for scheduled session ${appointment.id} failed: ${err.message}`);
        }
      }
      created.push(appointment);
    } catch (err) {
      skipped.push({ scheduledAt: when, reason: err.message });
    }
  }

  if (created.length) {
    await notificationService.notify(
      userId,
      "APPOINTMENT_REMINDER",
      created.length > 1 ? `${created.length} sessions scheduled` : "Session scheduled",
      `${coach.user?.fullName || "Your coach"} scheduled "${title}" starting ${formatIst(created[0].scheduledAt)}.`,
      { data: { appointmentId: created[0].id } }
    );
    await activityFeed.record(userId, "APPOINTMENT_BOOKED", `${coach.user?.fullName || "Your coach"} scheduled ${title}`);
  }

  return { created, skipped };
}

module.exports = {
  create,
  list,
  getById,
  updateStatus,
  reschedule,
  updateDetails,
  remove,
  setMeetingLink,
  generateMeetingLink,
  schedulableClients,
  scheduleSessions,
  releaseUpcomingSessions
};
