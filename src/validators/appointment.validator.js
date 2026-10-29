const { z } = require("zod");

const idParam = { params: z.object({ id: z.string().uuid() }) };

const createAppointment = {
  body: z.object({
    coachId: z.string().uuid(),
    title: z.string().trim().min(2).max(150),
    scheduledAt: z.string().datetime({ offset: true }),
    durationMinutes: z.number().int().positive().max(240).optional(),
    notes: z.string().max(1000).optional()
  })
};

const listAppointments = {
  query: z.object({
    status: z.enum(["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"]).optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional()
  })
};

const updateStatus = {
  params: idParam.params,
  body: z.object({
    status: z.enum(["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"])
  })
};

const rescheduleAppointment = {
  params: idParam.params,
  body: z.object({
    scheduledAt: z.string().datetime({ offset: true }),
    durationMinutes: z.number().int().positive().max(240).optional()
  })
};

const updateAppointmentDetails = {
  params: idParam.params,
  body: z
    .object({
      title: z.string().trim().min(2).max(150).optional(),
      notes: z.string().max(1000).optional()
    })
    .refine((data) => data.title !== undefined || data.notes !== undefined, {
      message: "Provide at least one of title or notes"
    })
};

// Only https links: they are opened straight from the app and the portals.
const meetingLinkSchema = z
  .string()
  .trim()
  .max(500)
  .url("Enter a valid link")
  .refine((value) => value.startsWith("https://"), { message: "Meeting links must start with https://" });

const setMeetingLink = {
  params: idParam.params,
  body: z.object({ meetingLink: meetingLinkSchema.nullable() })
};

const scheduleSessions = {
  body: z.object({
    userId: z.string().uuid(),
    // Head coach only: book the session on another coach's calendar. Defaults to the caller.
    coachId: z.string().uuid().optional(),
    title: z.string().trim().min(2).max(150),
    scheduledAt: z.string().datetime({ offset: true }),
    durationMinutes: z.number().int().min(15).max(240).optional(),
    notes: z.string().max(1000).optional(),
    // 0 = a single session; N = that session plus N more, one week apart.
    repeatWeeks: z.number().int().min(0).max(11).optional(),
    meetingLink: meetingLinkSchema.optional()
  })
};

module.exports = {
  idParam,
  setMeetingLink,
  scheduleSessions,
  createAppointment,
  listAppointments,
  updateStatus,
  rescheduleAppointment,
  updateAppointmentDetails
};
