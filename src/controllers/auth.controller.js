const authService = require("../services/auth.service");
const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const httpStatus = require("../constants/httpStatus");
const env = require("../config/env");

const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);
  return ApiResponse.success(
    res,
    httpStatus.CREATED,
    "Account created. Check your email for a verification code.",
    result
  );
});

const verifyEmail = asyncHandler(async (req, res) => {
  const result = await authService.verifyEmail(req.body);
  return ApiResponse.success(res, httpStatus.OK, "Email verified successfully", result);
});

const resendOtp = asyncHandler(async (req, res) => {
  await authService.resendOtp(req.body);
  return ApiResponse.success(res, httpStatus.OK, "If an account with that email exists, a new code has been sent", null);
});

const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body, req.ip);
  return ApiResponse.success(res, httpStatus.OK, "Login successful", result);
});

const refresh = asyncHandler(async (req, res) => {
  const result = await authService.refresh(req.body.refreshToken, req.ip);
  return ApiResponse.success(res, httpStatus.OK, "Token refreshed", result);
});

const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.body.refreshToken);
  return ApiResponse.success(res, httpStatus.OK, "Logged out successfully", null);
});

const forgotPassword = asyncHandler(async (req, res) => {
  const result = await authService.forgotPassword(req.body.email);
  const data = env.nodeEnv !== "production" ? result : null; // otpCode only surfaced outside prod
  return ApiResponse.success(
    res,
    httpStatus.OK,
    "If an account with that email exists, a verification code has been sent",
    data
  );
});

const resetPassword = asyncHandler(async (req, res) => {
  await authService.resetPassword(req.body);
  return ApiResponse.success(res, httpStatus.OK, "Password has been reset successfully", null);
});

module.exports = {
  register,
  verifyEmail,
  resendOtp,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword
};
