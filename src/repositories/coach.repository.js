const prisma = require("../database/prismaClient");

const coachRepository = {
  create: (data) => prisma.coach.create({ data }),

  findByUserId: (userId) =>
    prisma.coach.findUnique({ where: { userId }, include: { availability: true } }),

  findById: (id) => prisma.coach.findUnique({ where: { id }, include: { availability: true } }),

  update: (id, data) => prisma.coach.update({ where: { id }, data }),

  delete: (id) => prisma.coach.delete({ where: { id } }),

  list: ({ skip, take, specialty, sortBy, sortOrder }) =>
    prisma.coach.findMany({
      where: specialty ? { specialties: { has: specialty } } : undefined,
      include: { user: { select: { fullName: true, email: true } }, availability: true },
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
    prisma.coachAvailability.deleteMany({ where: { id, coachId } })
};

module.exports = coachRepository;
