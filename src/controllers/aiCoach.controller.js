const chatService = require("../services/aiCoach.service");
const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const httpStatus = require("../constants/httpStatus");

const coachReply = asyncHandler(async (req, res) => {
  const result = await chatService.generateCoachReply(req.user.id, req.body);
  return ApiResponse.success(res, httpStatus.OK, "Coach reply generated", { reply: result });
});

module.exports = { coachReply };
