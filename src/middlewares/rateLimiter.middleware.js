const rateLimit = require("express-rate-limit");
const env = require("../config/env");

// Rate limiting exists to blunt production abuse (credential stuffing,
// scraping, brute force) — it has no upside in local development, where a
// single developer reloading a screen a few times can legitimately fire
// more requests in 15 minutes than a stranger's attack would need to.
const isDev = env.nodeEnv !== "production";

const generalLimiter = rateLimit({
  windowMs: env.rateLimit.windowMin * 60 * 1000,
  max: env.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDev,
  message: { success: false, message: "Too many requests, please try again later." }
});

// Tighter limit specifically for auth endpoints (login/register/forgot-password)
// to slow down credential stuffing / brute force attempts.
const authLimiter = rateLimit({
  windowMs: env.rateLimit.windowMin * 60 * 1000,
  max: env.rateLimit.authMaxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDev,
  message: { success: false, message: "Too many auth attempts, please try again later." }
});

module.exports = { generalLimiter, authLimiter };
