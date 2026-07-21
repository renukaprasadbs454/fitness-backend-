const { z } = require("zod");

const updateProfile = {
  body: z
    .object({
      fullName: z.string().trim().min(2).max(100).optional(),
      heightCm: z.number().positive().max(300).optional(),
      weightKg: z.number().positive().max(500).optional(),
      age: z.number().int().min(10).max(120).optional(),
      gender: z.enum(["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"]).optional(),
      goal: z
        .enum(["WEIGHT_LOSS", "MUSCLE_GAIN", "STRENGTH", "ENDURANCE", "GENERAL_FITNESS", "REHAB"])
        .optional()
    })
    .refine((data) => Object.keys(data).length > 0, "At least one field must be provided")
};

module.exports = { updateProfile };
