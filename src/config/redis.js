const { Redis } = require("ioredis");
const env = require("./env");
const logger = require("./logger");

let client = null;

function getRedisClient() {
  if (client) return client;
  client = new Redis(env.redis.url, {
    maxRetriesPerRequest: null, // required by BullMQ
    enableReadyCheck: true,
    retryStrategy: (times) => Math.min(times * 200, 5000),
  });
  client.on("connect", () => logger.info("[redis] Connected"));
  client.on("error", (err) => logger.error(`[redis] ${err.message}`));
  return client;
}

async function disconnectRedis() {
  if (client) {
    await client.quit();
    client = null;
    logger.info("[redis] Disconnected");
  }
}

module.exports = { getRedisClient, disconnectRedis };
