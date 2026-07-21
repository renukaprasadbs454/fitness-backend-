const bmiService = require("../services/bmi.service");
const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const httpStatus = require("../constants/httpStatus");

const calculate = asyncHandler(async (req, res) => {
  const result = await bmiService.calculate(req.user.id, req.body);
  return ApiResponse.success(res, httpStatus.CREATED, "BMI calculated", result);
});

const history = asyncHandler(async (req, res) => {
  const { items, meta } = await bmiService.history(req.user.id, req.query);
  return ApiResponse.success(res, httpStatus.OK, "BMI history retrieved", items, meta);
});

module.exports = { calculate, history };
