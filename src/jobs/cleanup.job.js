const tokenRepository = require("../repositories/token.repository");
const otpRepository = require("../repositories/otp.repository");

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Deletes login tokens and verification codes that expired more than a day ago.
 * Neither can be used once expired; the one-day grace keeps recent rows around
 * for debugging a just-failed sign-in.
 */
async function runCleanupSweep(now = new Date()) {
  const before = new Date(now.getTime() - DAY_MS);
  const [tokens, otps] = await Promise.all([
    tokenRepository.deleteExpiredBefore(before),
    otpRepository.deleteExpiredBefore(before)
  ]);
  return { tokensDeleted: tokens.count, otpsDeleted: otps.count };
}

module.exports = { runCleanupSweep };
