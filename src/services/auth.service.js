const userRepository = require("../repositories/user.repository");
const tokenRepository = require("../repositories/token.repository");
const coachRepository = require("../repositories/coach.repository");
const tokenService = require("./token.service");
const { hashPassword, comparePassword, generateResetToken, hashToken } = require("../utils/password");
const ApiError = require("../utils/ApiError");
const env = require("../config/env");
const logger = require("../config/logger");

function sanitizeUser(user) {
  // eslint-disable-next-line no-unused-vars
  const { passwordHash, ...safe } = user;
  return safe;
}

async function register({ fullName, email, phone, password, role }, ip) {
  const existing = await userRepository.findByEmail(email);
  if (existing) throw ApiError.conflict("An account with this email already exists");

  if (phone) {
    const existingPhone = await userRepository.findByPhone(phone);
    if (existingPhone) throw ApiError.conflict("An account with this phone number already exists");
  }

  const passwordHash = await hashPassword(password);
  const user = await userRepository.create({ fullName, email, phone, passwordHash, role });
  await userRepository.createProfile(user.id, {});

  if (role === "COACH") {
    await coachRepository.create({ userId: user.id, specialties: [] });
  }

  const tokens = await tokenService.issueTokenPair(user, ip);
  logger.info(`New ${role} registered: ${user.email}`);
  return { user: sanitizeUser(user), ...tokens };
}

async function login({ email, password }, ip) {
  const user = await userRepository.findByEmail(email);
  if (!user) throw ApiError.unauthorized("Invalid email or password");
  if (!user.isActive) throw ApiError.forbidden("This account has been deactivated");

  const isMatch = await comparePassword(password, user.passwordHash);
  if (!isMatch) throw ApiError.unauthorized("Invalid email or password");

  await userRepository.updateLastLogin(user.id);
  const tokens = await tokenService.issueTokenPair(user, ip);
  return { user: sanitizeUser(user), ...tokens };
}

async function refresh(refreshToken, ip) {
  const { accessToken, refreshToken: newRefreshToken, user } = await tokenService.rotateRefreshToken(
    refreshToken,
    ip
  );
  return { accessToken, refreshToken: newRefreshToken, user: sanitizeUser(user) };
}

async function logout(refreshToken) {
  await tokenService.revokeToken(refreshToken);
}

async function forgotPassword(email) {
  const user = await userRepository.findByEmail(email);
  // Always respond success-shaped to avoid leaking which emails are registered.
  if (!user) return;

  const { rawToken, tokenHash } = generateResetToken();
  await tokenRepository.createPasswordResetToken({
    tokenHash,
    userId: user.id,
    expiresAt: new Date(Date.now() + env.passwordReset.tokenExpiresMin * 60 * 1000)
  });

  const resetLink = `${env.passwordReset.urlBase}?token=${rawToken}`;
  // Email delivery is out of Phase 1 infra scope — log so it's testable end-to-end now
  // and swap in a real mailer (SES/SendGrid) without touching this service's contract.
  logger.info(`Password reset link for ${email}: ${resetLink}`);
  return { resetLink }; // returned only for dev/testing convenience
}

async function resetPassword(rawToken, newPassword) {
  const tokenHash = hashToken(rawToken);
  const record = await tokenRepository.findValidPasswordResetToken(tokenHash);
  if (!record) throw ApiError.badRequest("Reset token is invalid or has expired");

  const passwordHash = await hashPassword(newPassword);
  await userRepository.updatePassword(record.userId, passwordHash);
  await tokenRepository.markPasswordResetTokenUsed(record.id);
  await tokenRepository.revokeAllUserTokens(record.userId); // force re-login everywhere
}

module.exports = { register, login, refresh, logout, forgotPassword, resetPassword, sanitizeUser };
