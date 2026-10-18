const coachRepository = require("../repositories/coach.repository");
const userRepository = require("../repositories/user.repository");
const adminRepository = require("../repositories/admin.repository");
const ApiError = require("../utils/ApiError");
const { parsePagination, buildMeta } = require("../utils/pagination");

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
async function createCoachAsHead(userId, { userId: targetUserId, ...coachData }) {
  await requireHeadCoach(userId);
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

async function listAvailability(coachId) {
  await getCoachById(coachId); // 404s if coach doesn't exist
  return coachRepository.listAvailability(coachId);
}

async function listMyAppointments(userId, query) {
  const coach = await coachRepository.findByUserId(userId);
  if (!coach) throw ApiError.notFound("Coach profile not found for this account");

  const { page, limit, skip } = parsePagination(query);
  // The head coach sees every coach's sessions (pass coachId to narrow to one).
  const scopeCoachId = coach.isHeadCoach ? query.coachId || undefined : coach.id;
  const [items, total] = await Promise.all([
    coachRepository.listAppointmentsForCoach(scopeCoachId, { skip, take: limit, status: query.status }),
    coachRepository.countAppointmentsForCoach(scopeCoachId, query.status)
  ]);
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
  listAvailability,
  listMyAppointments
};
