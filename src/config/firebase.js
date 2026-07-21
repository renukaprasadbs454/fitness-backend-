const env = require("./env");
const logger = require("./logger");

/**
 * Lazily initializes firebase-admin using a service account JSON supplied
 * via env var (base64-encoded, to keep it a single line in .env / secret
 * managers). If no credentials are configured, push sends are skipped
 * with a warning instead of crashing the app — this keeps local/dev
 * environments usable without a Firebase project.
 */
let messagingInstance = null;
let initAttempted = false;

function getMessaging() {
  if (initAttempted) return messagingInstance;
  initAttempted = true;

  if (!env.firebase.serviceAccountBase64) {
    logger.warn("[firebase] FCM_SERVICE_ACCOUNT_BASE64 not set — push notifications are disabled.");
    return null;
  }

  try {
    const admin = require("firebase-admin");
    const json = Buffer.from(env.firebase.serviceAccountBase64, "base64").toString("utf8");
    const serviceAccount = JSON.parse(json);

    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    }
    messagingInstance = admin.messaging();
    logger.info("[firebase] Firebase Admin initialized — push notifications enabled.");
    return messagingInstance;
  } catch (err) {
    logger.error(`[firebase] Failed to initialize Firebase Admin: ${err.message}`);
    return null;
  }
}

module.exports = { getMessaging };
