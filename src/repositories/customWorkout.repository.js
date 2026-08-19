const prisma = require("../database/prismaClient");

const workoutInclude = {
  exercises: { orderBy: { sortOrder: "asc" } }
};

const customWorkoutRepository = {
  listForUser: (userId) =>
    prisma.customWorkout.findMany({
      where: { userId },
      include: workoutInclude,
      orderBy: { createdAt: "desc" }
    }),

  findByIdForUser: (id, userId) =>
    prisma.customWorkout.findFirst({ where: { id, userId }, include: workoutInclude }),

  create: (userId, { exercises, ...data }) =>
    prisma.customWorkout.create({
      data: {
        ...data,
        userId,
        exercises: exercises?.length
          ? { create: exercises.map((e, idx) => ({ ...e, sortOrder: idx })) }
          : undefined
      },
      include: workoutInclude
    }),

  update: async (id, { exercises, ...data }) => {
    if (exercises) {
      await prisma.customWorkoutExercise.deleteMany({ where: { customWorkoutId: id } });
    }
    return prisma.customWorkout.update({
      where: { id },
      data: {
        ...data,
        exercises: exercises?.length
          ? { create: exercises.map((e, idx) => ({ ...e, sortOrder: idx })) }
          : undefined
      },
      include: workoutInclude
    });
  },

  delete: (id) => prisma.customWorkout.delete({ where: { id } })
};

module.exports = customWorkoutRepository;
