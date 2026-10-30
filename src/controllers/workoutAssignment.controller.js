const assignedWorkoutService = require("../services/assignedWorkout.service");
const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const httpStatus = require("../constants/httpStatus");

const searchUsers = asyncHandler(async (req, res) => {
  const users = await assignedWorkoutService.searchUsers(req.user.id, req.query.search, req.user.role);
  return ApiResponse.success(res, httpStatus.OK, "Users retrieved", users);
});

const assignWorkoutPlan = asyncHandler(async (req, res) => {
  const assignment = await assignedWorkoutService.assignPlan(
    req.user.id,
    { userId: req.params.userId, ...req.body },
    req.user.role
  );
  return ApiResponse.success(res, httpStatus.CREATED, "Workout assigned", assignment);
});

const assignCustomWorkout = asyncHandler(async (req, res) => {
  const workout = await assignedWorkoutService.assignCustom(
    req.user.id,
    { userId: req.params.userId, ...req.body },
    req.user.role
  );
  return ApiResponse.success(res, httpStatus.CREATED, "Workout assigned", workout);
});

const listMyAssignedWorkouts = asyncHandler(async (req, res) => {
  const result = await assignedWorkoutService.listMyAssignments(req.user.id, req.query, req.user.role);
  return ApiResponse.success(res, httpStatus.OK, "Assigned workouts retrieved", result);
});

const unassignWorkoutPlan = asyncHandler(async (req, res) => {
  await assignedWorkoutService.unassignPlan(req.user.id, req.params.id, req.user.role);
  return ApiResponse.success(res, httpStatus.OK, "Assigned workout removed", null);
});

const updateAssignedWorkoutPlan = asyncHandler(async (req, res) => {
  const assignment = await assignedWorkoutService.updateAssignedPlan(req.user.id, req.params.id, req.body, req.user.role);
  return ApiResponse.success(res, httpStatus.OK, "Assigned workout updated", assignment);
});

const updateCustomAssignment = asyncHandler(async (req, res) => {
  const workout = await assignedWorkoutService.updateCustomAssignment(req.user.id, req.params.id, req.body, req.user.role);
  return ApiResponse.success(res, httpStatus.OK, "Assigned workout updated", workout);
});

const removeCustomAssignment = asyncHandler(async (req, res) => {
  await assignedWorkoutService.removeCustomAssignment(req.user.id, req.params.id, req.user.role);
  return ApiResponse.success(res, httpStatus.OK, "Assigned workout removed", null);
});

module.exports = {
  updateCustomAssignment,
  removeCustomAssignment,
  searchUsers,
  assignWorkoutPlan,
  assignCustomWorkout,
  listMyAssignedWorkouts,
  unassignWorkoutPlan,
  updateAssignedWorkoutPlan
};
