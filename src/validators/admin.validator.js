const { z } = require("zod");

const idParam = { params: z.object({ id: z.string().uuid() }) };

const listUsers = {
  query: z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    search: z.string().trim().max(150).optional(),
    role: z.enum(["USER", "COACH", "ADMIN"]).optional(),
    isActive: z.coerce.boolean().optional(),
    sortBy: z.enum(["createdAt", "fullName", "lastLoginAt"]).optional().default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).optional().default("desc")
  })
};

const updateUser = {
  params: idParam.params,
  body: z.object({
    fullName: z.string().trim().min(2).max(120).optional(),
    email: z.string().email().optional(),
    phone: z.string().trim().min(7).max(20).optional()
  })
};

const changeRole = {
  params: idParam.params,
  body: z.object({ role: z.enum(["USER", "COACH", "ADMIN"]) })
};

const resetPassword = {
  params: idParam.params,
  body: z.object({
    newPassword: z.string().min(8).max(128).optional() // omit to auto-generate
  })
};

const listCoachesAdmin = {
  query: z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    search: z.string().trim().max(150).optional(),
    sortBy: z.enum(["createdAt", "experienceYears"]).optional().default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).optional().default("desc")
  })
};

const createCoach = {
  body: z.object({
    userId: z.string().uuid(),
    bio: z.string().trim().max(2000).optional(),
    specialties: z.array(z.string().trim().min(1)).max(20).optional(),
    experienceYears: z.number().int().min(0).max(60).optional(),
    isAcceptingClients: z.boolean().optional()
  })
};

const updateCoach = {
  params: idParam.params,
  body: z.object({
    bio: z.string().trim().max(2000).optional(),
    specialties: z.array(z.string().trim().min(1)).max(20).optional(),
    experienceYears: z.number().int().min(0).max(60).optional(),
    isAcceptingClients: z.boolean().optional()
  })
};

const listAuditLogs = {
  query: z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    targetType: z.enum(["USER", "COACH"]).optional(),
    targetId: z.string().uuid().optional()
  })
};

const listPayments = {
  query: z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    status: z.enum(["PENDING", "SUCCESS", "FAILED", "REFUNDED"]).optional(),
    purpose: z.enum(["COACH_SESSION", "SUBSCRIPTION", "CUSTOM_WORKOUT_PLAN", "OTHER"]).optional()
  })
};

const broadcastAnnouncement = {
  body: z.object({
    title: z.string().trim().min(2).max(150),
    body: z.string().trim().min(2).max(1000),
    role: z.enum(["USER", "COACH"]).optional()
  })
};

module.exports = {
  idParam,
  listUsers,
  updateUser,
  changeRole,
  resetPassword,
  listCoachesAdmin,
  createCoach,
  updateCoach,
  listAuditLogs,
  listPayments,
  broadcastAnnouncement
};
