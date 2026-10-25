const cron = require("node-cron");
const env = require("../config/env");
const logger = require("../config/logger");
const { runAppointmentReminderSweep } = require("./appointmentReminder.job");
const { runWorkoutReminderSweep } = require("./workoutReminder.job");
const { runScheduledWorkoutReminderSweep } = require("./scheduledWorkoutReminder.job");
const { runCleanupSweep } = require("./cleanup.job");

let tasks = [];

function startCronJobs() {
  const appointmentTask = cron.schedule(env.cron.reminderSweepCron, async () => {
    try {
      const result = await runAppointmentReminderSweep();
      if (result.remindersSent) logger.info(`[cron] Appointment reminders sent: ${result.remindersSent}`);
    } catch (err) {
      logger.error(`[cron] Appointment reminder sweep failed: ${err.message}`);
    }
  });

  // Workout nudges run on the same tick cadence but self-dedupe to once/day.
  const workoutTask = cron.schedule(env.cron.reminderSweepCron, async () => {
    try {
      const result = await runWorkoutReminderSweep();
      if (result.remindersSent) logger.info(`[cron] Workout reminders sent: ${result.remindersSent}`);
    } catch (err) {
      logger.error(`[cron] Workout reminder sweep failed: ${err.message}`);
    }
  });

  // Time-slot-specific reminders for workouts the user actually scheduled
  // (distinct from workoutTask's generic "you haven't logged anything today" nudge).
  const scheduledWorkoutTask = cron.schedule(env.cron.reminderSweepCron, async () => {
    try {
      const result = await runScheduledWorkoutReminderSweep();
      if (result.remindersSent) logger.info(`[cron] Scheduled workout reminders sent: ${result.remindersSent}`);
    } catch (err) {
      logger.error(`[cron] Scheduled workout reminder sweep failed: ${err.message}`);
    }
  });

  // Nightly at 03:30 IST: drop expired login tokens and verification codes.
  const cleanupTask = cron.schedule(
    "30 3 * * *",
    async () => {
      try {
        const result = await runCleanupSweep();
        logger.info(`[cron] Cleanup: ${result.tokensDeleted} expired tokens, ${result.otpsDeleted} expired codes removed`);
      } catch (err) {
        logger.error(`[cron] Cleanup sweep failed: ${err.message}`);
      }
    },
    { timezone: "Asia/Kolkata" }
  );

  tasks = [appointmentTask, workoutTask, scheduledWorkoutTask, cleanupTask];
}

function stopCronJobs() {
  tasks.forEach((t) => t.stop());
  tasks = [];
}

module.exports = { startCronJobs, stopCronJobs };
