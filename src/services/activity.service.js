const activityRepository = require("../repositories/activity.repository");
const activityFeed = require("./activityFeed.service");
const { parsePagination, buildMeta } = require("../utils/pagination");

function todayDateOnly() {
  return new Date(new Date().toISOString().slice(0, 10));
}

const STEP_MILESTONE = 10000;
const WORKOUT_MET = { CARDIO: 7, STRENGTH: 5, MUSCLE_GAIN: 5, WEIGHT_LOSS: 6, YOGA: 3, GENERAL_FITNESS: 5 };

function estimatedWorkoutCalories(completed, weightKg) {
  return completed.reduce((sum, workout) => {
    const met = WORKOUT_MET[workout.categoryKey ?? workout.plan?.categoryKey] ?? 5;
    const durationMinutes = workout.durationMinutes ?? workout.plan?.durationMinutes ?? 30;
    return sum + Math.round(met * 3.5 * weightKg / 200 * durationMinutes);
  }, 0);
}

async function logSteps(userId, input) {
  const date = input.date ? new Date(input.date) : todayDateOnly();
  const { steps, distanceKm, activeMinutes } = input;
  // Treat this as step activity only; workout calories are added from workout
  // completion records in the report, so device-wide active calories cannot
  // inflate a small step count or get counted twice.
  const caloriesBurned = Math.round(steps * 0.04);
  const previous = await activityRepository.findStepLog(userId, date);

  const log = await activityRepository.upsertStepLog(userId, date, {
    steps,
    distanceKm,
    caloriesBurned,
    activeMinutes
  });

  if (steps >= STEP_MILESTONE && (previous?.steps ?? 0) < STEP_MILESTONE) {
    await activityFeed.record(
      userId,
      "STEP_MILESTONE",
      `Hit ${steps.toLocaleString()} steps`
    );
  }

  return log;
}

async function listSteps(userId, query) {
  const { page, limit, skip } = parsePagination(query);
  const [items, total] = await Promise.all([
    activityRepository.listStepLogs(userId, { skip, take: limit, from: query.from, to: query.to }),
    activityRepository.countStepLogs(userId, { from: query.from, to: query.to })
  ]);
  return { items, meta: buildMeta(page, limit, total) };
}

function daysForRange(range) {
  if (range === "weekly") return 7;
  if (range === "monthly") return 30;
  return 1; // daily
}

async function report(userId, { range = "weekly" } = {}) {
  const days = daysForRange(range);
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);

  const [logs, feed, planCompletions, customCompletions, completedWorkouts] = await Promise.all([
    activityRepository.stepLogsSince(userId, since),
    activityRepository.recentActivityFeed(userId, 10),
    activityRepository.workoutCompletionsSince(userId, since),
    activityRepository.customWorkoutCompletionsSince(userId, since),
    activityRepository.completedWorkoutsSince(userId, since)
  ]);

  const totalSteps = logs.reduce((sum, l) => sum + l.steps, 0);
  const activityCalories = logs.reduce((sum, l) => sum + (l.caloriesBurned || 0), 0);
  const workoutRows = [...completedWorkouts.plans, ...completedWorkouts.custom];
  const workoutCaloriesByDate = new Map();
  for (const workout of workoutRows) {
    const date = workout.completedAt.toISOString().slice(0, 10);
    const calories = workout.caloriesBurned ?? estimatedWorkoutCalories([workout], completedWorkouts.weightKg);
    workoutCaloriesByDate.set(date, (workoutCaloriesByDate.get(date) ?? 0) + calories);
  }
  const workoutCalories = [...workoutCaloriesByDate.values()].reduce((sum, value) => sum + value, 0);
  const totalCalories = activityCalories + workoutCalories;
  const totalActiveMinutes = logs.reduce((sum, l) => sum + (l.activeMinutes || 0), 0);
  const totalDistanceKm = logs.reduce((sum, l) => sum + Number(l.distanceKm || 0), 0);
  const daysLogged = logs.length;

  return {
    range,
    since: since.toISOString().slice(0, 10),
    totals: {
      steps: totalSteps,
      calories: totalCalories,
      activityCalories,
      workoutCalories,
      activeMinutes: totalActiveMinutes,
      distanceKm: Math.round(totalDistanceKm * 100) / 100,
      workoutsCompleted: planCompletions + customCompletions
    },
    averages: {
      stepsPerDay: daysLogged ? Math.round(totalSteps / daysLogged) : 0
    },
    daysLogged,
    dailyBreakdown: [...new Set([
      ...logs.map((l) => l.date.toISOString().slice(0, 10)),
      ...workoutCaloriesByDate.keys()
    ])].sort().map((date) => {
      const log = logs.find((entry) => entry.date.toISOString().slice(0, 10) === date);
      const activityKcal = log?.caloriesBurned || 0;
      const workoutKcal = workoutCaloriesByDate.get(date) ?? 0;
      return {
        date,
        steps: log?.steps ?? 0,
        caloriesBurned: activityKcal + workoutKcal,
        activityCalories: activityKcal,
        workoutCalories: workoutKcal,
        activeMinutes: log?.activeMinutes ?? 0
      };
    }),
    recentActivity: feed.map((f) => f.description)
  };
}

async function listFeed(userId, query) {
  const { page, limit, skip } = parsePagination(query);
  const [items, total] = await Promise.all([
    activityRepository.listActivityFeed(userId, { skip, take: limit }),
    activityRepository.countActivityFeed(userId)
  ]);
  return { items, meta: buildMeta(page, limit, total) };
}

module.exports = { logSteps, listSteps, report, listFeed };
