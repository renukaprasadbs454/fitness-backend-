const logger = require("../config/logger");

/**
 * Phase 2 groundwork only. The device_tokens/notifications tables and the
 * /device-tokens + /notifications API surface are live now so mobile clients
 * can register tokens and read their notification feed. Actual FCM delivery
 * (admin SDK init, credential loading, send-to-token/topic) is wired in
 * Phase 3 per the system design doc — this module is the seam it will
 * plug into, so notification.service.notify() doesn't need to change shape
 * when that lands.
 */
let initialized = false;

function init() {
  if (initialized) return;
  if (!process.env.FIREBASE_PROJECT_ID) {
    logger.warn("[fcm] FIREBASE_PROJECT_ID not set — push delivery is inactive (Phase 3).");
  }
  initialized = true;
}

/**
 * No-op in Phase 2. Once firebase-admin is wired in Phase 3, this will call
 * admin.messaging().sendEachForMulticast({ tokens, notification: { title, body } }).
 */
async function sendToTokens(_tokens, { title, body }) {
  logger.info(`[fcm] (stub) would send push: "${title}" — ${body}`);
  return { sent: 0, stub: true };
}

module.exports = { init, sendToTokens };
