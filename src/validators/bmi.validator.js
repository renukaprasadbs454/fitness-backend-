const { z } = require("zod");

const calculate = {
  body: z.object({
    heightCm: z.number().positive().max(300),
    weightKg: z.number().positive().max(500)
  })
};

const history = {
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional()
  })
};

module.exports = { calculate, history };
