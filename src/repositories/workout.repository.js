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
    })
};

module.exports = workoutRepository;
