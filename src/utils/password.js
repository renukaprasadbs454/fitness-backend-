const bcrypt = require("bcrypt");
const crypto = require("crypto");
const env = require("../config/env");

async function hashPassword(plain) {
  return bcrypt.hash(plain, env.bcryptSaltRounds);
}

async function comparePassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

/** Generates a URL-safe random token and its SHA-256 hash (for storing reset tokens). */
function generateResetToken() {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  return { rawToken, tokenHash };
}

function hashToken(rawToken) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/** Generates a 6-digit numeric OTP code and its SHA-256 hash (for storing OTP records). */
function generateOtpCode() {
  const code = crypto.randomInt(100000, 1000000).toString();
  const codeHash = hashToken(code);
  return { code, codeHash };
}

module.exports = { hashPassword, comparePassword, generateResetToken, hashToken, generateOtpCode };
