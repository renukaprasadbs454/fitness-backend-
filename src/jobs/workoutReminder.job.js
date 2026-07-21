const workoutRepository = require("../repositories/workout.repository");
const userRepository = require("../repositories/user.repository");
const notificationService = require("../services/notification.service");
const logger = require("../config/logger");

// In-memory dedupe so a restart-free server only sends this once per
// calendar day per user, without needing a schema field for it (there is
// no per-user "scheduled workout time" entity yet — see README for why
// this is a daily nudge rather than a time-slot reminder).
let lastRunDateKey = null;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function runWorkoutReminderSweep() {
  const key = todayKey();
  if (lastRunDateKey === key) return { remindersSent: 0, skipped: "already run today" };

  const [activeUserIds, completedTodayIds] = await Promise.all([
    userRepository.listActiveUserIdsByRole("USER"),
    workoutRepository.completedTodayUserIds()
  ]);

  const targets = activeUserIds.filter((id) => !completedTodayIds.has(id));
  let sent = 0;

  for (const userId of targets) {
    try {
      await notificationService.notify(
        userId,
        "WORKOUT_REMINDER",
        "Time to move!",
        "You haven't logged a workout today — even 15 minutes keeps the streak alive.",
        {}
      );
      sent += 1;
    } catch (err) {
      logger.error(`[reminders] Failed to notify user ${userId} for workout reminder: ${err.message}`);
    }
  }

  lastRunDateKey = key;
  return { remindersSent: sent };
}

module.exports = { runWorkoutReminderSweep };
