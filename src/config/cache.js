const { getRedisClient } = require("./redis");
const logger = require("./logger");

const DEFAULT_TTL = 60; // seconds

async function cacheGet(key) {
  try {
    const data = await getRedisClient().get(key);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    logger.warn(`[cache] GET ${key} failed: ${err.message}`);
    return null;
  }
}

async function cacheSet(key, value, ttl = DEFAULT_TTL) {
  try {
    await getRedisClient().set(key, JSON.stringify(value), "EX", ttl);
  } catch (err) {
    logger.warn(`[cache] SET ${key} failed: ${err.message}`);
  }
}

async function cacheDel(pattern) {
  try {
    const redis = getRedisClient();
    // Use SCAN for pattern-based deletion to avoid blocking
    let cursor = "0";
    do {
      const [nextCursor, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
      cursor = nextCursor;
      if (keys.length) await redis.del(...keys);
    } while (cursor !== "0");
  } catch (err) {
    logger.warn(`[cache] DEL ${pattern} failed: ${err.message}`);
  }
}

async function cacheDelExact(key) {
  try {
    await getRedisClient().del(key);
  } catch (err) {
    logger.warn(`[cache] DEL ${key} failed: ${err.message}`);
  }
}

module.exports = { cacheGet, cacheSet, cacheDel, cacheDelExact, DEFAULT_TTL };
