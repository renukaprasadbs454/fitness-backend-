const { PrismaClient } = require("@prisma/client");
const env = require("../config/env");
const logger = require("../config/logger");

// Reuse a single PrismaClient instance across the app (and across
// hot-reloads in dev) to avoid exhausting the Postgres connection pool.
const prisma = new PrismaClient({
  log:
    env.nodeEnv === "development"
      ? [{ level: "warn", emit: "event" }, { level: "error", emit: "event" }]
      : [{ level: "error", emit: "event" }]
});

prisma.$on("warn", (e) => logger.warn(e.message));
prisma.$on("error", (e) => logger.error(e.message));

module.exports = prisma;
