const app = require("./app");
const env = require("./config/env");
const logger = require("./config/logger");
const prisma = require("./database/prismaClient");

const server = app.listen(env.port, () => {
  logger.info(`FitNerve API listening on port ${env.port} [${env.nodeEnv}]`);
  logger.info(`Swagger docs available at http://localhost:${env.port}/api-docs`);
});

async function shutdown(signal) {
  logger.info(`${signal} received. Shutting down gracefully...`);
  server.close(async () => {
    await prisma.$disconnect();
    logger.info("HTTP server closed, Prisma disconnected.");
    process.exit(0);
  });
  // Force-exit if something hangs
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  logger.error(`Unhandled Rejection: ${reason}`);
});
process.on("uncaughtException", (err) => {
  logger.error(`Uncaught Exception: ${err.stack || err.message}`);
  process.exit(1);
});
