const { z } = require("zod");

const uuid = z.string().uuid();

// ── Favourite coaches ─────────────────────────────────────
const coachIdParam = { params: z.object({ coachId: uuid }) };

// ── Coach reports ─────────────────────────────────────────
const REPORT_REASONS = ["UNRESPONSIVE", "MISSED_SESSIONS", "UNPROFESSIONAL", "NOT_A_GOOD_FIT", "INAPPROPRIATE_BEHAVIOUR", "OTHER"];
const REPORT_STATUSES = ["OPEN", "REVIEWING", "RESOLVED", "DISMISSED"];

const createCoachReport = {
  body: z.object({
    coachId: uuid,
    reason: z.enum(REPORT_REASONS),
    details: z.string().trim().max(2000).optional(),
    wantsNewCoach: z.boolean().optional()
  })
};

const listCoachReports = {
  query: z.object({
    status: z.enum(REPORT_STATUSES).optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional()
  })
};

const updateCoachReport = {
  params: z.object({ id: uuid }),
  body: z
    .object({
      status: z.enum(REPORT_STATUSES).optional(),
      adminNote: z.string().trim().max(2000).nullable().optional()
    })
    .refine((b) => b.status !== undefined || b.adminNote !== undefined, { message: "Provide a status or a note" })
};

const reassignFromReport = {
  params: z.object({ id: uuid }),
  body: z.object({
    coachId: uuid.nullable(), // null = remove the coach without assigning another
    adminNote: z.string().trim().max(2000).optional()
  })
};

// ── Support tickets ───────────────────────────────────────
const SUPPORT_CATEGORIES = ["GENERAL", "ACCOUNT", "PAYMENT", "TECHNICAL", "COACH", "OTHER"];
const SUPPORT_STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];

const createSupportTicket = {
  body: z.object({
    category: z.enum(SUPPORT_CATEGORIES).optional(),
    subject: z.string().trim().min(3).max(150),
    message: z.string().trim().min(10).max(4000)
  })
};

const updateMySupportTicket = {
  params: z.object({ id: uuid }),
  body: z
    .object({
      category: z.enum(SUPPORT_CATEGORIES),
      subject: z.string().trim().min(3).max(150),
      message: z.string().trim().min(10).max(4000)
    })
    .partial()
    .refine((b) => Object.keys(b).length > 0, { message: "Nothing to update" })
};

const supportTicketIdParam = { params: z.object({ id: uuid }) };

const listSupportTickets = {
  query: z.object({
    status: z.enum(SUPPORT_STATUSES).optional(),
    category: z.enum(SUPPORT_CATEGORIES).optional(),
    search: z.string().trim().max(150).optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional()
  })
};

const updateSupportTicket = {
  params: z.object({ id: uuid }),
  body: z
    .object({
      status: z.enum(SUPPORT_STATUSES).optional(),
      adminReply: z.string().trim().max(4000).nullable().optional(),
      category: z.enum(SUPPORT_CATEGORIES).optional(),
      subject: z.string().trim().min(3).max(150).optional(),
      message: z.string().trim().min(10).max(4000).optional()
    })
    .refine((b) => Object.values(b).some((v) => v !== undefined), { message: "Nothing to update" })
};

module.exports = {
  coachIdParam,
  createCoachReport,
  listCoachReports,
  updateCoachReport,
  reassignFromReport,
  createSupportTicket,
  updateMySupportTicket,
  supportTicketIdParam,
  listSupportTickets,
  updateSupportTicket
};
