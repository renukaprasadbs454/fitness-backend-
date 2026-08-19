const prisma = require("../database/prismaClient");

const includeShape = {
  coach: { include: { user: { select: { fullName: true } } } },
  user: { select: { fullName: true, email: true } }
};

const appointmentRepository = {
  create: (data) => prisma.appointment.create({ data, include: includeShape }),

  findById: (id) => prisma.appointment.findUnique({ where: { id }, include: includeShape }),

  listForUser: (userId, { skip, take, status }) =>
    prisma.appointment.findMany({
      where: { userId, status: status || undefined },
      include: includeShape,
      orderBy: { scheduledAt: "desc" },
      skip,
      take
    }),

  countForUser: (userId, status) =>
    prisma.appointment.count({ where: { userId, status: status || undefined } }),

  upcomingForUser: (userId, take = 10) =>
    prisma.appointment.findMany({
      where: {
        userId,
        scheduledAt: { gte: new Date() },
        status: { in: ["PENDING", "CONFIRMED"] }
      },
      include: includeShape,
      orderBy: { scheduledAt: "asc" },
      take
    }),

  overlappingForCoach: (coachId, startsAt, endsAt) =>
    prisma.appointment.findMany({
      where: {
        coachId,
        status: { in: ["PENDING", "CONFIRMED"] },
        scheduledAt: { lt: endsAt }
        // narrowed further in-service using each row's own duration
      }
    }),

  updateStatus: (id, status) =>
    prisma.appointment.update({ where: { id }, data: { status }, include: includeShape }),

  updateSchedule: (id, { scheduledAt, durationMinutes }) =>
    prisma.appointment.update({
      where: { id },
      data: {
        scheduledAt,
        durationMinutes: durationMinutes ?? undefined
      },
      include: includeShape
    }),

  updateDetails: (id, { title, notes }) =>
    prisma.appointment.update({
      where: { id },
      data: {
        title: title ?? undefined,
        notes: notes ?? undefined
      },
      include: includeShape
    }),

  remove: (id) => prisma.appointment.delete({ where: { id } }),

  // ── Reminders (Phase 3) ─────────────────────────────────
  dueForReminder: (windowStart, windowEnd) =>
    prisma.appointment.findMany({
      where: {
        status: "CONFIRMED",
        reminderSentAt: null,
        scheduledAt: { gte: windowStart, lte: windowEnd }
      },
      include: includeShape
    }),

  markReminded: (id) =>
    prisma.appointment.update({ where: { id }, data: { reminderSentAt: new Date() } })
};

module.exports = appointmentRepository;
