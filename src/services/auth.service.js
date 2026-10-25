const userRepository = require("../repositories/user.repository");
const otpRepository = require("../repositories/otp.repository");
const tokenRepository = require("../repositories/token.repository");
const coachRepository = require("../repositories/coach.repository");
const tokenService = require("./token.service");
const { generateUniqueUsername } = require("../utils/username");
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
  // Never in production: anyone who can read the server logs could use the code.
  if (env.nodeEnv !== "production") logger.info(`[otp] (dev) ${purpose} OTP for ${email}: ${code}`);

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
  if (!delivery.sent && env.nodeEnv === "production" && !env.otp.bypassCode) {
    throw ApiError.internal("We couldn't send your verification email. Please try again in a moment.");
  }

  return code;
}

function isBypassCode(code) {
  return Boolean(env.otp.bypassCode) && code === env.otp.bypassCode;
}

async function consumeOtp(userId, purpose, code) {
  if (isBypassCode(code)) {
    await otpRepository.invalidateActive(userId, purpose);
    return;
  }

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
  const username = await generateUniqueUsername(email);
  const user = await userRepository.create({ fullName, email, phone, passwordHash, role, username });
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

  if (env.otp.requireVerifiedLogin && user.role === "USER" && !user.isEmailVerified) {
    await issueOtp(user.id, "REGISTRATION", user.email);
    const err = ApiError.forbidden("Please verify your email first. We've sent a new code to your inbox.");
    err.code = "EMAIL_NOT_VERIFIED";
    throw err;
  }

  await userRepository.updateLastLogin(user.id);
  const tokens = await tokenService.issueTokenPair(user, ip);
  // Include the profile relation (photo, height/weight/age/gender) so the
  // client has it immediately, rather than only after a later GET /users/me.
  const userWithProfile = await userRepository.findByIdWithProfile(user.id);
  return { user: sanitizeUser(userWithProfile), ...tokens };
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
  // Deliberately tells the caller when no account exists, so the app can say so
  // instead of sending them to a code screen that can never succeed.
  if (!user) throw ApiError.notFound("No account found with this email.");

  const otpCode = await issueOtp(user.id, "PASSWORD_RESET", email);
  return { otpCode }; // returned only for dev/testing convenience
}

/** Checks a password-reset code without consuming it, so the app can gate the new-password screen. */
async function verifyResetCode({ email, code }) {
  const user = await userRepository.findByEmail(email);
  if (!user) throw ApiError.badRequest("OTP is invalid or has expired");
  if (isBypassCode(code)) return;

  const record = await otpRepository.findValidOtpCode(user.id, "PASSWORD_RESET");
  if (!record) throw ApiError.badRequest("OTP is invalid or has expired");
  if (record.attempts >= env.otp.maxAttempts) {
    throw ApiError.badRequest("Too many incorrect attempts. Please request a new code.");
  }

  if (hashToken(code) !== record.codeHash) {
    await otpRepository.incrementAttempts(record.id);
    throw ApiError.badRequest("Invalid or expired verification code");
  }
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
  verifyResetCode,
  resetPassword,
  sanitizeUser
};
