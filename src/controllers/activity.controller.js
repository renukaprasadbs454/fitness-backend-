const activityService = require("../services/activity.service");
const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const httpStatus = require("../constants/httpStatus");

const logSteps = asyncHandler(async (req, res) => {
  const result = await activityService.logSteps(req.user.id, req.body);
  return ApiResponse.success(res, httpStatus.CREATED, "Steps logged", result);
});

const listSteps = asyncHandler(async (req, res) => {
  const { items, meta } = await activityService.listSteps(req.user.id, req.query);
  return ApiResponse.success(res, httpStatus.OK, "Step logs retrieved", items, meta);
});

const report = asyncHandler(async (req, res) => {
  const result = await activityService.report(req.user.id, req.query);
  return ApiResponse.success(res, httpStatus.OK, "Activity report retrieved", result);
});

const listFeed = asyncHandler(async (req, res) => {
  const { items, meta } = await activityService.listFeed(req.user.id, req.query);
  return ApiResponse.success(res, httpStatus.OK, "Activity feed retrieved", items, meta);
});

module.exports = { logSteps, listSteps, report, listFeed };
