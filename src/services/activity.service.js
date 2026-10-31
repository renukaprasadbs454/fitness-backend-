const activityRepository = require("../repositories/activity.repository");
const activityFeed = require("./activityFeed.service");
const { parsePagination, buildMeta } = require("../utils/pagination");

function todayDateOnly() {
  return new Date(new Date().toISOString().slice(0, 10));
}

const STEP_MILESTONE = 10000;

async function logSteps(userId, input) {
  const date = input.date ? new Date(input.date) : todayDateOnly();
  const { steps, distanceKm, caloriesBurned, activeMinutes } = input;

  const log = await activityRepository.upsertStepLog(userId, date, {
    steps,
    distanceKm,
    caloriesBurned,
    activeMinutes
  });

  if (steps >= STEP_MILESTONE) {
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

  const [logs, feed, planCompletions, customCompletions] = await Promise.all([
    activityRepository.stepLogsSince(userId, since),
    activityRepository.recentActivityFeed(userId, 10),
    activityRepository.workoutCompletionsSince(userId, since),
    activityRepository.customWorkoutCompletionsSince(userId, since)
  ]);

  const totalSteps = logs.reduce((sum, l) => sum + l.steps, 0);
  const totalCalories = logs.reduce((sum, l) => sum + (l.caloriesBurned || 0), 0);
  const totalActiveMinutes = logs.reduce((sum, l) => sum + (l.activeMinutes || 0), 0);
  const totalDistanceKm = logs.reduce((sum, l) => sum + Number(l.distanceKm || 0), 0);
  const daysLogged = logs.length;

  return {
    range,
    since: since.toISOString().slice(0, 10),
    totals: {
      steps: totalSteps,
      calories: totalCalories,
      activeMinutes: totalActiveMinutes,
      distanceKm: Math.round(totalDistanceKm * 100) / 100,
      workoutsCompleted: planCompletions + customCompletions
    },
    averages: {
      stepsPerDay: daysLogged ? Math.round(totalSteps / daysLogged) : 0
    },
    daysLogged,
    dailyBreakdown: logs.map((l) => ({
      date: l.date.toISOString().slice(0, 10),
      steps: l.steps,
      caloriesBurned: l.caloriesBurned,
      activeMinutes: l.activeMinutes
    })),
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
