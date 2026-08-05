const workoutRepository = require("../repositories/workout.repository");
const notificationService = require("../services/notification.service");
const logger = require("../config/logger");

/**
 * Runs every REMINDER_SWEEP_CRON tick (default: every 15 min). Finds
 * SCHEDULED workouts starting in the next 60 minutes that haven't had a
 * reminder sent yet, notifies the user, and marks them reminded so the
 * next sweep doesn't double-send. Mirrors appointmentReminder.job.js.
 */
async function runScheduledWorkoutReminderSweep() {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + 60 * 60 * 1000);

  const due = await workoutRepository.dueScheduleForReminder(now, windowEnd);
  if (!due.length) return { remindersSent: 0 };

  for (const schedule of due) {
    const minutesUntil = Math.round((new Date(schedule.scheduledAt).getTime() - now.getTime()) / 60000);
    try {
      await notificationService.notify(
        schedule.userId,
        "WORKOUT_REMINDER",
        "Upcoming workout",
        `${schedule.plan.title} is scheduled in about ${minutesUntil} min`,
        { data: { scheduledWorkoutId: schedule.id } }
      );
      await workoutRepository.markScheduleReminded(schedule.id);
    } catch (err) {
      logger.error(`[reminders] Failed to notify scheduled workout ${schedule.id}: ${err.message}`);
    }
  }

  return { remindersSent: due.length };
}

module.exports = { runScheduledWorkoutReminderSweep };
