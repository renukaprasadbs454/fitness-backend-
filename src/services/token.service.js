const ms = require("../utils/ms");
const env = require("../config/env");
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require("../utils/jwt");
const tokenRepository = require("../repositories/token.repository");
const ApiError = require("../utils/ApiError");

async function issueTokenPair(user, ip) {
  const accessToken = signAccessToken({ sub: user.id, role: user.role });
  const refreshToken = signRefreshToken({ sub: user.id });

  await tokenRepository.createRefreshToken({
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

  const newAccessToken = signAccessToken({ sub: user.id, role: user.role });
  const newRefreshToken = signRefreshToken({ sub: user.id });

  await tokenRepository.createRefreshToken({
    token: newRefreshToken,
    userId: user.id,
    expiresAt: new Date(Date.now() + ms(env.jwt.refreshExpiresIn)),
    createdByIp: ip || null
  });
  await tokenRepository.revokeRefreshToken(oldToken, newRefreshToken);

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
