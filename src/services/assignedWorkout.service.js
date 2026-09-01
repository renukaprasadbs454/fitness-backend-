const assignedWorkoutRepository = require("../repositories/assignedWorkout.repository");
const customWorkoutRepository = require("../repositories/customWorkout.repository");
const workoutRepository = require("../repositories/workout.repository");
const userRepository = require("../repositories/user.repository");
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

async function searchUsers(currentUserId, search) {
  const results = await userRepository.searchLite({ search, take: 20 });
  return results.filter((u) => u.id !== currentUserId);
}

async function assignPlan(assignedByUserId, { userId, planId, note, scheduledAt }) {
  if (userId === assignedByUserId) throw ApiError.badRequest("You can't assign a workout to yourself");
  await requireUser(userId);

  const plan = await workoutRepository.findPlanById(planId);
  if (!plan) throw ApiError.notFound("Workout plan not found");

  const assignment = await assignedWorkoutRepository.createPlanAssignment({
    userId,
    assignedByUserId,
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
async function unassignPlan(actingUserId, id) {
  const assignment = await assignedWorkoutRepository.findPlanAssignmentByIdForParty(id, actingUserId);
  if (!assignment) throw ApiError.notFound("Assigned workout not found");
  await assignedWorkoutRepository.deletePlanAssignment(id);
}

async function updateAssignedPlan(actingUserId, id, { note, scheduledAt }) {
  const assignment = await assignedWorkoutRepository.findPlanAssignmentByIdForParty(id, actingUserId);
  if (!assignment) throw ApiError.notFound("Assigned workout not found");

  const updated = await assignedWorkoutRepository.updatePlanAssignment(id, {
    note: note !== undefined ? note : assignment.note,
    scheduledAt: scheduledAt !== undefined ? (scheduledAt ? new Date(scheduledAt) : null) : assignment.scheduledAt
  });

  return toPlanAssignmentDto(updated);
}

async function assignCustom(assignedByUserId, { userId, ...workoutData }) {
  if (userId === assignedByUserId) throw ApiError.badRequest("You can't assign a workout to yourself");
  await requireUser(userId);

  const workout = await customWorkoutRepository.create(userId, {
    ...workoutData,
    assignedByUserId
  });

  await notificationService.notify(userId, "WORKOUT_ASSIGNED", "New workout assigned", `You were sent a new workout: "${workout.title}".`);

  return customWorkoutService.toDto(workout);
}

async function listMyAssignments(assignedByUserId, query) {
  const { page, limit, skip } = parsePagination(query);

  const [planItems, planTotal, customItems, customTotal] = await Promise.all([
    assignedWorkoutRepository.listPlanAssignmentsForAssigner(assignedByUserId, { skip, take: limit }),
    assignedWorkoutRepository.countPlanAssignmentsForAssigner(assignedByUserId),
    assignedWorkoutRepository.listCustomAssignedByUser(assignedByUserId, { skip, take: limit }),
    assignedWorkoutRepository.countCustomAssignedByUser(assignedByUserId)
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
  listMyAssignments,
  listAssignedForUser
};
