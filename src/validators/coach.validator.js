const { z } = require("zod");

const idParam = { params: z.object({ id: z.string().uuid("Invalid coach id") }) };

const createOrUpdateCoach = {
  body: z.object({
    bio: z.string().trim().max(2000).optional(),
    specialties: z.array(z.string().trim().min(1)).max(20).optional(),
    experienceYears: z.number().int().min(0).max(60).optional(),
    isAcceptingClients: z.boolean().optional(),
    // Sent to a client in Chats whenever they book a session with this coach; null/empty turns it off.
    bookingMessage: z.string().trim().max(500).nullable().optional()
  })
};

const createCoachByHead = {
  body: createOrUpdateCoach.body.extend({ userId: z.string().uuid("Invalid user id") })
};

const updateCoachProfile = {
  params: idParam.params,
  body: createOrUpdateCoach.body
};

const listCoaches = {
  query: z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    specialty: z.string().trim().optional(),
    sortBy: z.enum(["createdAt", "experienceYears"]).optional().default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).optional().default("desc")
  })
};

const upsertAvailability = {
  params: z.object({ coachId: z.string().uuid("Invalid coach id") }),
  body: z.object({
    dayOfWeek: z.enum([
      "MONDAY",
      "TUESDAY",
      "WEDNESDAY",
      "THURSDAY",
      "FRIDAY",
      "SATURDAY",
      "SUNDAY"
    ]),
    startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "startTime must be HH:mm"),
    endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "endTime must be HH:mm"),
    isActive: z.boolean().optional().default(true)
  })
};

const listMyAppointments = {
  query: z.object({
    status: z.enum(["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"]).optional(),
    coachId: z.string().uuid().optional(), // head coach only; ignored for everyone else
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional()
  })
};

module.exports = {
  idParam,
  createOrUpdateCoach,
  listCoaches,
  updateCoachProfile,
  createCoachByHead,
  idParam,
  upsertAvailability,
  listMyAppointments
};
