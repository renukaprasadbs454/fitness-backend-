const prisma = require("../database/prismaClient");

const coachRepository = {
  create: (data) => prisma.coach.create({ data }),

  findByUserId: (userId) =>
    prisma.coach.findUnique({
      where: { userId },
      include: { user: { select: { fullName: true, username: true, email: true } }, availability: true }
    }),

  findById: (id) =>
    prisma.coach.findUnique({
      where: { id },
      include: { user: { select: { fullName: true, username: true, email: true } }, availability: true }
    }),

  update: (id, data) => prisma.coach.update({ where: { id }, data }),

  delete: (id) => prisma.coach.delete({ where: { id } }),

  list: ({ skip, take, specialty, sortBy, sortOrder }) =>
    prisma.coach.findMany({
      where: specialty ? { specialties: { has: specialty } } : undefined,
      include: { user: { select: { fullName: true, username: true, email: true } }, availability: true },
      skip,
      take,
      orderBy: { [sortBy]: sortOrder }
    }),

  count: (specialty) =>
    prisma.coach.count({ where: specialty ? { specialties: { has: specialty } } : undefined }),

  upsertAvailabilitySlot: (coachId, data) =>
    prisma.coachAvailability.upsert({
      where: {
        coachId_dayOfWeek_startTime: {
          coachId,
          dayOfWeek: data.dayOfWeek,
          startTime: data.startTime
        }
      },
      update: data,
      create: { coachId, ...data }
    }),

  listAvailability: (coachId) =>
    prisma.coachAvailability.findMany({ where: { coachId }, orderBy: { dayOfWeek: "asc" } }),

  deleteAvailabilitySlot: (id, coachId) =>
    prisma.coachAvailability.deleteMany({ where: { id, coachId } }),

  // ── Appointments booked with this coach (as the coach, not the booker) ──
  listAppointmentsForCoach: (coachId, { skip, take, status }) =>
    prisma.appointment.findMany({
      where: { coachId, status: status || undefined },
      include: { user: { select: { id: true, fullName: true, username: true, email: true } } },
      orderBy: { scheduledAt: "desc" },
      skip,
      take
    }),

  countAppointmentsForCoach: (coachId, status) =>
    prisma.appointment.count({ where: { coachId, status: status || undefined } }),

  // ── Admin ──────────────────────────────────────────────
  adminList: ({ skip, take, search, sortBy = "createdAt", sortOrder = "desc" }) =>
    prisma.coach.findMany({
      where: search
        ? {
            OR: [
              { user: { fullName: { contains: search, mode: "insensitive" } } },
              { user: { email: { contains: search, mode: "insensitive" } } },
              { user: { username: { contains: search, mode: "insensitive" } } },
              { specialties: { has: search } }
            ]
          }
        : undefined,
      include: {
        user: { select: { id: true, fullName: true, username: true, email: true, isActive: true, role: true } }
      },
      skip,
      take,
      orderBy: { [sortBy]: sortOrder }
    }),

  adminCount: (search) =>
    prisma.coach.count({
      where: search
        ? {
            OR: [
              { user: { fullName: { contains: search, mode: "insensitive" } } },
              { user: { email: { contains: search, mode: "insensitive" } } },
              { user: { username: { contains: search, mode: "insensitive" } } },
              { specialties: { has: search } }
            ]
          }
        : undefined
    })
};

module.exports = coachRepository;
