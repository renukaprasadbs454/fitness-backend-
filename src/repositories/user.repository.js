const prisma = require("../database/prismaClient");

const userRepository = {
  findByEmail: (email) => prisma.user.findUnique({ where: { email } }),

  findByPhone: (phone) => prisma.user.findUnique({ where: { phone } }),

  findByUsername: (username) => prisma.user.findUnique({ where: { username } }),

  findById: (id) => prisma.user.findUnique({ where: { id } }),

  findByIdWithProfile: (id) =>
    prisma.user.findUnique({ where: { id }, include: { profile: true, coach: true } }),

  create: (data) => prisma.user.create({ data }),

  updateLastLogin: (id) => prisma.user.update({ where: { id }, data: { lastLoginAt: new Date() } }),

  updatePassword: (id, passwordHash) => prisma.user.update({ where: { id }, data: { passwordHash } }),

  markEmailVerified: (id) => prisma.user.update({ where: { id }, data: { isEmailVerified: true } }),

  createProfile: (userId, data) => prisma.userProfile.create({ data: { userId, ...data } }),

  upsertProfile: (userId, data) =>
    prisma.userProfile.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data }
    }),

  findProfileByUserId: (userId) => prisma.userProfile.findUnique({ where: { userId } }),

  // ── Admin ──────────────────────────────────────────────
  adminList: ({ skip, take, search, role, isActive, sortBy = "createdAt", sortOrder = "desc" }) =>
    prisma.user.findMany({
      where: {
        role: role || undefined,
        isActive: typeof isActive === "boolean" ? isActive : undefined,
        ...(search
          ? {
              OR: [
                { fullName: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
                { phone: { contains: search, mode: "insensitive" } },
                { username: { contains: search, mode: "insensitive" } }
              ]
            }
          : {})
      },
      select: {
        id: true,
        email: true,
        username: true,
        phone: true,
        fullName: true,
        role: true,
        isActive: true,
        isEmailVerified: true,
        lastLoginAt: true,
        createdAt: true
      },
      skip,
      take,
      orderBy: { [sortBy]: sortOrder }
    }),

  adminCount: ({ search, role, isActive }) =>
    prisma.user.count({
      where: {
        role: role || undefined,
        isActive: typeof isActive === "boolean" ? isActive : undefined,
        ...(search
          ? {
              OR: [
                { fullName: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
                { phone: { contains: search, mode: "insensitive" } },
                { username: { contains: search, mode: "insensitive" } }
              ]
            }
          : {})
      }
    }),

  setActive: (id, isActive) =>
    prisma.user.update({ where: { id }, data: { isActive }, select: { id: true, isActive: true } }),

  updateRole: (id, role) =>
    prisma.user.update({ where: { id }, data: { role }, select: { id: true, role: true } }),

  updateBasicInfo: (id, data) =>
    prisma.user.update({
      where: { id },
      data,
      select: { id: true, fullName: true, email: true, username: true, phone: true }
    }),

  deleteById: (id) => prisma.user.delete({ where: { id } }),

  revokeAllRefreshTokens: (userId) =>
    prisma.refreshToken.updateMany({ where: { userId, revoked: false }, data: { revoked: true } }),

  countByRole: (role) => prisma.user.count({ where: { role } }),

  countActive: () => prisma.user.count({ where: { isActive: true } }),

  countCreatedSince: (since) => prisma.user.count({ where: { createdAt: { gte: since } } }),

  recent: (take = 5) =>
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take,
      select: { id: true, fullName: true, email: true, username: true, role: true, createdAt: true }
    }),

  listActiveUserIdsByRole: async (role) => {
    const users = await prisma.user.findMany({
      where: { isActive: true, role: role || undefined },
      select: { id: true }
    });
    return users.map((u) => u.id);
  },

  countCreatedBetween: (from, to) =>
    prisma.user.count({ where: { createdAt: { gte: from, lt: to } } }),

  countByRoleActive: (role) => prisma.user.count({ where: { role, isActive: true } }),

  // ── Coach: lightweight client picker (name/email only, no sensitive fields) ──
  searchLite: ({ search, take = 20 }) =>
    prisma.user.findMany({
      where: search
        ? {
            OR: [
              { fullName: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
              { username: { contains: search, mode: "insensitive" } }
            ]
          }
        : undefined,
      select: { id: true, fullName: true, email: true, username: true, role: true },
      take,
      orderBy: { fullName: "asc" }
    })
};

module.exports = userRepository;
