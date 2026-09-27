const router = require("express").Router();
const authController = require("../../controllers/auth.controller");
const validate = require("../../middlewares/validate.middleware");
const { authLimiter } = require("../../middlewares/rateLimiter.middleware");
const schemas = require("../../validators/auth.validator");

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Registration, login, tokens, password reset
 */

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user or coach account
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/RegisterRequest' }
 *     responses:
 *       201: { description: Account created }
 *       409: { description: Email or phone already in use }
 */
router.post("/register", authLimiter, validate(schemas.register), authController.register);

/**
 * @swagger
 * /auth/verify-email:
 *   post:
 *     summary: Verify a registration OTP code and receive tokens
 *     tags: [Auth]
 *     responses:
 *       200: { description: Email verified, tokens issued }
 *       400: { description: Invalid or expired code }
 */
router.post(
  "/verify-email",
  authLimiter,
  validate(schemas.verifyEmail),
  authController.verifyEmail
);

/**
 * @swagger
 * /auth/resend-otp:
 *   post:
 *     summary: Resend an OTP code for registration or password reset
 *     tags: [Auth]
 *     responses:
 *       200: { description: Code resent if the account exists }
 */
router.post("/resend-otp", authLimiter, validate(schemas.resendOtp), authController.resendOtp);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Log in with email and password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/LoginRequest' }
 *     responses:
 *       200: { description: Login successful }
 *       401: { description: Invalid credentials }
 */
router.post("/login", authLimiter, validate(schemas.login), authController.login);

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Exchange a valid refresh token for a new access/refresh token pair
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/RefreshRequest' }
 *     responses:
 *       200: { description: Token refreshed }
 *       401: { description: Invalid or expired refresh token }
 */
router.post("/refresh", validate(schemas.refresh), authController.refresh);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Revoke a refresh token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/RefreshRequest' }
 *     responses:
 *       200: { description: Logged out }
 */
router.post("/logout", validate(schemas.logout), authController.logout);

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Request a password reset OTP code
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ForgotPasswordRequest' }
 *     responses:
 *       200: { description: OTP code sent if the account exists }
 */
router.post(
  "/forgot-password",
  authLimiter,
  validate(schemas.forgotPassword),
  authController.forgotPassword
);

/**
 * @swagger
 * /auth/verify-reset-code:
 *   post:
 *     summary: Check a password-reset OTP without consuming it
 *     tags: [Auth]
 *     responses:
 *       200: { description: Code is valid }
 *       400: { description: Invalid or expired code }
 */
router.post(
  "/verify-reset-code",
  authLimiter,
  validate(schemas.verifyEmail),
  authController.verifyResetCode
);

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     summary: Reset password using the OTP code from the forgot-password request
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ResetPasswordRequest' }
 *     responses:
 *       200: { description: Password reset }
 *       400: { description: Invalid or expired token }
 */
router.post(
  "/reset-password",
  authLimiter,
  validate(schemas.resetPassword),
  authController.resetPassword
);

module.exports = router;
