const crypto = require("crypto");
const userRepository = require("../repositories/user.repository");
const coachRepository = require("../repositories/coach.repository");
const adminRepository = require("../repositories/admin.repository");
const ApiError = require("../utils/ApiError");
const { hashPassword } = require("../utils/password");
const { parsePagination, buildMeta } = require("../utils/pagination");

// ── Dashboard ────────────────────────────────────────────

async function dashboardStats() {
  const since7d = new Date();
  since7d.setDate(since7d.getDate() - 7);
  const since30d = new Date();
  since30d.setDate(since30d.getDate() - 30);

  const [totalUsers, totalCoaches, activeUsers, newLast7d, newLast30d, admins, recentUsers] =
    await Promise.all([
      userRepository.countByRole("USER"),
      coachRepository.count(), // no specialty filter → all coaches
      userRepository.countActive(),
      userRepository.countCreatedSince(since7d),
      userRepository.countCreatedSince(since30d),
      userRepository.countByRole("ADMIN"),
      userRepository.recent(5)
    ]);

  return {
    totals: { users: totalUsers, coaches: totalCoaches, admins, activeUsers },
    newRegistrations: { last7Days: newLast7d, last30Days: newLast30d },
    recentUsers,
    systemStatus: { database: "connected", timestamp: new Date().toISOString() }
  };
}

// ── User management ─────────────────────────────────────

async function listUsers(query) {
  const { page, limit, skip } = parsePagination(query);
  const filters = { search: query.search, role: query.role, isActive: query.isActive };
  const [items, total] = await Promise.all([
    userRepository.adminList({ skip, take: limit, sortBy: query.sortBy, sortOrder: query.sortOrder, ...filters }),
    userRepository.adminCount(filters)
  ]);
  return { items, meta: buildMeta(page, limit, total) };
}

async function getUserById(id) {
  const user = await userRepository.findByIdWithProfile(id);
  if (!user) throw ApiError.notFound("User not found");
  const { passwordHash, ...safe } = user;
  return safe;
}

async function updateUser(adminId, id, data) {
  const existing = await userRepository.findById(id);
  if (!existing) throw ApiError.notFound("User not found");
  const updated = await userRepository.updateBasicInfo(id, data);
  await adminRepository.createAuditLog(adminId, "UPDATE_USER", "USER", id, data);
  return updated;
}

async function setUserActive(adminId, id, isActive) {
  const existing = await userRepository.findById(id);
  if (!existing) throw ApiError.notFound("User not found");
  const updated = await userRepository.setActive(id, isActive);
  if (!isActive) await userRepository.revokeAllRefreshTokens(id); // force logout on suspend
  await adminRepository.createAuditLog(
    adminId,
    isActive ? "ACTIVATE_USER" : "SUSPEND_USER",
    "USER",
    id,
    { isActive }
  );
  return updated;
}

async function changeUserRole(adminId, id, role) {
  const existing = await userRepository.findById(id);
  if (!existing) throw ApiError.notFound("User not found");
  if (existing.id === adminId && role !== "ADMIN") {
    throw ApiError.badRequest("You cannot demote your own admin account");
  }
  const updated = await userRepository.updateRole(id, role);
  await adminRepository.createAuditLog(adminId, "CHANGE_ROLE", "USER", id, {
    from: existing.role,
    to: role
  });
  return updated;
}

async function resetUserPassword(adminId, id, newPassword) {
  const existing = await userRepository.findById(id);
  if (!existing) throw ApiError.notFound("User not found");

  const tempPassword = newPassword || crypto.randomBytes(9).toString("base64url");
  const passwordHash = await hashPassword(tempPassword);
  await userRepository.updatePassword(id, passwordHash);
  await userRepository.revokeAllRefreshTokens(id); // force re-login with new credentials

  await adminRepository.createAuditLog(adminId, "RESET_PASSWORD", "USER", id, {
    generated: !newPassword
  });

  // Returned once, out-of-band — never persisted or logged in plaintext elsewhere.
  return { userId: id, temporaryPassword: tempPassword };
}

async function deleteUser(adminId, id) {
  const existing = await userRepository.findById(id);
  if (!existing) throw ApiError.notFound("User not found");
  if (existing.id === adminId) throw ApiError.badRequest("You cannot delete your own admin account");
  await userRepository.deleteById(id);
  await adminRepository.createAuditLog(adminId, "DELETE_USER", "USER", id, {
    email: existing.email
  });
}

// ── Coach management ─────────────────────────────────────

async function listCoaches(query) {
  const { page, limit, skip } = parsePagination(query);
  const [items, total] = await Promise.all([
    coachRepository.adminList({ skip, take: limit, search: query.search, sortBy: query.sortBy, sortOrder: query.sortOrder }),
    coachRepository.adminCount(query.search)
  ]);
  return { items, meta: buildMeta(page, limit, total) };
}

/** Promotes an existing user to COACH and creates/updates their Coach profile. */
async function createCoach(adminId, { userId, ...coachData }) {
  const user = await userRepository.findById(userId);
  if (!user) throw ApiError.notFound("User not found");

  let coach = await coachRepository.findByUserId(userId);
  if (user.role !== "COACH") {
    await userRepository.updateRole(userId, "COACH");
  }
  coach = coach
    ? await coachRepository.update(coach.id, coachData)
    : await coachRepository.create({ userId, specialties: [], ...coachData });

  await adminRepository.createAuditLog(adminId, "CREATE_COACH", "COACH", coach.id, { userId });
  return coach;
}

async function updateCoach(adminId, id, data) {
  const existing = await coachRepository.findById(id);
  if (!existing) throw ApiError.notFound("Coach not found");
  const updated = await coachRepository.update(id, data);
  await adminRepository.createAuditLog(adminId, "UPDATE_COACH", "COACH", id, data);
  return updated;
}

/** Removes the Coach profile and demotes the underlying user back to USER. */
async function deleteCoach(adminId, id) {
  const existing = await coachRepository.findById(id);
  if (!existing) throw ApiError.notFound("Coach not found");
  await coachRepository.delete(id);
  await userRepository.updateRole(existing.userId, "USER");
  await adminRepository.createAuditLog(adminId, "DELETE_COACH", "COACH", id, {
    userId: existing.userId
  });
}

// ── Audit logs ─────────────────────────────────────────────

async function listAuditLogs(query) {
  const { page, limit, skip } = parsePagination(query);
  const filters = { targetType: query.targetType, targetId: query.targetId };
  const [items, total] = await Promise.all([
    adminRepository.listAuditLogs({ skip, take: limit, ...filters }),
    adminRepository.countAuditLogs(filters)
  ]);
  return { items, meta: buildMeta(page, limit, total) };
}

module.exports = {
  dashboardStats,
  listUsers,
  getUserById,
  updateUser,
  setUserActive,
  changeUserRole,
  resetUserPassword,
  deleteUser,
  listCoaches,
  createCoach,
  updateCoach,
  deleteCoach,
  listAuditLogs
};
