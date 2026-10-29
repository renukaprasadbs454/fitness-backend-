const prisma = require("../database/prismaClient");

const includeShape = {
  // Emails are needed to invite both people to a generated Google Meet event.
  coach: { include: { user: { select: { fullName: true, email: true } } } },
  user: { select: { id: true, fullName: true, email: true } }
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

  // Sessions per client, optionally only with one coach: { userId -> { total, upcoming } }.
  countsByClient: async (userIds, coachId) => {
    if (!userIds.length) return new Map();
    const base = { userId: { in: userIds }, ...(coachId ? { coachId } : {}) };
    const [all, upcoming] = await Promise.all([
      prisma.appointment.groupBy({ by: ["userId"], where: base, _count: { _all: true } }),
      prisma.appointment.groupBy({
        by: ["userId"],
        where: { ...base, status: { in: ["PENDING", "CONFIRMED"] }, scheduledAt: { gte: new Date() } },
        _count: { _all: true }
      })
    ]);
    const counts = new Map(all.map((row) => [row.userId, { total: row._count._all, upcoming: 0 }]));
    upcoming.forEach((row) => {
      if (counts.has(row.userId)) counts.get(row.userId).upcoming = row._count._all;
    });
    return counts;
  },

  updateStatus: (id, status) =>
    prisma.appointment.update({ where: { id }, data: { status }, include: includeShape }),

  updateSchedule: (id, { scheduledAt, durationMinutes }) =>
    prisma.appointment.update({
      where: { id },
      data: {
        scheduledAt,
        durationMinutes: durationMinutes ?? undefined,
        // A moved session needs a fresh reminder for its new time.
        reminderSentAt: null
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

  upcomingForUserWithCoach: (userId, coachId) =>
    prisma.appointment.findMany({
      where: { userId, coachId, status: { in: ["PENDING", "CONFIRMED"] }, scheduledAt: { gte: new Date() } },
      include: includeShape
    }),

  updateMeeting: (id, { meetingLink, meetingProvider, meetingEventId }) =>
    prisma.appointment.update({
      where: { id },
      data: { meetingLink, meetingProvider, meetingEventId },
      include: includeShape
    }),

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
