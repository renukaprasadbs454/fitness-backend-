const meetingService = require("../services/meeting.service");
const adminRepository = require("../repositories/admin.repository");
const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const httpStatus = require("../constants/httpStatus");
const env = require("../config/env");
const logger = require("../config/logger");

function meetRedirectUri(req) {
  return (
    env.google.meetRedirectUri ||
    `${req.protocol}://${req.get("host")}/api/${env.apiVersion}/integrations/google-meet/callback`
  );
}

const googleMeetStatus = asyncHandler(async (req, res) => {
  const status = await meetingService.getStatus();
  return ApiResponse.success(res, httpStatus.OK, "Google Meet integration status", {
    ...status,
    redirectUri: meetRedirectUri(req)
  });
});

const googleMeetConnectUrl = asyncHandler(async (req, res) => {
  const url = meetingService.buildConnectUrl(req.user.id, meetRedirectUri(req));
  return ApiResponse.success(res, httpStatus.OK, "Open this URL to connect the Google account", { url });
});

const googleMeetDisconnect = asyncHandler(async (req, res) => {
  await meetingService.disconnect();
  await adminRepository.createAuditLog(req.user.id, "DISCONNECT_INTEGRATION", "INTEGRATION", "GOOGLE_MEET", {});
  return ApiResponse.success(res, httpStatus.OK, "Google account disconnected", null);
});

// Google redirects the admin's browser here, so the outcome is shown by
// sending them back to the admin portal rather than returning JSON.
async function googleMeetCallback(req, res) {
  const back = (params) =>
    res.redirect(`/admin?${new URLSearchParams({ integration: "google-meet", ...params }).toString()}`);

  if (req.query.error) {
    const message = req.query.error === "access_denied" ? "Access was not granted." : String(req.query.error);
    return back({ status: "error", message });
  }

  try {
    const { accountEmail, adminId } = await meetingService.completeConnect({
      code: req.query.code,
      state: req.query.state
    });
    await adminRepository
      .createAuditLog(adminId, "CONNECT_INTEGRATION", "INTEGRATION", "GOOGLE_MEET", { accountEmail })
      .catch((err) => logger.warn(`[meet] audit log failed: ${err.message}`));
    return back({ status: "connected", account: accountEmail || "" });
  } catch (err) {
    return back({ status: "error", message: err.message || "Connection failed" });
  }
}

module.exports = { googleMeetStatus, googleMeetConnectUrl, googleMeetDisconnect, googleMeetCallback };
