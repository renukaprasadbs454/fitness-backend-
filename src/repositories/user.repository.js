const prisma = require("../database/prismaClient");

const userRepository = {
  findByEmail: (email) => prisma.user.findUnique({ where: { email } }),

  findByPhone: (phone) => prisma.user.findUnique({ where: { phone } }),

  findById: (id) => prisma.user.findUnique({ where: { id } }),

  findByIdWithProfile: (id) =>
    prisma.user.findUnique({ where: { id }, include: { profile: true, coach: true } }),

  create: (data) => prisma.user.create({ data }),

  updateLastLogin: (id) => prisma.user.update({ where: { id }, data: { lastLoginAt: new Date() } }),

  updatePassword: (id, passwordHash) => prisma.user.update({ where: { id }, data: { passwordHash } }),

  createProfile: (userId, data) => prisma.userProfile.create({ data: { userId, ...data } }),

  upsertProfile: (userId, data) =>
    prisma.userProfile.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data }
    }),

  findProfileByUserId: (userId) => prisma.userProfile.findUnique({ where: { userId } })
};

module.exports = userRepository;
