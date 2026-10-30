const assignedWorkoutRepository = require("../repositories/assignedWorkout.repository");
const customWorkoutRepository = require("../repositories/customWorkout.repository");
const workoutRepository = require("../repositories/workout.repository");
const userRepository = require("../repositories/user.repository");
const coachRepository = require("../repositories/coach.repository");
const notificationService = require("./notification.service");
const customWorkoutService = require("./customWorkout.service");
const ApiError = require("../utils/ApiError");
const { parsePagination, buildMeta } = require("../utils/pagination");
const { toPlanDto } = require("./workout.service");

async function requireUser(userId) {
  const user = await userRepository.findById(userId);
  if (!user) throw ApiError.notFound("User not found");
  return user;
}

// An ADMIN may attribute an assignment to a specific coach
// (the app then shows the workout as "Personalised workout from <coach>")
// instead of it always coming from the caller's own account, and only onto an
// actual COACH.
async function resolveEffectiveAssigner(callerId, callerRole, asCoachUserId) {
  if (!asCoachUserId || asCoachUserId === callerId) return callerId;

  if (callerRole !== "ADMIN") {
    throw ApiError.forbidden("Only an admin can assign a workout on behalf of another coach");
  }

  const coach = await coachRepository.findByUserId(asCoachUserId);
  if (!coach) throw ApiError.notFound("Coach not found");

  return asCoachUserId;
}

function toPlanAssignmentDto(assignment) {
  return {
    id: assignment.id,
    userId: assignment.userId,
    note: assignment.note,
    scheduledAt: assignment.scheduledAt,
    createdAt: assignment.createdAt,
    plan: toPlanDto(assignment.plan),
    user: assignment.user ? { id: assignment.user.id, fullName: assignment.user.fullName, email: assignment.user.email } : undefined,
    assignedBy: assignment.assignedByUser
      ? { id: assignment.assignedByUser.id, fullName: assignment.assignedByUser.fullName, email: assignment.assignedByUser.email }
      : undefined
  };
}

function toCustomAssignmentDto(workout) {
  return {
    id: workout.id,
    title: workout.title,
    description: workout.description,
    durationMinutes: workout.durationMinutes,
    difficulty: workout.difficulty,
    categoryKey: workout.categoryKey,
    createdAt: workout.createdAt,
    user: { id: workout.user.id, fullName: workout.user.fullName, email: workout.user.email },
    exercises: workout.exercises.map((e) => ({
      id: e.id,
      name: e.name,
      muscleGroup: e.muscleGroup,
      equipment: e.equipment,
      sets: e.sets,
      reps: e.reps
    }))
  };
}

// Coaches may only act on the users an admin has assigned to them; admins may
// act on anyone. Everyone else has no business assigning workouts.
async function assertCanAssignTo(callerId, callerRole, targetUser) {
  if (callerRole === "ADMIN") return;
  if (callerRole === "COACH") {
    const coach = await coachRepository.findByUserId(callerId);
    if (coach && targetUser.isActive && targetUser.role === "USER" && targetUser.assignedCoachId === coach.id) return;
    throw ApiError.forbidden("This user is not assigned to you");
  }
  throw ApiError.forbidden("Only coaches and admins can assign workouts");
}

async function searchUsers(currentUserId, search, callerRole) {
  let assignedCoachId;
  let wide = callerRole === "ADMIN";
  if (callerRole === "COACH") {
    const coach = await coachRepository.findByUserId(currentUserId);
    if (!coach) return [];
    assignedCoachId = coach.id;
  } else if (callerRole !== "ADMIN") {
    throw ApiError.forbidden("Only coaches and admins can search users");
  }

  const results = await userRepository.searchLite({
    search,
    take: wide ? 50 : 20,
    assignedCoachId,
    role: callerRole === "ADMIN" ? undefined : "USER"
  });
  return results.filter((u) => u.id !== currentUserId && u.isActive !== false);
}

async function assignPlan(callerId, { userId, planId, note, scheduledAt, asCoachUserId }, callerRole) {
  const assignedByUserId = await resolveEffectiveAssigner(callerId, callerRole, asCoachUserId);
  if (userId === assignedByUserId) throw ApiError.badRequest("You can't assign a workout to yourself");
  const targetUser = await requireUser(userId);
  await assertCanAssignTo(callerId, callerRole, targetUser);

  const plan = await workoutRepository.findPlanById(planId);
  if (!plan) throw ApiError.notFound("Workout plan not found");

  const assignment = await assignedWorkoutRepository.createPlanAssignment({
    userId,
    assignedByUserId,
    createdByUserId: callerId,
    planId,
    note,
    scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined
  });

  await notificationService.notify(userId, "WORKOUT_ASSIGNED", "New workout assigned", `You were assigned "${plan.title}".`);

  return toPlanAssignmentDto(assignment);
}

// Either the sender or the recipient of an assignment can remove it —
// the recipient may not want it cluttering their list, and the sender may
// want to retract it.
async function assertCoachOwnsActiveAssignment(actingUserId, assignment, callerRole) {
  if (callerRole !== "COACH") return;
  const coach = await coachRepository.findByUserId(actingUserId);
  if (!coach || (assignment.assignedByUserId !== actingUserId && assignment.createdByUserId !== actingUserId)) {
    throw ApiError.forbidden("This workout was not assigned by you");
  }
  if (assignment.user?.assignedCoachId !== coach.id || !assignment.user?.isActive) {
    throw ApiError.forbidden("This client is no longer assigned to you");
  }
}

async function unassignPlan(actingUserId, id, callerRole) {
  const assignment = await assignedWorkoutRepository.findPlanAssignmentByIdForParty(id, actingUserId);
  if (!assignment) throw ApiError.notFound("Assigned workout not found");
  await assertCoachOwnsActiveAssignment(actingUserId, assignment, callerRole);
  await assignedWorkoutRepository.deletePlanAssignment(id);
}

async function updateAssignedPlan(actingUserId, id, { note, scheduledAt }, callerRole) {
  const assignment = await assignedWorkoutRepository.findPlanAssignmentByIdForParty(id, actingUserId);
  if (!assignment) throw ApiError.notFound("Assigned workout not found");
  await assertCoachOwnsActiveAssignment(actingUserId, assignment, callerRole);

  const updated = await assignedWorkoutRepository.updatePlanAssignment(id, {
    note: note !== undefined ? note : assignment.note,
    scheduledAt: scheduledAt !== undefined ? (scheduledAt ? new Date(scheduledAt) : null) : assignment.scheduledAt
  });

  return toPlanAssignmentDto(updated);
}

async function assignCustom(callerId, { userId, asCoachUserId, ...workoutData }, callerRole) {
  const assignedByUserId = await resolveEffectiveAssigner(callerId, callerRole, asCoachUserId);
  if (userId === assignedByUserId) throw ApiError.badRequest("You can't assign a workout to yourself");
  const targetUser = await requireUser(userId);
  await assertCanAssignTo(callerId, callerRole, targetUser);

  const workout = await customWorkoutRepository.create(userId, {
    ...workoutData,
    assignedByUserId,
    createdByUserId: callerId
  });

  await notificationService.notify(userId, "WORKOUT_ASSIGNED", "New workout assigned", `You were sent a new workout: "${workout.title}".`);

  return customWorkoutService.toDto(workout);
}

async function updateCustomAssignment(callerId, id, data, callerRole) {
  const existing = await assignedWorkoutRepository.findCustomByIdForAssigner(id, callerId);
  if (!existing) throw ApiError.notFound("Assigned workout not found");
  await assertCoachOwnsActiveAssignment(callerId, existing, callerRole);

  await customWorkoutRepository.update(id, data);
  const updated = await assignedWorkoutRepository.findCustomByIdForAssigner(id, callerId);

  await notificationService.notify(
    existing.userId,
    "WORKOUT_ASSIGNED",
    "Workout updated",
    `Your coach updated "${updated.title}".`
  );

  return toCustomAssignmentDto(updated);
}

async function removeCustomAssignment(callerId, id, callerRole) {
  const existing = await assignedWorkoutRepository.findCustomByIdForAssigner(id, callerId);
  if (!existing) throw ApiError.notFound("Assigned workout not found");
  await assertCoachOwnsActiveAssignment(callerId, existing, callerRole);
  await customWorkoutRepository.delete(id);
}

async function listMyAssignments(callerId, query, callerRole) {
  const { page, limit, skip } = parsePagination(query);
  const coach = callerRole === "COACH" ? await coachRepository.findByUserId(callerId) : null;
  if (callerRole === "COACH" && !coach) throw ApiError.forbidden("Coach profile not found for this account");
  const assignedCoachId = coach?.id;

  const [planItems, planTotal, customItems, customTotal] = await Promise.all([
    assignedWorkoutRepository.listPlanAssignmentsForAssigner(callerId, { skip, take: limit, assignedCoachId }),
    assignedWorkoutRepository.countPlanAssignmentsForAssigner(callerId, assignedCoachId),
    assignedWorkoutRepository.listCustomAssignedByUser(callerId, { skip, take: limit, assignedCoachId }),
    assignedWorkoutRepository.countCustomAssignedByUser(callerId, assignedCoachId)
  ]);

  return {
    planAssignments: { items: planItems.map(toPlanAssignmentDto), meta: buildMeta(page, limit, planTotal) },
    customAssignments: { items: customItems.map(toCustomAssignmentDto), meta: buildMeta(page, limit, customTotal) }
  };
}

async function listAssignedForUser(userId) {
  const items = await assignedWorkoutRepository.listPlanAssignmentsForUser(userId);
  return items.map((assignment) => ({
    id: assignment.id,
    note: assignment.note,
    scheduledAt: assignment.scheduledAt,
    createdAt: assignment.createdAt,
    plan: toPlanDto(assignment.plan),
    assignedByName: assignment.assignedByUser.fullName
  }));
}

module.exports = {
  searchUsers,
  assignPlan,
  unassignPlan,
  updateAssignedPlan,
  assignCustom,
  updateCustomAssignment,
  removeCustomAssignment,
  listMyAssignments,
  listAssignedForUser
};
