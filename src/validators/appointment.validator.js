const { z } = require("zod");

const idParam = { params: z.object({ id: z.string().uuid() }) };

const createAppointment = {
  body: z.object({
    coachId: z.string().uuid(),
    title: z.string().trim().min(2).max(150),
    scheduledAt: z.string().datetime(),
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
    scheduledAt: z.string().datetime(),
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

module.exports = {
  idParam,
  createAppointment,
  listAppointments,
  updateStatus,
  rescheduleAppointment,
  updateAppointmentDetails
};
