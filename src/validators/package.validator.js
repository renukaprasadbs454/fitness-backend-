const { z } = require("zod");

const idParam = { params: z.object({ id: z.string().uuid() }) };

const packageBody = z.object({
  name: z.string().trim().min(2).max(80),
  tagline: z.string().trim().max(150).nullable().optional(),
  durationMonths: z.number().int().min(1).max(60),
  price: z.number().positive().max(1000000),
  originalPrice: z.number().positive().max(1000000),
  features: z.array(z.string().trim().min(1).max(120)).max(12).optional(),
  badge: z.string().trim().max(30).nullable().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(1000).optional()
});

const createPackage = { body: packageBody };
const updatePackage = { params: idParam.params, body: packageBody.partial() };

const checkout = {
  params: idParam.params,
  body: z.object({ method: z.enum(["CARD", "UPI", "NETBANKING", "WALLET"]) })
};

module.exports = { idParam, createPackage, updatePackage, checkout };
