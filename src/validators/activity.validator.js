const { z } = require("zod");

const logSteps = {
  body: z.object({
    date: z.string().date().optional(), // defaults to today (server-side)
    steps: z.number().int().min(0).max(200000),
    distanceKm: z.number().min(0).max(500).optional(),
    caloriesBurned: z.number().int().min(0).max(20000).optional(),
    activeMinutes: z.number().int().min(0).max(1440).optional()
  })
};

const listSteps = {
  query: z.object({
    from: z.string().date().optional(),
    to: z.string().date().optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional()
  })
};

const report = {
  query: z.object({
    range: z.enum(["daily", "weekly", "monthly"]).optional()
  })
};

module.exports = { logSteps, listSteps, report };
