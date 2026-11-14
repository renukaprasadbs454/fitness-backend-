function isLoopbackOrigin(origin) {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

function isOriginAllowed(origin, { allowedOrigins = [], allowLocalhost = false } = {}) {
  if (!origin) return true; // Native apps and server-to-server calls do not use browser CORS.
  if (allowLocalhost && isLoopbackOrigin(origin)) return true;
  return allowedOrigins.includes(origin);
}

module.exports = { isLoopbackOrigin, isOriginAllowed };
