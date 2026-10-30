const prisma = require("../database/prismaClient");

// Enough to show "who is this user's coach" without exposing the whole Coach row.
const assignedCoachSelect = { id: true, userId: true, user: { select: { fullName: true, email: true } } };

const userRepository = {
  findByEmail: (email) => prisma.user.findUnique({ where: { email } }),

  findByPhone: (phone) => prisma.user.findUnique({ where: { phone } }),

  findByUsername: (username) => prisma.user.findUnique({ where: { username } }),

  findById: (id) => prisma.user.findUnique({ where: { id } }),

  findByIdWithProfile: (id) =>
    prisma.user.findUnique({
      where: { id },
      include: { profile: true, coach: true, assignedCoach: { select: assignedCoachSelect } }
    }),

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
        createdAt: true,
        assignedCoachId: true,
        assignedCoach: { select: assignedCoachSelect }
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

  // Pass null to unassign.
  setAssignedCoach: (id, coachId) =>
    prisma.user.update({
      where: { id },
      data: { assignedCoachId: coachId },
      select: { id: true, assignedCoachId: true, assignedCoach: { select: assignedCoachSelect } }
    }),

  // Users assigned to a coach (admin "clients" view).
  listClientsOfCoach: (coachId) =>
    prisma.user.findMany({
      where: { assignedCoachId: coachId },
      select: { id: true, fullName: true, email: true, username: true, isActive: true },
      orderBy: { fullName: "asc" }
    }),

  // Ids of a coach's assigned users — used to scope what a coach may see/touch.
  listClientIdsOfCoach: async (coachId) => {
    const rows = await prisma.user.findMany({ where: { assignedCoachId: coachId, isActive: true, role: "USER" }, select: { id: true } });
    return rows.map((r) => r.id);
  },

  // Clients with the coach they are assigned to. `ids` narrows to a set; omit it for every client account.
  listClientsOverview: (ids) =>
    prisma.user.findMany({
      where: { role: "USER", ...(ids ? { id: { in: ids } } : {}) },
      select: {
        id: true,
        fullName: true,
        username: true,
        email: true,
        isActive: true,
        assignedCoachId: true,
        assignedCoach: { select: { id: true, user: { select: { fullName: true } } } }
      },
      orderBy: { fullName: "asc" },
      take: 1000
    }),

  // Lightweight client rows for a known set of ids (coach session scheduling).
  listClientsLiteByIds: (ids) =>
    prisma.user.findMany({
      where: { id: { in: ids }, role: "USER" },
      select: { id: true, fullName: true, email: true, username: true, assignedCoachId: true },
      orderBy: { fullName: "asc" }
    }),

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

  // ── Coach: lightweight client picker (name/email only, no sensitive fields) ──
  // `assignedCoachId` restricts results to one coach's assigned users.
  searchLite: ({ search, take = 20, assignedCoachId, role }) =>
    prisma.user.findMany({
      where: {
        isActive: true,
        ...(assignedCoachId ? { assignedCoachId } : {}),
        ...(role ? { role } : {}),
        ...(search
          ? {
              OR: [
                { fullName: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
                { username: { contains: search, mode: "insensitive" } }
              ]
            }
          : {})
      },
      select: { id: true, fullName: true, email: true, username: true, role: true },
      take,
      orderBy: { fullName: "asc" }
    })
};

module.exports = userRepository;
