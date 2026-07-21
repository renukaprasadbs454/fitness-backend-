const rateLimit = require("express-rate-limit");
const env = require("../config/env");

const generalLimiter = rateLimit({
  windowMs: env.rateLimit.windowMin * 60 * 1000,
  max: env.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests, please try again later." }
});

// Tighter limit specifically for auth endpoints (login/register/forgot-password)
// to slow down credential stuffing / brute force attempts.
const authLimiter = rateLimit({
  windowMs: env.rateLimit.windowMin * 60 * 1000,
  max: env.rateLimit.authMaxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many auth attempts, please try again later." }
});

module.exports = { generalLimiter, authLimiter };
