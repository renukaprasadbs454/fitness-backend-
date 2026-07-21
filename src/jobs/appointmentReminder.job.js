const appointmentRepository = require("../repositories/appointment.repository");
const notificationService = require("../services/notification.service");
const logger = require("../config/logger");

/**
 * Runs every REMINDER_SWEEP_CRON tick (default: every 15 min). Finds
 * CONFIRMED appointments starting in the next 60 minutes that haven't
 * had a reminder sent yet, notifies the user, and marks them reminded
 * so the next sweep doesn't double-send.
 */
async function runAppointmentReminderSweep() {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + 60 * 60 * 1000);

  const due = await appointmentRepository.dueForReminder(now, windowEnd);
  if (!due.length) return { remindersSent: 0 };

  for (const appt of due) {
    const minutesUntil = Math.round((new Date(appt.scheduledAt).getTime() - now.getTime()) / 60000);
    try {
      await notificationService.notify(
        appt.userId,
        "APPOINTMENT_REMINDER",
        "Upcoming appointment",
        `${appt.title} with ${appt.coach?.user?.fullName || "your coach"} in about ${minutesUntil} min`,
        { data: { appointmentId: appt.id } }
      );
      await appointmentRepository.markReminded(appt.id);
    } catch (err) {
      logger.error(`[reminders] Failed to notify appointment ${appt.id}: ${err.message}`);
    }
  }

  return { remindersSent: due.length };
}

module.exports = { runAppointmentReminderSweep };
