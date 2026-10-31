const crypto = require("crypto");
const ms = require("../utils/ms");
const env = require("../config/env");
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require("../utils/jwt");
const tokenRepository = require("../repositories/token.repository");
const ApiError = require("../utils/ApiError");

async function issueTokenPair(user, ip) {
  const sessionId = crypto.randomUUID();
  const accessToken = signAccessToken({ sub: user.id, role: user.role, sid: sessionId });
  const refreshToken = signRefreshToken({ sub: user.id });

  await tokenRepository.createRefreshToken({
    id: sessionId,
    token: refreshToken,
    userId: user.id,
    expiresAt: new Date(Date.now() + ms(env.jwt.refreshExpiresIn)),
    createdByIp: ip || null
  });

  return { accessToken, refreshToken };
}

async function rotateRefreshToken(oldToken, ip) {
  let payload;
  try {
    payload = verifyRefreshToken(oldToken);
  } catch {
    throw ApiError.unauthorized("Invalid or expired refresh token");
  }

  const stored = await tokenRepository.findRefreshToken(oldToken);
  if (!stored || stored.revoked || stored.expiresAt < new Date()) {
    throw ApiError.unauthorized("Refresh token has been revoked or expired");
  }

  const userRepository = require("../repositories/user.repository");
  const user = await userRepository.findById(payload.sub);
  if (!user || !user.isActive) {
    throw ApiError.unauthorized("User no longer exists or is deactivated");
  }

  const sessionId = crypto.randomUUID();
  const newRefreshToken = signRefreshToken({ sub: user.id });

  const rotated = await tokenRepository.rotateRefreshToken(oldToken, {
    id: sessionId,
    token: newRefreshToken,
    userId: user.id,
    expiresAt: new Date(Date.now() + ms(env.jwt.refreshExpiresIn)),
    createdByIp: ip || null
  }, user.id);
  if (!rotated) throw ApiError.unauthorized("This session has already been refreshed or signed out. Please sign in again.");

  const newAccessToken = signAccessToken({ sub: user.id, role: user.role, sid: sessionId });
  return { accessToken: newAccessToken, refreshToken: newRefreshToken, user };
}

async function revokeToken(token) {
  const stored = await tokenRepository.findRefreshToken(token);
  if (!stored) return; // idempotent — already gone
  if (!stored.revoked) {
    await tokenRepository.revokeRefreshToken(token);
  }
}

module.exports = { issueTokenPair, rotateRefreshToken, revokeToken };
