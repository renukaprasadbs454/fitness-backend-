const coachRepository = require("../repositories/coach.repository");
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
  if (!coach || coach.id !== coachId) {
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
  const [items, total] = await Promise.all([
    coachRepository.listAppointmentsForCoach(coach.id, { skip, take: limit, status: query.status }),
    coachRepository.countAppointmentsForCoach(coach.id, query.status)
  ]);
  return { items, meta: buildMeta(page, limit, total) };
}

module.exports = {
  getMyCoachProfile,
  updateMyCoachProfile,
  getCoachById,
  listCoaches,
  deleteMyCoachProfile,
  setAvailability,
  listAvailability,
  listMyAppointments
};
