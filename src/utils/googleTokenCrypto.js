const crypto = require("crypto");
const env = require("../config/env");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getKey() {
  const key = env.google.tokenEncryptionKey;
  if (!key) {
    throw new Error("GOOGLE_TOKEN_ENCRYPTION_KEY is not configured");
  }
  const buf = Buffer.from(key, "hex");
  if (buf.length !== 32) {
    throw new Error("GOOGLE_TOKEN_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)");
  }
  return buf;
}

/** Encrypts a Google OAuth token for storage. Returns null for null/undefined input. */
function encrypt(plainText) {
  if (plainText == null) return null;

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

/** Decrypts a token previously stored via encrypt(). Returns null for null/undefined input. */
function decrypt(payload) {
  if (payload == null) return null;

  const raw = Buffer.from(payload, "base64");
  const iv = raw.subarray(0, IV_LENGTH);
  const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

module.exports = { encrypt, decrypt };
