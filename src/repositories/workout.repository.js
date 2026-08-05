const prisma = require("../database/prismaClient");

const planInclude = {
  exercises: {
    orderBy: { sortOrder: "asc" },
    include: { exercise: true }
  }
};

const workoutRepository = {
  // ── Plans ──────────────────────────────────────────────
  listPlans: ({ skip, take, category, difficulty }) =>
    prisma.workoutPlan.findMany({
      where: {
        isActive: true,
        categoryKey: category || undefined,
        difficulty: difficulty || undefined
      },
      include: planInclude,
      orderBy: { createdAt: "desc" },
      skip,
      take
    }),

  countPlans: ({ category, difficulty }) =>
    prisma.workoutPlan.count({
      where: { isActive: true, categoryKey: category || undefined, difficulty: difficulty || undefined }
    }),

  findPlanById: (id) => prisma.workoutPlan.findUnique({ where: { id }, include: planInclude }),

  plansByCategory: (categoryKey, take = 5) =>
    prisma.workoutPlan.findMany({
      where: { isActive: true, categoryKey },
      include: planInclude,
      orderBy: { createdAt: "desc" },
      take
    }),

  createPlan: (data, exerciseRefs = []) =>
    prisma.workoutPlan.create({
      data: {
        ...data,
        exercises: exerciseRefs.length
          ? {
              create: exerciseRefs.map((e, idx) => ({
                exerciseId: e.exerciseId,
                sortOrder: e.sortOrder ?? idx,
                sets: e.sets,
                reps: e.reps
              }))
            }
          : undefined
      },
      include: planInclude
    }),

  updatePlan: async (id, data, exerciseRefs) => {
    if (exerciseRefs) {
      await prisma.workoutPlanExercise.deleteMany({ where: { planId: id } });
    }
    return prisma.workoutPlan.update({
      where: { id },
      data: {
        ...data,
        exercises: exerciseRefs
          ? {
              create: exerciseRefs.map((e, idx) => ({
                exerciseId: e.exerciseId,
                sortOrder: e.sortOrder ?? idx,
                sets: e.sets,
                reps: e.reps
              }))
            }
          : undefined
      },
      include: planInclude
    });
  },

  deletePlan: (id) => prisma.workoutPlan.delete({ where: { id } }),

  // ── Exercises (library) ───────────────────────────────
  listExercises: ({ skip, take, q }) =>
    prisma.exercise.findMany({
      where: q ? { name: { contains: q, mode: "insensitive" } } : undefined,
      orderBy: { name: "asc" },
      skip,
      take
    }),

  countExercises: (q) =>
    prisma.exercise.count({ where: q ? { name: { contains: q, mode: "insensitive" } } : undefined }),

  findExerciseById: (id) => prisma.exercise.findUnique({ where: { id } }),

  createExercise: (data) => prisma.exercise.create({ data }),

  updateExercise: (id, data) => prisma.exercise.update({ where: { id }, data }),

  deleteExercise: (id) => prisma.exercise.delete({ where: { id } }),

  // ── Completions ────────────────────────────────────────
  createCompletion: (userId, planId) => prisma.workoutCompletion.create({ data: { userId, planId } }),

  completedTodayUserIds: async () => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const rows = await prisma.workoutCompletion.findMany({
      where: { completedAt: { gte: startOfDay } },
      select: { userId: true },
      distinct: ["userId"]
    });
    return new Set(rows.map((r) => r.userId));
  },

  completionsByUser: (userId, take = 20) =>
    prisma.workoutCompletion.findMany({
      where: { userId },
      orderBy: { completedAt: "desc" },
      take,
      include: { plan: { select: { categoryKey: true, difficulty: true, title: true } } }
    }),

  // ── Scheduled workouts (Calendar "workout schedule") ────
  scheduleInclude: {
    plan: { select: { title: true, categoryKey: true, difficulty: true, durationMinutes: true, accentColor: true } }
  },

  createSchedule: (userId, planId, scheduledAt) =>
    prisma.scheduledWorkout.create({
      data: { userId, planId, scheduledAt },
      include: workoutRepository.scheduleInclude
    }),

  listSchedule: (userId, { from, to, status } = {}) =>
    prisma.scheduledWorkout.findMany({
      where: {
        userId,
        status: status || undefined,
        scheduledAt: { gte: from || undefined, lte: to || undefined }
      },
      include: workoutRepository.scheduleInclude,
      orderBy: { scheduledAt: "asc" }
    }),

  upcomingScheduleForUser: (userId, take = 20) =>
    prisma.scheduledWorkout.findMany({
      where: { userId, status: "SCHEDULED", scheduledAt: { gte: new Date() } },
      include: workoutRepository.scheduleInclude,
      orderBy: { scheduledAt: "asc" },
      take
    }),

  findScheduleById: (id) =>
    prisma.scheduledWorkout.findUnique({ where: { id }, include: workoutRepository.scheduleInclude }),

  updateScheduleStatus: (id, status) =>
    prisma.scheduledWorkout.update({ where: { id }, data: { status }, include: workoutRepository.scheduleInclude }),

  deleteSchedule: (id) => prisma.scheduledWorkout.delete({ where: { id } }),

  dueScheduleForReminder: (windowStart, windowEnd) =>
    prisma.scheduledWorkout.findMany({
      where: { status: "SCHEDULED", reminderSentAt: null, scheduledAt: { gte: windowStart, lte: windowEnd } },
      include: workoutRepository.scheduleInclude
    }),

  markScheduleReminded: (id) =>
    prisma.scheduledWorkout.update({ where: { id }, data: { reminderSentAt: new Date() } })
};

module.exports = workoutRepository;
