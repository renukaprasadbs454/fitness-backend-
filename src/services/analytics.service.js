const analyticsRepository = require("../repositories/analytics.repository");
const workoutRepository = require("../repositories/workout.repository");
const prisma = require("../database/prismaClient");

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * User growth trend: daily registrations over the given window, plus a
 * running total so the frontend can render both a bar chart (daily) and
 * a line chart (cumulative) from one payload.
 */
async function userGrowth({ days = 30 } = {}) {
  const since = daysAgo(days);
  const raw = await analyticsRepository.registrationsByDay(since);
  let running = await prisma.user.count({ where: { createdAt: { lt: since } } });

  const series = raw.map((row) => {
    running += row.count;
    return { date: row.date, newUsers: row.count, cumulativeUsers: running };
  });

  return { windowDays: days, series };
}

/**
 * Engagement metrics: active users (logged in recently), daily workout
 * completion trend, and appointment funnel breakdown by status.
 */
async function engagementMetrics({ days = 30 } = {}) {
  const since = daysAgo(days);
  const [active7d, active30d, workoutTrend, appointmentsByStatus, totalCompletions] = await Promise.all([
    analyticsRepository.activeUsersSince(daysAgo(7)),
    analyticsRepository.activeUsersSince(daysAgo(30)),
    analyticsRepository.workoutCompletionsByDay(since),
    analyticsRepository.appointmentsByStatus(),
    analyticsRepository.totalWorkoutCompletions()
  ]);

  return {
    activeUsers: { last7Days: active7d, last30Days: active30d },
    workoutCompletionTrend: workoutTrend,
    totalWorkoutCompletions: totalCompletions,
    appointmentsByStatus
  };
}

/**
 * Workout stats: completion breakdown by category and the top-performing
 * plans by completion count.
 */
async function workoutStats() {
  const [byCategory, topRaw] = await Promise.all([
    analyticsRepository.completionsByCategory(),
    analyticsRepository.mostCompletedPlans(5)
  ]);

  const topPlans = await Promise.all(
    topRaw.map(async (row) => {
      const plan = await workoutRepository.findPlanById(row.planId);
      return { planId: row.planId, title: plan?.title || "Deleted plan", completions: row._count._all };
    })
  );

  return { completionsByCategory: byCategory, topPlans };
}

/**
 * Coach performance: appointment volume + completion rate per coach,
 * a reasonable stand-in for "coach performance" given the current
 * schema has no explicit rating/review model.
 */
async function coachPerformance() {
  const [coaches, counts] = await Promise.all([
    analyticsRepository.allCoachesWithUserInfo(),
    analyticsRepository.coachAppointmentCounts()
  ]);

  const byCoach = new Map();
  for (const coach of coaches) {
    byCoach.set(coach.id, {
      coachId: coach.id,
      name: coach.user.fullName,
      specialties: coach.specialties,
      totalAppointments: 0,
      completed: 0,
      cancelled: 0
    });
  }

  for (const row of counts) {
    const entry = byCoach.get(row.coachId);
    if (!entry) continue;
    entry.totalAppointments += row._count._all;
    if (row.status === "COMPLETED") entry.completed += row._count._all;
    if (row.status === "CANCELLED") entry.cancelled += row._count._all;
  }

  return Array.from(byCoach.values())
    .map((c) => ({
      ...c,
      completionRate: c.totalAppointments ? Math.round((c.completed / c.totalAppointments) * 100) : 0
    }))
    .sort((a, b) => b.totalAppointments - a.totalAppointments);
}

async function contentEngagement() {
  const top = await analyticsRepository.topContentByViews(5);
  return { topContent: top };
}

/**
 * Single combined payload for the main analytics dashboard view —
 * avoids the frontend firing 5 separate requests on first paint.
 */
async function overview() {
  const [growth, engagement, workouts, coaches, content] = await Promise.all([
    userGrowth({ days: 30 }),
    engagementMetrics({ days: 30 }),
    workoutStats(),
    coachPerformance(),
    contentEngagement()
  ]);

  return {
    userGrowth: growth,
    engagement,
    workouts,
    coaches: coaches.slice(0, 10),
    content
  };
}

module.exports = { userGrowth, engagementMetrics, workoutStats, coachPerformance, contentEngagement, overview };
