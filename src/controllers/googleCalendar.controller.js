const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const httpStatus = require("../constants/httpStatus");
const env = require("../config/env");
const googleOAuthService = require("../services/googleOAuth.service");
const googleCalendarService = require("../services/googleCalendar.service");

const connectStart = asyncHandler(async (req, res) => {
  return ApiResponse.success(res, httpStatus.OK, "Google Calendar OAuth configuration", {
    scope: env.google.scopes,
    clientIds: {
      android: env.google.androidClientId || null,
      ios: env.google.iosClientId || null,
      web: env.google.webClientId || null
    }
  });
});

const exchange = asyncHandler(async (req, res) => {
  const { platform, code, codeVerifier, redirectUri } = req.body;
  const result = await googleOAuthService.connect({
    userId: req.user.id,
    platform,
    code,
    codeVerifier,
    redirectUri
  });
  return ApiResponse.success(res, httpStatus.OK, "Google Calendar connected", result);
});

const status = asyncHandler(async (req, res) => {
  const result = await googleCalendarService.status(req.user.id);
  return ApiResponse.success(res, httpStatus.OK, "Google Calendar connection status", result);
});

const disconnect = asyncHandler(async (req, res) => {
  await googleOAuthService.disconnect(req.user.id);
  return ApiResponse.success(res, httpStatus.OK, "Google Calendar disconnected", { connected: false });
});

module.exports = { connectStart, exchange, status, disconnect };
