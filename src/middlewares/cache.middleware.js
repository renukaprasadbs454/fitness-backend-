// Redis-backed HTTP response cache for read-heavy reference data.
// Works across multiple instances — replaces the old in-process Map cache.
const { cacheGet, cacheSet, cacheDel } = require("../config/cache");

function cacheResponse(ttlSeconds = 60) {
  return async (req, res, next) => {
    const key = `http:${req.originalUrl}`;
    const cached = await cacheGet(key);

    if (cached) {
      return res.status(cached.statusCode).json(cached.body);
    }

    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cacheSet(key, { statusCode: res.statusCode, body }, ttlSeconds);
      }
      return originalJson(body);
    };

    next();
  };
}

function invalidate(prefix) {
  return async (req, res, next) => {
    await cacheDel(`http:${prefix}*`);
    next();
  };
}

module.exports = { cacheResponse, invalidate };
