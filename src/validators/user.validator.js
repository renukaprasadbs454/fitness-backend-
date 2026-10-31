const { z } = require("zod");

const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Username must be at least 3 characters")
  .max(30, "Username must be at most 30 characters")
  .regex(/^[a-z0-9_.]+$/, "Username can only contain lowercase letters, numbers, periods and underscores");

const updateProfile = {
  body: z
    .object({
      fullName: z.string().trim().min(2).max(100).optional(),
      username: usernameSchema.optional(),
      heightCm: z.number().positive().max(300).optional(),
      weightKg: z.number().positive().max(500).optional(),
      age: z.number().int().min(10).max(120).optional(),
      gender: z.enum(["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"]).optional(),
      goal: z
        .enum(["WEIGHT_LOSS", "MUSCLE_GAIN", "STRENGTH", "ENDURANCE", "GENERAL_FITNESS", "REHAB"])
        .nullable()
        .optional(),
      fitnessGoals: z.array(z.string().trim().min(1).max(80)).max(12).optional()
    })
    .refine((data) => Object.keys(data).length > 0, "At least one field must be provided")
};

module.exports = { updateProfile, usernameSchema };
