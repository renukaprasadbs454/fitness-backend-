const cron = require("node-cron");
const env = require("../config/env");
const logger = require("../config/logger");
const { runAppointmentReminderSweep } = require("./appointmentReminder.job");
const { runWorkoutReminderSweep } = require("./workoutReminder.job");

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

  tasks = [appointmentTask, workoutTask];
}

function stopCronJobs() {
  tasks.forEach((t) => t.stop());
  tasks = [];
}

module.exports = { startCronJobs, stopCronJobs };
