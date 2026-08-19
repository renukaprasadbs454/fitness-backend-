const crypto = require("crypto");
const userRepository = require("../repositories/user.repository");
const coachRepository = require("../repositories/coach.repository");
const adminRepository = require("../repositories/admin.repository");
const ApiError = require("../utils/ApiError");
const { hashPassword } = require("../utils/password");
const { parsePagination, buildMeta } = require("../utils/pagination");
const { toIstIsoString } = require("../utils/timezone");

// ── Dashboard ────────────────────────────────────────────

async function dashboardStats() {
  const since7d = new Date();
  since7d.setDate(since7d.getDate() - 7);
  const since30d = new Date();
  since30d.setDate(since30d.getDate() - 30);

  const [totalUsers, totalCoaches, activeUsers, newLast7d, newLast30d, admins, recentUsers, payments] =
    await Promise.all([
      userRepository.countByRole("USER"),
      coachRepository.count(), // no specialty filter → all coaches
      userRepository.countActive(),
      userRepository.countCreatedSince(since7d),
      userRepository.countCreatedSince(since30d),
      userRepository.countByRole("ADMIN"),
      userRepository.recent(5),
      adminRepository.paymentTotals()
    ]);

  return {
    totals: { users: totalUsers, coaches: totalCoaches, admins, activeUsers },
    newRegistrations: { last7Days: newLast7d, last30Days: newLast30d },
    recentUsers,
    payments,
    systemStatus: { database: "connected", timestamp: toIstIsoString(new Date()) }
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

// ── Audit Logs ──────────────────────────────────────────

async function listAuditLogs(query) {
  const { page, limit, skip } = parsePagination(query);
  const [items, total] = await Promise.all([
    adminRepository.listAuditLogs({ skip, take: limit, action: query?.action, adminId: query?.adminId }),
    adminRepository.countAuditLogs({ action: query?.action, adminId: query?.adminId })
  ]);
  return { items, meta: buildMeta(page, limit, total) };
}

// ── Payments ─────────────────────────────────────────────

async function listPayments(query) {
  const { page, limit, skip } = parsePagination(query);
  const filters = { status: query.status, purpose: query.purpose };
  const [items, total] = await Promise.all([
    adminRepository.listPayments({ skip, take: limit, ...filters }),
    adminRepository.countPayments(filters)
  ]);
  return { items, meta: buildMeta(page, limit, total) };
}

// ── Dynamic Database Schema & Table Explorer (Prisma Studio integration) ──

const prisma = require("../database/prismaClient");
const { getDatabaseSchema } = require("../utils/dbIntrospection");
const { resolveRelationLabels, getRelationOptions } = require("../utils/dbRelationLabels");

async function getModelData(modelName, query = {}) {
  const models = getDatabaseSchema();
  const modelInfo = models.find(
    (m) =>
      m.name.toLowerCase() === modelName.toLowerCase() ||
      m.delegateName.toLowerCase() === modelName.toLowerCase() ||
      m.tableName.toLowerCase() === modelName.toLowerCase()
  );
  if (!modelInfo) throw ApiError.notFound(`Table '${modelName}' not found`);

  const delegate = prisma[modelInfo.delegateName];
  if (!delegate) throw ApiError.notFound(`Prisma delegate for '${modelName}' not found`);

  const limit = Math.min(Number(query.limit) || 50, 200);
  const page = Math.max(Number(query.page) || 1, 1);
  const skip = (page - 1) * limit;

  const scalarFields = modelInfo.fields.filter((f) => f.kind === "scalar" || f.kind === "enum");
  const selectObj = {};
  scalarFields.forEach((f) => {
    selectObj[f.name] = true;
  });

  const [rawItems, total] = await Promise.all([
    delegate
      .findMany({
        skip,
        take: limit,
        select: selectObj,
        orderBy: { [scalarFields[0]?.name || "createdAt"]: "desc" }
      })
      .catch(() => delegate.findMany({ skip, take: limit, select: selectObj })),
    delegate.count().catch(() => 0)
  ]);

  const items = await resolveRelationLabels(prisma, modelInfo, rawItems);

  return {
    model: modelInfo,
    items,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1
    }
  };
}

function sanitizeModelData(modelInfo, data) {
  const sanitized = { ...data };
  if (modelInfo && modelInfo.fields) {
    modelInfo.fields.forEach((f) => {
      if (f.type === "DateTime" && f.name in sanitized) {
        const val = sanitized[f.name];
        if (val === "" || val === null || val === undefined) {
          if (!f.isRequired) {
            sanitized[f.name] = null;
          } else {
            delete sanitized[f.name];
          }
        } else if (typeof val === "string") {
          const parsed = new Date(val);
          if (!isNaN(parsed.getTime())) {
            sanitized[f.name] = parsed.toISOString();
          } else {
            if (!f.isRequired) {
              sanitized[f.name] = null;
            } else {
              delete sanitized[f.name];
            }
          }
        }
      }
    });
  }
  return sanitized;
}

async function createModelRow(modelName, data) {
  const models = getDatabaseSchema();
  const modelInfo = models.find(
    (m) =>
      m.name.toLowerCase() === modelName.toLowerCase() ||
      m.delegateName.toLowerCase() === modelName.toLowerCase() ||
      m.tableName.toLowerCase() === modelName.toLowerCase()
  );
  if (!modelInfo) throw ApiError.notFound(`Table '${modelName}' not found`);

  const delegate = prisma[modelInfo.delegateName];
  const cleanedData = sanitizeModelData(modelInfo, data);
  return delegate.create({ data: cleanedData });
}

async function updateModelRow(modelName, id, data) {
  const models = getDatabaseSchema();
  const modelInfo = models.find(
    (m) =>
      m.name.toLowerCase() === modelName.toLowerCase() ||
      m.delegateName.toLowerCase() === modelName.toLowerCase() ||
      m.tableName.toLowerCase() === modelName.toLowerCase()
  );
  if (!modelInfo) throw ApiError.notFound(`Table '${modelName}' not found`);

  const delegate = prisma[modelInfo.delegateName];
  const idField = modelInfo.fields.find((f) => f.isId)?.name || "id";
  const cleanedData = sanitizeModelData(modelInfo, data);
  return delegate.update({ where: { [idField]: id }, data: cleanedData });
}

async function deleteModelRow(modelName, id) {
  const models = getDatabaseSchema();
  const modelInfo = models.find(
    (m) =>
      m.name.toLowerCase() === modelName.toLowerCase() ||
      m.delegateName.toLowerCase() === modelName.toLowerCase() ||
      m.tableName.toLowerCase() === modelName.toLowerCase()
  );
  if (!modelInfo) throw ApiError.notFound(`Table '${modelName}' not found`);

  const delegate = prisma[modelInfo.delegateName];
  const idField = modelInfo.fields.find((f) => f.isId)?.name || "id";
  return delegate.delete({ where: { [idField]: id } });
}

// {id, label} options for a related model, so the Insert/Edit Row form can
// render a foreign-key column as a searchable picker instead of a raw-UUID
// text box.
async function getRelationOptionsFor(modelName) {
  return getRelationOptions(prisma, modelName);
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
  listAuditLogs,
  listPayments,
  getDatabaseSchema,
  getModelData,
  createModelRow,
  updateModelRow,
  deleteModelRow,
  getRelationOptions: getRelationOptionsFor
};

