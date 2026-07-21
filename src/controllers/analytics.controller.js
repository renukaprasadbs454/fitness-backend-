const analyticsService = require("../services/analytics.service");
const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const httpStatus = require("../constants/httpStatus");

const overview = asyncHandler(async (req, res) => {
  const data = await analyticsService.overview();
  return ApiResponse.success(res, httpStatus.OK, "Analytics overview retrieved", data);
});

const userGrowth = asyncHandler(async (req, res) => {
  const data = await analyticsService.userGrowth({ days: req.query.days ? Number(req.query.days) : 30 });
  return ApiResponse.success(res, httpStatus.OK, "User growth retrieved", data);
});

const engagement = asyncHandler(async (req, res) => {
  const data = await analyticsService.engagementMetrics({
    days: req.query.days ? Number(req.query.days) : 30
  });
  return ApiResponse.success(res, httpStatus.OK, "Engagement metrics retrieved", data);
});

const workoutStats = asyncHandler(async (req, res) => {
  const data = await analyticsService.workoutStats();
  return ApiResponse.success(res, httpStatus.OK, "Workout stats retrieved", data);
});

const coachPerformance = asyncHandler(async (req, res) => {
  const data = await analyticsService.coachPerformance();
  return ApiResponse.success(res, httpStatus.OK, "Coach performance retrieved", data);
});

module.exports = { overview, userGrowth, engagement, workoutStats, coachPerformance };
