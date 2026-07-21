const { z } = require("zod");

const CATEGORY_KEYS = ["WEIGHT_LOSS", "MUSCLE_GAIN", "STRENGTH", "CARDIO", "YOGA", "GENERAL_FITNESS"];
const DIFFICULTIES = ["BEGINNER", "INTERMEDIATE", "ADVANCED"];

const idParam = { params: z.object({ id: z.string().uuid() }) };

const listPlans = {
  query: z.object({
    category: z.enum(CATEGORY_KEYS).optional(),
    difficulty: z.enum(DIFFICULTIES).optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional()
  })
};

const exerciseRef = z.object({
  exerciseId: z.string().uuid(),
  sortOrder: z.number().int().min(0).optional(),
  sets: z.number().int().positive().optional(),
  reps: z.number().int().positive().optional()
});

const createPlan = {
  body: z.object({
    categoryKey: z.enum(CATEGORY_KEYS),
    title: z.string().trim().min(2).max(120),
    description: z.string().max(1000).optional(),
    durationMinutes: z.number().int().positive().max(300),
    difficulty: z.enum(DIFFICULTIES),
    accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "accentColor must be a hex color"),
    exercises: z.array(exerciseRef).optional()
  })
};

const updatePlan = {
  params: idParam.params,
  body: createPlan.body.partial()
};

const createExercise = {
  body: z.object({
    name: z.string().trim().min(2).max(120),
    description: z.string().max(1000).optional(),
    muscleGroup: z.string().max(60).optional(),
    equipment: z.string().max(120).optional()
  })
};

const updateExercise = {
  params: idParam.params,
  body: createExercise.body.partial()
};

const listExercises = {
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    q: z.string().max(100).optional()
  })
};

module.exports = {
  idParam,
  listPlans,
  createPlan,
  updatePlan,
  createExercise,
  updateExercise,
  listExercises
};
