const fs = require("fs");
const path = require("path");
const env = require("./env");
const logger = require("./logger");
const { cert, getApps, initializeApp } = require("firebase-admin/app");
const { getMessaging: getFirebaseMessaging } = require("firebase-admin/messaging");

/**
 * Lazily initializes firebase-admin using either:
 * 1. A serviceAccountKey.json file in BACKEND/ or custom path
 * 2. A base64-encoded service account in FCM_SERVICE_ACCOUNT_BASE64
 */
let messagingInstance = null;
let initAttempted = false;

function loadServiceAccount() {
  // 1. Direct file path if set
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH && fs.existsSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH)) {
    return JSON.parse(fs.readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH, "utf8"));
  }

  // 2. Default serviceAccountKey.json in BACKEND root
  const defaultFilePath = path.join(__dirname, "../../serviceAccountKey.json");
  if (fs.existsSync(defaultFilePath)) {
    return JSON.parse(fs.readFileSync(defaultFilePath, "utf8"));
  }

  // 3. Base64 environment variable
  if (env.firebase.serviceAccountBase64) {
    const json = Buffer.from(env.firebase.serviceAccountBase64, "base64").toString("utf8");
    return JSON.parse(json);
  }

  return null;
}

function getMessaging() {
  if (initAttempted) return messagingInstance;
  initAttempted = true;

  try {
    const serviceAccount = loadServiceAccount();
    if (!serviceAccount) {
      logger.warn("[firebase] No Firebase credentials found (checked serviceAccountKey.json and FCM_SERVICE_ACCOUNT_BASE64) — push notifications are disabled.");
      return null;
    }

    if (!getApps().length) {
      initializeApp({ credential: cert(serviceAccount) });
    }
    messagingInstance = getFirebaseMessaging();
    logger.info(`[firebase] Firebase Admin initialized (project: ${serviceAccount.project_id || "unknown"}) — push notifications enabled.`);
    return messagingInstance;
  } catch (err) {
    logger.error(`[firebase] Failed to initialize Firebase Admin: ${err.message}`);
    return null;
  }
}

module.exports = { getMessaging };
