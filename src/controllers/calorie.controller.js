const calorieService = require("../services/calorie.service");
const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const httpStatus = require("../constants/httpStatus");

const calculate = asyncHandler(async (req, res) => {
  const result = await calorieService.calculate(req.user.id, req.body);
  return ApiResponse.success(res, httpStatus.CREATED, "Calorie target calculated", result);
});

const history = asyncHandler(async (req, res) => {
  const { items, meta } = await calorieService.history(req.user.id, req.query);
  return ApiResponse.success(res, httpStatus.OK, "Calorie history retrieved", items, meta);
});

module.exports = { calculate, history };
