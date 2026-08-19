const { z } = require("zod");

const logWeight = {
  body: z.object({
    weightKg: z.number().positive().max(500),
    loggedAt: z.string().datetime().optional()
  })
};

const logMeasurement = {
  body: z
    .object({
      chestCm: z.number().positive().max(300).optional(),
      waistCm: z.number().positive().max(300).optional(),
      hipCm: z.number().positive().max(300).optional(),
      armCm: z.number().positive().max(150).optional(),
      thighCm: z.number().positive().max(200).optional(),
      loggedAt: z.string().datetime().optional()
    })
    .refine(
      (d) => ["chestCm", "waistCm", "hipCm", "armCm", "thighCm"].some((k) => d[k] !== undefined),
      "At least one measurement must be provided"
    )
};

const logPhoto = {
  body: z.object({
    angle: z.enum(["FRONT", "BACK", "LEFT", "RIGHT"]),
    sessionId: z.string().min(1).max(100)
  })
};

const report = {
  query: z.object({
    range: z.enum(["weekly", "monthly"]).optional()
  })
};

module.exports = { logWeight, logMeasurement, logPhoto, report };
