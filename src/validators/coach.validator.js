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

const newCoachPassword = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/[0-9]/, "Password must contain a number");

// Head coach adds a coach either by creating a brand-new account (fullName + email + password)
// or by promoting an existing user (userId).
const createCoachByHead = {
  body: createOrUpdateCoach.body
    .extend({
      userId: z.string().uuid("Invalid user id").optional(),
      fullName: z.string().trim().min(2).max(100).optional(),
      email: z.string().trim().toLowerCase().email().optional(),
      phone: z.string().trim().min(7).max(20).optional(),
      password: newCoachPassword.optional()
    })
    .refine((b) => b.userId || (b.fullName && b.email && b.password), {
      message: "Enter the new coach's name, email and password"
    })
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

const TIME = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Use HH:mm");
const slotParams = z.object({ coachId: z.string().uuid("Invalid coach id"), slotId: z.string().uuid("Invalid slot id") });

const updateAvailabilitySlot = {
  params: slotParams,
  body: z
    .object({
      dayOfWeek: z.enum(["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"]).optional(),
      startTime: TIME.optional(),
      endTime: TIME.optional(),
      isActive: z.boolean().optional()
    })
    .refine((body) => Object.keys(body).length > 0, { message: "Nothing to update" })
};

const deleteAvailabilitySlot = { params: slotParams };

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
  upsertAvailability,
  updateAvailabilitySlot,
  deleteAvailabilitySlot,
  listMyAppointments
};
