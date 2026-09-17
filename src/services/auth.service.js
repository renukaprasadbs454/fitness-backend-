const userRepository = require("../repositories/user.repository");
const otpRepository = require("../repositories/otp.repository");
const tokenRepository = require("../repositories/token.repository");
const coachRepository = require("../repositories/coach.repository");
const tokenService = require("./token.service");
const { hashPassword, comparePassword, generateOtpCode, hashToken } = require("../utils/password");
const { sendEmail } = require("../utils/email");
const ApiError = require("../utils/ApiError");
const env = require("../config/env");
const logger = require("../config/logger");

function sanitizeUser(user) {
  // eslint-disable-next-line no-unused-vars
  const { passwordHash, ...safe } = user;
  return safe;
}

const OTP_EMAIL_COPY = {
  REGISTRATION: {
    subject: "Verify your FitNerve account",
    heading: "Welcome to FitNerve!",
    body: "Use the code below to verify your email and finish creating your account."
  },
  PASSWORD_RESET: {
    subject: "Your FitNerve password reset code",
    heading: "Reset your password",
    body: "Use the code below to reset your FitNerve password. If you didn't request this, you can safely ignore this email."
  }
};

async function issueOtp(userId, purpose, email) {
  await otpRepository.invalidateActive(userId, purpose);
  const { code, codeHash } = generateOtpCode();
  await otpRepository.createOtpCode({
    codeHash,
    userId,
    purpose,
    expiresAt: new Date(Date.now() + env.otp.expiresMin * 60 * 1000)
  });
  logger.info(`[otp] (dev) ${purpose} OTP for ${email}: ${code}`);

  const copy = OTP_EMAIL_COPY[purpose];
  const delivery = await sendEmail({
    to: email,
    subject: copy.subject,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>${copy.heading}</h2>
        <p>${copy.body}</p>
        <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 24px 0;">${code}</p>
        <p style="color: #64748B; font-size: 13px;">This code expires in ${env.otp.expiresMin} minutes.</p>
      </div>
    `
  });

  // sendEmail() is best-effort and resolves { sent: false } on any SMTP failure.
  // Outside production that is fine — the code is logged above and returned in the
  // API response — but in production a caller must never be told a code was sent
  // when it wasn't, or the user waits forever for an email that never arrives.
  if (!delivery.sent && env.nodeEnv === "production") {
    throw ApiError.internal("We couldn't send your verification email. Please try again in a moment.");
  }

  return code;
}

async function consumeOtp(userId, purpose, code) {
  const record = await otpRepository.findValidOtpCode(userId, purpose);
  if (!record) throw ApiError.badRequest("OTP is invalid or has expired");
  if (record.attempts >= env.otp.maxAttempts) {
    throw ApiError.badRequest("Too many incorrect attempts. Please request a new code.");
  }

  if (hashToken(code) !== record.codeHash) {
    await otpRepository.incrementAttempts(record.id);
    throw ApiError.badRequest("Invalid or expired verification code");
  }

  await otpRepository.markOtpCodeUsed(record.id);
}

async function register({ fullName, email, phone, password, role }) {
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

  await issueOtp(user.id, "REGISTRATION", user.email);
  logger.info(`New ${role} registered (pending verification): ${user.email}`);
  return { user: sanitizeUser(user), requiresVerification: true };
}

async function verifyEmail({ email, code }) {
  const user = await userRepository.findByEmail(email);
  if (!user) throw ApiError.badRequest("Invalid or expired verification code");

  await consumeOtp(user.id, "REGISTRATION", code);
  await userRepository.markEmailVerified(user.id);

  const verifiedUser = { ...user, isEmailVerified: true };
  const tokens = await tokenService.issueTokenPair(verifiedUser, null);
  return { user: sanitizeUser(verifiedUser), ...tokens };
}

async function resendOtp({ email, purpose }) {
  const user = await userRepository.findByEmail(email);
  // Always no-op silently if the user doesn't exist, to avoid leaking which emails are registered.
  if (!user) return;

  await issueOtp(user.id, purpose, user.email);
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

  const otpCode = await issueOtp(user.id, "PASSWORD_RESET", email);
  return { otpCode }; // returned only for dev/testing convenience
}

async function resetPassword({ email, code, newPassword }) {
  const user = await userRepository.findByEmail(email);
  if (!user) throw ApiError.badRequest("OTP is invalid or has expired");

  await consumeOtp(user.id, "PASSWORD_RESET", code);

  const passwordHash = await hashPassword(newPassword);
  await userRepository.updatePassword(user.id, passwordHash);
  await tokenRepository.revokeAllUserTokens(user.id); // force re-login everywhere
}

module.exports = {
  register,
  verifyEmail,
  resendOtp,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  sanitizeUser
};
