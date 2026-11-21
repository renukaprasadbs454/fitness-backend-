const appointmentRepository = require("../repositories/appointment.repository");
const notificationService = require("../services/notification.service");
const logger = require("../config/logger");

async function sendAppointmentReminder(appointmentId, expectedScheduledAt) {
  const expectedTime = new Date(expectedScheduledAt);
  const now = new Date();
  if (Number.isNaN(expectedTime.getTime()) || expectedTime <= now) return false;

  const sentAt = new Date();
  const claimed = await appointmentRepository.claimReminder(appointmentId, expectedTime, sentAt);
  if (!claimed.count) return false;

  try {
    const appointment = await appointmentRepository.findById(appointmentId);
    if (
      !appointment ||
      appointment.status !== "CONFIRMED" ||
      new Date(appointment.scheduledAt).getTime() !== expectedTime.getTime() ||
      !appointment.reminderSentAt ||
      new Date(appointment.reminderSentAt).getTime() !== sentAt.getTime()
    ) {
      await appointmentRepository.releaseReminderClaim(appointmentId, sentAt);
      return false;
    }

    const minutesUntil = Math.max(1, Math.round((expectedTime.getTime() - Date.now()) / 60000));
    const meetingSuffix = appointment.meetingLink ? ". Tap to join the call." : "";
    await notificationService.notify(
      appointment.userId,
      "APPOINTMENT_REMINDER",
      "Upcoming session reminder",
      `Your session "${appointment.title}" with ${appointment.coach?.user?.fullName || "your coach"} starts in about ${minutesUntil} min${meetingSuffix}`,
      { data: { appointmentId: appointment.id, meetingLink: appointment.meetingLink || "" } }
    );

    if (appointment.coach?.userId) {
      await notificationService.notify(
        appointment.coach.userId,
        "APPOINTMENT_REMINDER",
        "Upcoming session with client",
        `Session "${appointment.title}" with ${appointment.user?.fullName || "your client"} starts in about ${minutesUntil} min${meetingSuffix}`,
        { data: { appointmentId: appointment.id, meetingLink: appointment.meetingLink || "" } }
      ).catch((err) => logger.warn(`[reminders] Coach reminder failed for appointment ${appointment.id}: ${err.message}`));
    }
    return true;
  } catch (err) {
    await appointmentRepository.releaseReminderClaim(appointmentId, sentAt).catch(() => {});
    throw err;
  }
}

/** Find confirmed appointments starting within the next hour as a recovery path. */
async function runAppointmentReminderSweep() {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + 60 * 60 * 1000);
  const due = await appointmentRepository.dueForReminder(now, windowEnd);
  let remindersSent = 0;

  for (const appointment of due) {
    try {
      if (await sendAppointmentReminder(appointment.id, appointment.scheduledAt)) remindersSent += 1;
    } catch (err) {
      logger.error(`[reminders] Failed to notify appointment ${appointment.id}: ${err.message}`);
    }
  }

  return { remindersSent };
}

module.exports = { runAppointmentReminderSweep, sendAppointmentReminder };
