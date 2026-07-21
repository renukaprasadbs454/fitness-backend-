const userService = require("../services/user.service");
const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const httpStatus = require("../constants/httpStatus");

const getMe = asyncHandler(async (req, res) => {
  const user = await userService.getMe(req.user.id);
  return ApiResponse.success(res, httpStatus.OK, "Profile retrieved", user);
});

const updateMe = asyncHandler(async (req, res) => {
  const profile = await userService.updateProfile(req.user.id, req.body);
  return ApiResponse.success(res, httpStatus.OK, "Profile updated", profile);
});

module.exports = { getMe, updateMe };
