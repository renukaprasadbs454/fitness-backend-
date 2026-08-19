const { z } = require("zod");

const CATEGORY_KEYS = ["WEIGHT_LOSS", "MUSCLE_GAIN", "STRENGTH", "CARDIO", "YOGA", "GENERAL_FITNESS"];
const DIFFICULTIES = ["BEGINNER", "INTERMEDIATE", "ADVANCED"];

const idParam = { params: z.object({ id: z.string().uuid() }) };

const exerciseInput = z.object({
  name: z.string().trim().min(1).max(120),
  muscleGroup: z.string().max(60).optional(),
  equipment: z.string().max(120).optional(),
  sets: z.number().int().positive().max(50).optional(),
  reps: z.number().int().positive().max(200).optional()
});

const createCustomWorkout = {
  body: z.object({
    title: z.string().trim().min(2).max(120),
    description: z.string().max(1000).optional(),
    durationMinutes: z.number().int().positive().max(300).optional(),
    difficulty: z.enum(DIFFICULTIES).optional(),
    categoryKey: z.enum(CATEGORY_KEYS).optional(),
    exercises: z.array(exerciseInput).max(50).optional()
  })
};

const updateCustomWorkout = {
  params: idParam.params,
  body: createCustomWorkout.body.partial()
};

module.exports = {
  idParam,
  createCustomWorkout,
  updateCustomWorkout
};
