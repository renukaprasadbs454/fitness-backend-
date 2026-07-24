const http = require("http");
const { Server } = require("socket.io");
const app = require("./app");
const env = require("./config/env");
const logger = require("./config/logger");
const prisma = require("./database/prismaClient");
const { registerChatGateway } = require("./sockets/chat.socket");
const { startCronJobs, stopCronJobs } = require("./jobs");

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: env.corsAllowedOrigins.length ? env.corsAllowedOrigins : true,
    credentials: true
  }
});

// Register the /chat Socket.io namespace and expose an emitter on the
// Express app so REST controllers (e.g. the image-message endpoint) can
// push real-time events without importing the socket layer directly.
const emitChatMessage = registerChatGateway(io);
app.set("chatSocketEmitter", emitChatMessage);
app.set("io", io);

const server = httpServer.listen(env.port, () => {
  logger.info(`FitNerve API listening on port ${env.port} [${env.nodeEnv}]`);
  logger.info(`Swagger docs available at http://localhost:${env.port}/api-docs`);
  logger.info(`Admin portal available at http://localhost:${env.port}/admin`);
  logger.info(`Socket.io chat namespace ready at /chat`);
  if (env.cron.enabled) {
    startCronJobs();
    logger.info(`Cron reminder sweep enabled (${env.cron.reminderSweepCron})`);
  }
});

async function shutdown(signal) {
  logger.info(`${signal} received. Shutting down gracefully...`);
  stopCronJobs();
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
