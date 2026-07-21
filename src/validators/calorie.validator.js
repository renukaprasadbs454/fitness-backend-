const { z } = require("zod");

const calculate = {
  body: z.object({
    age: z.number().int().min(10).max(120),
    gender: z.enum(["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"]),
    heightCm: z.number().positive().max(300),
    weightKg: z.number().positive().max(500),
    activityLevel: z.enum(["SEDENTARY", "LIGHT", "MODERATE", "ACTIVE", "VERY_ACTIVE"]),
    goal: z.enum([
      "WEIGHT_LOSS",
      "MUSCLE_GAIN",
      "STRENGTH",
      "ENDURANCE",
      "GENERAL_FITNESS",
      "REHAB"
    ])
  })
};

const history = {
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional()
  })
};

module.exports = { calculate, history };
