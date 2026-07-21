const prisma = require("../database/prismaClient");

const analyticsRepository = {
  // ── Growth ─────────────────────────────────────────────
  registrationsByDay: (since) =>
    prisma.$queryRaw`
      SELECT DATE(created_at) AS date, COUNT(*)::int AS count
      FROM users
      WHERE created_at >= ${since}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `,

  // ── Engagement ─────────────────────────────────────────
  activeUsersSince: (since) =>
    prisma.user.count({ where: { role: "USER", lastLoginAt: { gte: since } } }),

  workoutCompletionsByDay: (since) =>
    prisma.$queryRaw`
      SELECT DATE(completed_at) AS date, COUNT(*)::int AS count
      FROM workout_completions
      WHERE completed_at >= ${since}
      GROUP BY DATE(completed_at)
      ORDER BY date ASC
    `,

  totalWorkoutCompletions: () => prisma.workoutCompletion.count(),

  appointmentsByStatus: async () => {
    const rows = await prisma.appointment.groupBy({ by: ["status"], _count: { _all: true } });
    return rows.reduce((acc, r) => ({ ...acc, [r.status]: r._count._all }), {});
  },

  // ── Workout stats ────────────────────────────────────────
  completionsByCategory: async () => {
    const rows = await prisma.workoutCompletion.findMany({
      include: { plan: { select: { categoryKey: true } } }
    });
    return rows.reduce((acc, r) => {
      const key = r.plan.categoryKey;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  },

  mostCompletedPlans: (take = 5) =>
    prisma.workoutCompletion.groupBy({
      by: ["planId"],
      _count: { _all: true },
      orderBy: { _count: { planId: "desc" } },
      take
    }),

  // ── Coach performance ────────────────────────────────────
  coachAppointmentCounts: async () => {
    const rows = await prisma.appointment.groupBy({
      by: ["coachId", "status"],
      _count: { _all: true }
    });
    return rows;
  },

  allCoachesWithUserInfo: () =>
    prisma.coach.findMany({
      select: { id: true, userId: true, user: { select: { fullName: true } }, specialties: true }
    }),

  // ── Content engagement (Phase 3 CMS) ────────────────────
  topContentByViews: (take = 5) =>
    prisma.contentPost.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { viewCount: "desc" },
      take,
      select: { id: true, title: true, type: true, viewCount: true }
    })
};

module.exports = analyticsRepository;
