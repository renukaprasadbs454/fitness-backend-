const workoutService = require("../services/workout.service");
const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const httpStatus = require("../constants/httpStatus");

const listPlans = asyncHandler(async (req, res) => {
  const { items, meta } = await workoutService.listPlans(req.query);
  return ApiResponse.success(res, httpStatus.OK, "Workout plans retrieved", items, meta);
});

const getPlanById = asyncHandler(async (req, res) => {
  const plan = await workoutService.getPlanById(req.params.id);
  return ApiResponse.success(res, httpStatus.OK, "Workout plan retrieved", plan);
});

const recommended = asyncHandler(async (req, res) => {
  const result = await workoutService.recommended(req.user.id);
  return ApiResponse.success(res, httpStatus.OK, "Recommended workouts retrieved", result);
});

const completePlan = asyncHandler(async (req, res) => {
  const result = await workoutService.completePlan(req.user.id, req.params.id);
  return ApiResponse.success(res, httpStatus.CREATED, "Workout marked complete", result);
});

const createPlan = asyncHandler(async (req, res) => {
  const plan = await workoutService.createPlan(req.body);
  return ApiResponse.success(res, httpStatus.CREATED, "Workout plan created", plan);
});

const updatePlan = asyncHandler(async (req, res) => {
  const plan = await workoutService.updatePlan(req.params.id, req.body);
  return ApiResponse.success(res, httpStatus.OK, "Workout plan updated", plan);
});

const deletePlan = asyncHandler(async (req, res) => {
  await workoutService.deletePlan(req.params.id);
  return ApiResponse.success(res, httpStatus.OK, "Workout plan deleted", null);
});

const listExercises = asyncHandler(async (req, res) => {
  const { items, meta } = await workoutService.listExercises(req.query);
  return ApiResponse.success(res, httpStatus.OK, "Exercises retrieved", items, meta);
});

const createExercise = asyncHandler(async (req, res) => {
  const exercise = await workoutService.createExercise(req.body);
  return ApiResponse.success(res, httpStatus.CREATED, "Exercise created", exercise);
});

const updateExercise = asyncHandler(async (req, res) => {
  const exercise = await workoutService.updateExercise(req.params.id, req.body);
  return ApiResponse.success(res, httpStatus.OK, "Exercise updated", exercise);
});

const deleteExercise = asyncHandler(async (req, res) => {
  await workoutService.deleteExercise(req.params.id);
  return ApiResponse.success(res, httpStatus.OK, "Exercise deleted", null);
});

const scheduleWorkout = asyncHandler(async (req, res) => {
  const schedule = await workoutService.scheduleWorkout(req.user.id, req.body);
  return ApiResponse.success(res, httpStatus.CREATED, "Workout scheduled", schedule);
});

const listSchedule = asyncHandler(async (req, res) => {
  const schedules = await workoutService.listSchedule(req.user.id, req.query);
  return ApiResponse.success(res, httpStatus.OK, "Scheduled workouts retrieved", schedules);
});

const updateScheduleStatus = asyncHandler(async (req, res) => {
  const schedule = await workoutService.updateScheduleStatus(req.user.id, req.params.id, req.body.status);
  return ApiResponse.success(res, httpStatus.OK, "Scheduled workout updated", schedule);
});

const cancelSchedule = asyncHandler(async (req, res) => {
  await workoutService.cancelSchedule(req.user.id, req.params.id);
  return ApiResponse.success(res, httpStatus.OK, "Scheduled workout cancelled", null);
});

module.exports = {
  listPlans,
  getPlanById,
  recommended,
  completePlan,
  createPlan,
  updatePlan,
  deletePlan,
  listExercises,
  createExercise,
  updateExercise,
  deleteExercise,
  scheduleWorkout,
  listSchedule,
  updateScheduleStatus,
  cancelSchedule
};
