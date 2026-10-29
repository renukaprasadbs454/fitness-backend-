const coachRepository = require("../repositories/coach.repository");
const userRepository = require("../repositories/user.repository");
const adminRepository = require("../repositories/admin.repository");
const ApiError = require("../utils/ApiError");
const { parsePagination, buildMeta } = require("../utils/pagination");
const appointmentRepository = require("../repositories/appointment.repository");
const prisma = require("../database/prismaClient");
const { hashPassword } = require("../utils/password");
const { generateUniqueUsername } = require("../utils/username");

async function getMyCoachProfile(userId) {
  const coach = await coachRepository.findByUserId(userId);
  if (!coach) throw ApiError.notFound("Coach profile not found for this account");
  return coach;
}

async function updateMyCoachProfile(userId, data) {
  const coach = await coachRepository.findByUserId(userId);
  if (!coach) throw ApiError.notFound("Coach profile not found for this account");
  return coachRepository.update(coach.id, data);
}

// Only the head coach may edit another coach's profile.
async function updateCoachProfileAsHead(userId, coachId, data) {
  const caller = await coachRepository.findByUserId(userId);
  if (!caller) throw ApiError.notFound("Coach profile not found for this account");
  if (caller.id !== coachId && !caller.isHeadCoach) {
    throw ApiError.forbidden("Only the head coach can edit another coach's profile");
  }
  const target = await coachRepository.findById(coachId);
  if (!target) throw ApiError.notFound("Coach not found");
  return coachRepository.update(coachId, data);
}

async function requireHeadCoach(userId) {
  const caller = await coachRepository.findByUserId(userId);
  if (!caller?.isHeadCoach) throw ApiError.forbidden("Only the head coach can add or remove coaches");
  return caller;
}

// Head coach: turn an existing user into a coach (or update their coach profile).
// Creates a brand-new coach account (no existing user needed). The head coach chooses the
// password and hands it over; the account is marked verified so the coach can sign in straight away.
async function createNewCoachAccount(headUserId, { fullName, email, phone, password, ...coachData }) {
  if (await userRepository.findByEmail(email)) throw ApiError.conflict("An account with this email already exists");
  if (phone && (await userRepository.findByPhone(phone))) throw ApiError.conflict("An account with this phone number already exists");

  const user = await userRepository.create({
    fullName,
    email,
    phone,
    passwordHash: await hashPassword(password),
    role: "COACH",
    username: await generateUniqueUsername(email),
    isEmailVerified: true
  });
  await userRepository.createProfile(user.id, {});
  const coach = await coachRepository.create({ userId: user.id, specialties: [], ...coachData });

  await adminRepository.createAuditLog(headUserId, "CREATE_COACH", "COACH", coach.id, { userId: user.id, by: "head-coach", newAccount: true });
  return coachRepository.findById(coach.id);
}

async function createCoachAsHead(userId, { userId: targetUserId, fullName, email, phone, password, ...coachData }) {
  await requireHeadCoach(userId);
  if (!targetUserId) return createNewCoachAccount(userId, { fullName, email, phone, password, ...coachData });

  const user = await userRepository.findById(targetUserId);
  if (!user) throw ApiError.notFound("User not found");
  if (user.role === "ADMIN") throw ApiError.badRequest("Admin accounts can't be made coaches");

  const existing = await coachRepository.findByUserId(targetUserId);
  if (user.role !== "COACH") await userRepository.updateRole(targetUserId, "COACH");
  const coach = existing
    ? await coachRepository.update(existing.id, coachData)
    : await coachRepository.create({ userId: targetUserId, specialties: [], ...coachData });

  await adminRepository.createAuditLog(userId, "CREATE_COACH", "COACH", coach.id, { userId: targetUserId, by: "head-coach" });
  return coachRepository.findById(coach.id);
}

// Head coach: remove a coach profile. The account goes back to a regular user; the
// coach's availability, sessions and chats are removed with it, and their clients
// become unassigned.
async function deleteCoachAsHead(userId, coachId) {
  const caller = await requireHeadCoach(userId);
  if (caller.id === coachId) throw ApiError.badRequest("You can't remove your own coach profile here");
  const target = await coachRepository.findById(coachId);
  if (!target) throw ApiError.notFound("Coach not found");
  if (target.isHeadCoach) throw ApiError.forbidden("The head coach can't be removed. Ask an admin to change the head coach first.");

  await coachRepository.delete(coachId);
  await userRepository.updateRole(target.userId, "USER");
  await adminRepository.createAuditLog(userId, "DELETE_COACH", "COACH", coachId, { userId: target.userId, by: "head-coach" });
}

async function getCoachById(id) {
  const coach = await coachRepository.findById(id);
  if (!coach) throw ApiError.notFound("Coach not found");
  return coach;
}

async function listCoaches({ page, limit, specialty, sortBy, sortOrder }) {
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    coachRepository.list({ skip, take: limit, specialty, sortBy, sortOrder }),
    coachRepository.count(specialty)
  ]);
  return {
    items,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 }
  };
}

async function deleteMyCoachProfile(userId) {
  const coach = await coachRepository.findByUserId(userId);
  if (!coach) throw ApiError.notFound("Coach profile not found for this account");
  await coachRepository.delete(coach.id);
}

async function setAvailability(userId, coachId, slot) {
  const coach = await coachRepository.findByUserId(userId);
  if (!coach || (coach.id !== coachId && !coach.isHeadCoach)) {
    throw ApiError.forbidden("You can only manage your own availability");
  }
  if (slot.startTime >= slot.endTime) {
    throw ApiError.badRequest("startTime must be earlier than endTime");
  }
  return coachRepository.upsertAvailabilitySlot(coachId, slot);
}

// A coach manages their own slots; the head coach can manage anyone's.
async function loadSlotForChange(userId, coachId, slotId) {
  const caller = await coachRepository.findByUserId(userId);
  if (!caller || (caller.id !== coachId && !caller.isHeadCoach)) {
    throw ApiError.forbidden("You can only manage your own availability");
  }
  const slot = await coachRepository.findAvailabilitySlot(slotId);
  if (!slot || slot.coachId !== coachId) throw ApiError.notFound("Availability slot not found");
  return slot;
}

async function updateAvailabilitySlot(userId, coachId, slotId, changes) {
  const slot = await loadSlotForChange(userId, coachId, slotId);
  const next = { ...slot, ...changes };
  if (next.startTime >= next.endTime) throw ApiError.badRequest("startTime must be earlier than endTime");

  const clash = (await coachRepository.listAvailability(coachId)).some(
    (other) => other.id !== slotId && other.dayOfWeek === next.dayOfWeek && other.startTime === next.startTime
  );
  if (clash) throw ApiError.conflict(`There is already a ${next.dayOfWeek.toLowerCase()} slot starting at ${next.startTime}`);

  return coachRepository.updateAvailabilitySlot(slotId, changes);
}

async function deleteAvailabilitySlot(userId, coachId, slotId) {
  await loadSlotForChange(userId, coachId, slotId);
  await coachRepository.deleteAvailabilitySlot(slotId);
}

async function listAvailability(coachId) {
  await getCoachById(coachId); // 404s if coach doesn't exist
  return coachRepository.listAvailability(coachId);
}

/**
 * The Clients page. A coach sees the clients that are theirs: assigned to them, or booked with them
 * since any coach swap. The head coach sees every client account and which coach each one belongs to.
 * `relation` says how each client relates to the signed-in coach.
 */
async function listMyClients(userId) {
  const coach = await coachRepository.findByUserId(userId);
  if (!coach) throw ApiError.notFound("Coach profile not found for this account");

  // A coach's active client list follows the current assignment only. Historical
  // bookings and messages remain available to admins, not to a former coach.
  const ids = coach.isHeadCoach ? undefined : await userRepository.listClientIdsOfCoach(coach.id);
  const users = ids && !ids.length ? [] : await userRepository.listClientsOverview(ids);
  const activeUsers = users.filter((u) => u.isActive);
  const counts = await appointmentRepository.countsByClient(
    activeUsers.map((u) => u.id),
    coach.isHeadCoach ? undefined : coach.id
  );

  const clients = activeUsers.map((u) => {
    const mine = u.assignedCoachId === coach.id;
    const relation = mine ? "mine" : coach.isHeadCoach ? u.assignedCoachId ? "other" : "unassigned" : "booked";
    const { total = 0, upcoming = 0 } = counts.get(u.id) || {};
    return {
      id: u.id,
      fullName: u.fullName,
      username: u.username,
      email: u.email,
      isActive: u.isActive,
      relation,
      assignedCoach: u.assignedCoach ? { id: u.assignedCoach.id, name: u.assignedCoach.user.fullName } : null,
      sessions: total,
      upcomingSessions: upcoming
    };
  });

  // Mine first, then by name.
  const rank = { mine: 0, booked: 1, other: 2, unassigned: 3 };
  clients.sort((a, b) => rank[a.relation] - rank[b.relation] || a.fullName.localeCompare(b.fullName));

  const count = (relation) => clients.filter((c) => c.relation === relation).length;
  return {
    clients,
    summary: { total: clients.length, mine: count("mine"), booked: count("booked"), other: count("other"), unassigned: count("unassigned") }
  };
}

async function listMyAppointments(userId, query) {
  const coach = await coachRepository.findByUserId(userId);
  if (!coach) throw ApiError.notFound("Coach profile not found for this account");

  const { page, limit, skip } = parsePagination(query);
  // The head coach sees every coach's sessions. Other coaches see sessions for
  // their active, currently assigned clients only.
  const scopeCoachId = coach.isHeadCoach ? query.coachId || undefined : coach.id;
  let [items, total] = await Promise.all([
    coachRepository.listAppointmentsForCoach(scopeCoachId, { skip, take: limit, status: query.status }),
    coachRepository.countAppointmentsForCoach(scopeCoachId, query.status)
  ]);
  if (!coach.isHeadCoach) {
    const clientIds = await userRepository.listClientIdsOfCoach(coach.id);
    const activeIds = new Set((await userRepository.listClientsOverview(clientIds)).filter((u) => u.isActive).map((u) => u.id));
    items = items.filter((a) => activeIds.has(a.userId));
    total = await prisma.appointment.count({
      where: { coachId: coach.id, userId: { in: [...activeIds] }, status: query.status || undefined }
    });
  }
  return { items, meta: buildMeta(page, limit, total) };
}

module.exports = {
  getMyCoachProfile,
  updateMyCoachProfile,
  updateCoachProfileAsHead,
  createCoachAsHead,
  deleteCoachAsHead,
  getCoachById,
  listCoaches,
  deleteMyCoachProfile,
  setAvailability,
  updateAvailabilitySlot,
  deleteAvailabilitySlot,
  listAvailability,
  listMyClients,
  listMyAppointments
};
