const crypto = require("crypto");
const userRepository = require("../repositories/user.repository");
const coachRepository = require("../repositories/coach.repository");
const adminRepository = require("../repositories/admin.repository");
const ApiError = require("../utils/ApiError");
const { hashPassword } = require("../utils/password");
const { generateUniqueUsername } = require("../utils/username");
const { parsePagination, buildMeta } = require("../utils/pagination");
const { toIstIsoString } = require("../utils/timezone");

// ── Dashboard ────────────────────────────────────────────

async function dashboardStats() {
  const since7d = new Date();
  since7d.setDate(since7d.getDate() - 7);
  const since30d = new Date();
  since30d.setDate(since30d.getDate() - 30);

  const [totalUsers, totalCoaches, activeUsers, suspendedUsers, newLast7d, newLast30d, admins, recentUsers, payments] =
    await Promise.all([
      userRepository.countByRole("USER"),
      coachRepository.count(), // no specialty filter → all coaches
      userRepository.countByRoleAndStatus("USER", true),
      userRepository.countByRoleAndStatus("USER", false),
      userRepository.countCreatedSince(since7d),
      userRepository.countCreatedSince(since30d),
      userRepository.countByRole("ADMIN"),
      userRepository.recent(5),
      adminRepository.paymentTotals()
    ]);

  return {
    totals: { users: totalUsers, coaches: totalCoaches, admins, activeUsers, suspendedUsers },
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
  const mediaRepository = require("../repositories/media.repository");
  const { resolveReadUrl } = require("../utils/storage");
  const photos = await mediaRepository.listByUser(id, "PROGRESS_IMAGE");
  const photoSets = await require("../repositories/progress.repository").progressPhotoSessions(id);
  const setCreatedAtById = new Map(photoSets.map((photo) => [photo.sessionId, photo.setCreatedAt]));
  const groupedPhotos = new Map();
  for (const photo of photos) {
    const sessionId = photo.sessionId || `legacy-${photo.id}`;
    if (!groupedPhotos.has(sessionId)) {
      groupedPhotos.set(sessionId, { sessionId, createdAt: setCreatedAtById.get(sessionId) || photo.createdAt, photos: [] });
    }
    const session = groupedPhotos.get(sessionId);
    session.photos.push({
      id: photo.id,
      url: resolveReadUrl(photo.url),
      angle: photo.angle,
      createdAt: photo.createdAt
    });
  }
  return {
    ...safe,
    progressPhotoSets: [...groupedPhotos.values()].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  };
}

async function updateUser(adminId, id, data) {
  const existing = await userRepository.findById(id);
  if (!existing) throw ApiError.notFound("User not found");

  if (data.username) {
    const usernameOwner = await userRepository.findByUsername(data.username);
    if (usernameOwner && usernameOwner.id !== id) {
      throw ApiError.conflict("Username is already taken");
    }
  }

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
  // Only plain users are clients — drop the assignment if they stop being one.
  if (role !== "USER" && existing.assignedCoachId) {
    await userRepository.setAssignedCoach(id, null);
  }
  await adminRepository.createAuditLog(adminId, "CHANGE_ROLE", "USER", id, {
    from: existing.role,
    to: role
  });
  return updated;
}

/** Assigns a user to a coach (or unassigns with coachId = null). One coach per user. */
async function assignCoach(adminId, userId, coachId) {
  const user = await userRepository.findById(userId);
  if (!user) throw ApiError.notFound("User not found");
  if (user.role !== "USER") throw ApiError.badRequest("Only regular users can be assigned to a coach");

  if (coachId) {
    const coach = await coachRepository.findById(coachId);
    if (!coach) throw ApiError.notFound("Coach not found");
    if (coach.userId === userId) throw ApiError.badRequest("A user cannot be their own coach");
  }

  if ((user.assignedCoachId ?? null) === (coachId ?? null)) {
    return userRepository.setAssignedCoach(userId, coachId ?? null); // no-op, nothing to audit
  }

  const updated = await userRepository.setAssignedCoach(userId, coachId ?? null);
  await adminRepository.createAuditLog(adminId, "ASSIGN_COACH", "USER", userId, {
    from: user.assignedCoachId ?? null,
    to: coachId ?? null
  });
  return updated;
}

async function listCoachClients(coachId) {
  const coach = await coachRepository.findById(coachId);
  if (!coach) throw ApiError.notFound("Coach not found");
  return userRepository.listClientsOfCoach(coachId);
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

// Admin creates an account directly. It's marked verified (the admin vouches for the
// address) and the temporary password is returned once so the admin can hand it over.
async function createUser(adminId, { fullName, email, phone, role, password }) {
  if (await userRepository.findByEmail(email)) throw ApiError.conflict("An account with this email already exists");
  if (phone && (await userRepository.findByPhone(phone))) throw ApiError.conflict("An account with this phone number already exists");

  const tempPassword = password || crypto.randomBytes(9).toString("base64url");
  const user = await userRepository.create({
    fullName,
    email,
    phone,
    passwordHash: await hashPassword(tempPassword),
    role,
    username: await generateUniqueUsername(email),
    isEmailVerified: true
  });
  await userRepository.createProfile(user.id, {});
  if (role === "COACH") await coachRepository.create({ userId: user.id, specialties: [] });

  await adminRepository.createAuditLog(adminId, "CREATE_USER", "USER", user.id, { role, generated: !password });
  const createdUser = await userRepository.findById(user.id);
  const { passwordHash: _passwordHash, ...safeUser } = createdUser;
  return { user: safeUser, temporaryPassword: tempPassword };
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

async function getCoachDetails(id) {
  const coach = await coachRepository.adminDetails(id);
  if (!coach) throw ApiError.notFound("Coach not found");
  return coach;
}

/** Creates a new coach (with user account & credentials) OR promotes an existing user to COACH. */
async function createCoach(adminId, data) {
  const { userId, fullName, email, password, phone, bio, specialties = [], experienceYears, isAcceptingClients = true } = data;

  if (userId) {
    const user = await userRepository.findById(userId);
    if (!user) throw ApiError.notFound("User not found");

    if (user.role !== "COACH") {
      await userRepository.updateRole(userId, "COACH");
    }

    let tempPassword = null;
    if (password && password.trim()) {
      tempPassword = password.trim();
      const passwordHash = await hashPassword(tempPassword);
      await userRepository.updatePassword(userId, passwordHash);
      await userRepository.revokeAllRefreshTokens(userId);
    }

    let coach = await coachRepository.findByUserId(userId);
    coach = coach
      ? await coachRepository.update(coach.id, { bio, specialties, experienceYears, isAcceptingClients })
      : await coachRepository.create({ userId, bio, specialties, experienceYears, isAcceptingClients });

    await adminRepository.createAuditLog(adminId, "CREATE_COACH", "COACH", coach.id, { userId });
    const fullCoach = await coachRepository.findById(coach.id);
    return { ...fullCoach, temporaryPassword: tempPassword };
  }

  // Brand new coach with credentials
  const cleanEmail = email.trim().toLowerCase();
  if (await userRepository.findByEmail(cleanEmail)) {
    throw ApiError.conflict("An account with this email already exists");
  }
  const cleanPhone = phone ? phone.trim() : null;
  if (cleanPhone && (await userRepository.findByPhone(cleanPhone))) {
    throw ApiError.conflict("An account with this phone number already exists");
  }

  const tempPassword = password && password.trim() ? password.trim() : ("Coach@" + crypto.randomBytes(3).toString("hex") + "!");
  const username = await generateUniqueUsername(cleanEmail);
  const user = await userRepository.create({
    fullName: fullName.trim(),
    email: cleanEmail,
    phone: cleanPhone,
    passwordHash: await hashPassword(tempPassword),
    role: "COACH",
    username,
    isEmailVerified: true
  });

  await userRepository.createProfile(user.id, {});
  const coach = await coachRepository.create({
    userId: user.id,
    bio: bio || null,
    specialties: Array.isArray(specialties) ? specialties : [],
    experienceYears: experienceYears ?? null,
    isAcceptingClients: isAcceptingClients ?? true
  });

  await adminRepository.createAuditLog(adminId, "CREATE_COACH", "COACH", coach.id, {
    userId: user.id,
    email: cleanEmail,
    generatedPassword: !password
  });

  const fullCoach = await coachRepository.findById(coach.id);
  return { ...fullCoach, temporaryPassword: tempPassword };
}

/** Updates a coach's login credentials (email, password, full name, phone) and revokes old sessions. */
async function updateCoachCredentials(adminId, id, { email, password, fullName, phone }) {
  const coach = await coachRepository.findById(id);
  if (!coach) throw ApiError.notFound("Coach not found");

  const user = await userRepository.findById(coach.userId);
  if (!user) throw ApiError.notFound("Underlying user account not found");

  const updates = {};

  if (fullName && fullName.trim() && fullName.trim() !== user.fullName) {
    updates.fullName = fullName.trim();
  }

  if (email && email.trim()) {
    const cleanEmail = email.trim().toLowerCase();
    if (cleanEmail !== user.email.toLowerCase()) {
      const existingEmail = await userRepository.findByEmail(cleanEmail);
      if (existingEmail && existingEmail.id !== user.id) {
        throw ApiError.conflict("An account with this email already exists");
      }
      updates.email = cleanEmail;
    }
  }

  if (phone !== undefined) {
    if (phone && phone.trim()) {
      const cleanPhone = phone.trim();
      if (cleanPhone !== (user.phone || "")) {
        const existingPhone = await userRepository.findByPhone(cleanPhone);
        if (existingPhone && existingPhone.id !== user.id) {
          throw ApiError.conflict("An account with this phone number already exists");
        }
        updates.phone = cleanPhone;
      }
    } else if (phone === null || phone === "") {
      updates.phone = null;
    }
  }

  let tempPassword = null;
  if (password && password.trim()) {
    tempPassword = password.trim();
    const passwordHash = await hashPassword(tempPassword);
    await userRepository.updatePassword(user.id, passwordHash);
    await userRepository.revokeAllRefreshTokens(user.id);
  }

  if (Object.keys(updates).length > 0) {
    await userRepository.updateBasicInfo(user.id, updates);
  }

  await adminRepository.createAuditLog(adminId, "UPDATE_COACH", "COACH", id, {
    subAction: "UPDATE_CREDENTIALS",
    userId: user.id,
    updatedFields: Object.keys(updates),
    passwordChanged: Boolean(tempPassword)
  });

  const updatedUser = await userRepository.findById(user.id);
  return {
    coachId: id,
    userId: user.id,
    fullName: updatedUser.fullName,
    email: updatedUser.email,
    phone: updatedUser.phone,
    temporaryPassword: tempPassword
  };
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
const { getDatabaseSchema: getFullSchema } = require("../utils/dbIntrospection");

// Encrypted OAuth tokens for the platform Google account are not something to
// browse or hand-edit; the integration is managed from its own admin screen.
const EXPLORER_HIDDEN_MODELS = ["PlatformIntegration"];

function getDatabaseSchema() {
  return getFullSchema().filter((m) => !EXPLORER_HIDDEN_MODELS.includes(m.name));
}
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
  const requestedSortBy = String(query.sortBy || "");
  const sortableFields = scalarFields.filter((field) => !["Json", "Bytes"].includes(field.type));
  const sortBy = sortableFields.some((field) => field.name === requestedSortBy)
    ? requestedSortBy
    : (sortableFields.some((field) => field.name === "createdAt") ? "createdAt" : sortableFields[0]?.name);
  const sortOrder = query.sortOrder === "asc" ? "asc" : "desc";
  const search = String(query.search || "").trim().slice(0, 200);
  const requestedSearchColumn = String(query.searchColumn || "");
  const searchableFields = scalarFields;
  const selectedSearchField = requestedSearchColumn && requestedSearchColumn !== "ALL"
    ? searchableFields.find((field) => field.name === requestedSearchColumn)
    : null;
  const searchFields = requestedSearchColumn && requestedSearchColumn !== "ALL"
    ? (selectedSearchField ? [selectedSearchField] : [])
    : searchableFields;
  let requestedFilters = {};
  if (query.filters) {
    try {
      requestedFilters = typeof query.filters === "string" ? JSON.parse(query.filters) : query.filters;
    } catch {
      requestedFilters = {};
    }
  }
  const fieldByName = new Map(scalarFields.map((field) => [field.name, field]));
  const columnFilters = Object.entries(requestedFilters || {})
    .filter(([name, value]) => fieldByName.has(name) && String(value ?? "").trim())
    .map(([name, value]) => ({ field: fieldByName.get(name), value: String(value).trim().slice(0, 200) }));
  const memorySearchFields = searchFields.filter((field) =>
    field.isList || ["Json", "Bytes"].includes(field.type)
  );
  const memoryFilterFields = columnFilters.filter(({ field }) => field.isList || ["Json", "Bytes"].includes(field.type));
  const databaseFilterFields = columnFilters.filter(({ field }) => !field.isList && !["Json", "Bytes"].includes(field.type));
  const memorySearchRequired = Boolean(search && memorySearchFields.length);
  const searchAllFieldsWithMemory = Boolean(search && requestedSearchColumn === "ALL" && memorySearchFields.length);
  const toCondition = (field, value, substring = true) => {
    if (field.kind === "enum") {
      const matches = (field.enumValues || []).filter((item) => item.toLowerCase().includes(value.toLowerCase()));
      return matches.length ? { [field.name]: { in: matches } } : { id: "__no_match__" };
    }
    if (field.type === "String") return { [field.name]: { contains: value, mode: "insensitive" } };
    if (["Int", "Float", "Decimal"].includes(field.type)) return /^-?\d+(\.\d+)?$/.test(value) ? { [field.name]: Number(value) } : { id: "__no_match__" };
    if (field.type === "BigInt") return /^-?\d+$/.test(value) ? { [field.name]: BigInt(value) } : { id: "__no_match__" };
    if (field.type === "Boolean") return /^(true|false|yes|no|1|0)$/i.test(value) ? { [field.name]: /^(true|yes|1)$/i.test(value) } : { id: "__no_match__" };
    if (field.type === "DateTime") {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return { id: "__no_match__" };
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const end = new Date(date);
        end.setUTCDate(end.getUTCDate() + 1);
        return { [field.name]: { gte: date, lt: end } };
      }
      return { [field.name]: date };
    }
    return substring ? { [field.name]: { contains: value, mode: "insensitive" } } : { [field.name]: value };
  };
  const whereParts = databaseFilterFields.map(({ field, value }) => toCondition(field, value));
  const searchConditions = search && !searchAllFieldsWithMemory
    ? searchFields.filter((field) => !field.isList && !["Json", "Bytes"].includes(field.type)).map((field) => toCondition(field, search))
    : [];
  if (search && !searchAllFieldsWithMemory && !memorySearchRequired) {
    whereParts.push({ OR: searchConditions.length ? searchConditions : [{ id: "__no_match__" }] });
  }
  const where = whereParts.length ? { AND: whereParts } : undefined;
  const selectObj = {};
  scalarFields.forEach((f) => {
    selectObj[f.name] = true;
  });

  const orderBy = { [sortBy || "createdAt"]: sortOrder };
  let rawItems;
  let total;
  if (memorySearchRequired || searchAllFieldsWithMemory || memoryFilterFields.length) {
    // Prisma cannot substring-search JSON, bytes, or scalar-list fields consistently.
    // Load rows once, match their serialized values, then paginate the filtered set.
    const allRows = await delegate.findMany({ where, select: selectObj, orderBy });
    const searchableValues = (value) => {
      if (value === null || value === undefined) return "";
      if (Buffer.isBuffer(value)) return value.toString("base64");
      if (value instanceof Date) return value.toISOString();
      if (Array.isArray(value)) return value.map(searchableValues).join(" ");
      if (typeof value === "object") return Object.entries(value).map(([key, nested]) => `${key} ${searchableValues(nested)}`).join(" ");
      return String(value);
    };
    const matched = allRows.filter((row) => {
      const filtersMatch = memoryFilterFields.every(({ field, value }) =>
        searchableValues(row[field.name]).toLocaleLowerCase().includes(value.toLocaleLowerCase())
      );
      if (!filtersMatch || !search) return filtersMatch;
      return searchFields.some((field) => searchableValues(row[field.name]).toLocaleLowerCase().includes(search.toLocaleLowerCase()));
    });
    total = matched.length;
    rawItems = matched.slice(skip, skip + limit);
  } else {
    const [items, count] = await Promise.all([
      delegate.findMany({ skip, take: limit, where, select: selectObj, orderBy }),
      delegate.count({ where })
    ]);
    rawItems = items;
    total = count;
  }

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
  try {
    return await delegate.create({ data: cleanedData });
  } catch (error) {
    throw readableDatabaseError(error, "create");
  }
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
  try {
    return await delegate.update({ where: { [idField]: id }, data: cleanedData });
  } catch (error) {
    throw readableDatabaseError(error, "update");
  }
}

function readableDatabaseError(error, action) {
  const actionText = action === "create" ? "add" : action === "update" ? "save changes to" : "delete";
  const modelNames = { ChatRoom: "chat room", WorkoutPlan: "workout plan", WorkoutPlanExercise: "plan exercise" };
  const model = modelNames[error?.meta?.modelName] || "record";
  if (error?.code === "P2002") return ApiError.conflict("This entry already exists. Check the fields that must be unique, then try again.");
  if (error?.code === "P2003" || error?.code === "P2014") {
    if (action === "create") return ApiError.badRequest("One of the selected items is no longer available. Refresh the page, choose from the current options, and try again.");
    return ApiError.badRequest(`This ${model} is still connected to other information. Remove or update the connected items before trying again.`);
  }
  if (error?.code === "P2025") return ApiError.notFound("This record could not be found. Refresh the page and try again.");
  if (error?.code === "P2034") return ApiError.conflict("This entry changed while you were editing it. Refresh the page and try again.");
  if (["P2011", "P2012", "P2013"].includes(error?.code)) return ApiError.badRequest(`A required field is missing. Complete all required fields before you ${actionText} ${model}.`);
  if (["P2000", "P2006", "P2007", "P2009"].includes(error?.code)) return ApiError.badRequest("One of the values is not valid. Check the highlighted fields and try again.");
  if (["P1000", "P1001", "P1002", "P1008", "P1017", "P2024"].includes(error?.code)) {
    return ApiError.internal("We couldn't reach the database right now. Please try again in a moment.");
  }
  return ApiError.internal("Something went wrong while saving this change. Please try again, and contact support if it keeps happening.");
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
  try {
    return await delegate.delete({ where: { [idField]: id } });
  } catch (error) {
    throw readableDatabaseError(error, "delete");
  }
}

async function moveWorkoutPlanExercise(id, direction) {
  if (direction !== -1 && direction !== 1) throw ApiError.badRequest("Choose whether to move the exercise up or down.");
  try {
    return await prisma.$transaction(async (tx) => {
      const current = await tx.workoutPlanExercise.findUnique({ where: { id } });
      if (!current) throw ApiError.notFound("This exercise entry could not be found. Refresh the page and try again.");
      const entries = await tx.workoutPlanExercise.findMany({ where: { planId: current.planId }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });
      const currentIndex = entries.findIndex((entry) => entry.id === id);
      const targetIndex = currentIndex + direction;
      if (targetIndex < 0 || targetIndex >= entries.length) return current;
      [entries[currentIndex], entries[targetIndex]] = [entries[targetIndex], entries[currentIndex]];
      await Promise.all(entries.map((entry, index) => tx.workoutPlanExercise.update({ where: { id: entry.id }, data: { sortOrder: index } })));
      return entries[targetIndex];
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw readableDatabaseError(error, "update");
  }
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
  assignCoach,
  listCoachClients,
  resetUserPassword,
  createUser,
  deleteUser,
  listCoaches,
  getCoachDetails,
  createCoach,
  updateCoach,
  updateCoachCredentials,
  deleteCoach,
  listAuditLogs,
  listPayments,
  getDatabaseSchema,
  getModelData,
  createModelRow,
  updateModelRow,
  deleteModelRow,
  moveWorkoutPlanExercise,
  getRelationOptions: getRelationOptionsFor
};

