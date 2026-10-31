const customWorkoutService = require("../services/customWorkout.service");
const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const httpStatus = require("../constants/httpStatus");

const list = asyncHandler(async (req, res) => {
  const items = await customWorkoutService.listMine(req.user.id);
  return ApiResponse.success(res, httpStatus.OK, "Custom workouts retrieved", items);
});

const getById = asyncHandler(async (req, res) => {
  const workout = await customWorkoutService.getMine(req.user.id, req.params.id);
  return ApiResponse.success(res, httpStatus.OK, "Custom workout retrieved", workout);
});

const create = asyncHandler(async (req, res) => {
  const workout = await customWorkoutService.create(req.user.id, req.body);
  return ApiResponse.success(res, httpStatus.CREATED, "Custom workout created", workout);
});

const update = asyncHandler(async (req, res) => {
  const workout = await customWorkoutService.update(req.user.id, req.params.id, req.body);
  return ApiResponse.success(res, httpStatus.OK, "Custom workout updated", workout);
});

const remove = asyncHandler(async (req, res) => {
  await customWorkoutService.remove(req.user.id, req.params.id);
  return ApiResponse.success(res, httpStatus.OK, "Custom workout deleted", null);
});

const complete = asyncHandler(async (req, res) => {
  const workout = await customWorkoutService.completeAssigned(req.user.id, req.params.id);
  return ApiResponse.success(res, httpStatus.OK, "Custom workout marked complete", workout);
});

module.exports = { list, getById, create, update, remove, complete };
