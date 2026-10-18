const { z } = require("zod");

const CATEGORY_KEYS = ["WEIGHT_LOSS", "MUSCLE_GAIN", "STRENGTH", "CARDIO", "YOGA", "GENERAL_FITNESS"];
const DIFFICULTIES = ["BEGINNER", "INTERMEDIATE", "ADVANCED"];

const idParam = { params: z.object({ id: z.string().uuid("Invalid assignment id") }) };

const userIdParam = { params: z.object({ userId: z.string().uuid("Invalid user id") }) };

const searchUsers = {
  query: z.object({ search: z.string().trim().min(1).max(120).optional() })
};

const assignWorkoutPlan = {
  params: userIdParam.params,
  body: z.object({
    planId: z.string().uuid("Invalid workout plan id"),
    note: z.string().trim().max(500).optional(),
    scheduledAt: z.string().datetime().optional(),
    asCoachUserId: z.string().uuid("Invalid coach id").optional()
  })
};

const assignCustomWorkoutExercise = z.object({
  name: z.string().trim().min(1).max(120),
  muscleGroup: z.string().max(60).optional(),
  equipment: z.string().max(120).optional(),
  sets: z.number().int().positive().max(50).optional(),
  reps: z.number().int().positive().max(200).optional()
});

const assignCustomWorkout = {
  params: userIdParam.params,
  body: z.object({
    title: z.string().trim().min(2).max(120),
    description: z.string().max(1000).optional(),
    durationMinutes: z.number().int().positive().max(300).optional(),
    difficulty: z.enum(DIFFICULTIES).optional(),
    categoryKey: z.enum(CATEGORY_KEYS).optional(),
    exercises: z.array(assignCustomWorkoutExercise).max(50).optional(),
    asCoachUserId: z.string().uuid("Invalid coach id").optional()
  })
};

const updateCustomAssignment = {
  params: idParam.params,
  body: z
    .object({
      title: z.string().trim().min(2).max(120),
      description: z.string().max(1000).nullable(),
      durationMinutes: z.number().int().positive().max(300).nullable(),
      difficulty: z.enum(DIFFICULTIES),
      categoryKey: z.enum(CATEGORY_KEYS),
      // When present the exercise list is replaced wholesale.
      exercises: z.array(assignCustomWorkoutExercise).min(1).max(50)
    })
    .partial()
};

const listMyAssignedWorkouts = {
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional()
  })
};

const updateAssignedWorkoutPlan = {
  params: idParam.params,
  body: z.object({
    note: z.string().trim().max(500).nullable().optional(),
    scheduledAt: z.string().datetime().nullable().optional()
  })
};

module.exports = {
  idParam,
  userIdParam,
  searchUsers,
  assignWorkoutPlan,
  assignCustomWorkout,
  updateCustomAssignment,
  listMyAssignedWorkouts,
  updateAssignedWorkoutPlan
};
