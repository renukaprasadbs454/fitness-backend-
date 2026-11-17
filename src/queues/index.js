const { startNotificationWorker } = require("./notification.queue");
const { startBookingWorker } = require("./booking.queue");
const { closeQueues } = require("../config/queue");
const logger = require("../config/logger");

function startAllWorkers(app) {
  try {
    const notificationService = require("../services/notification.service");
    const appointmentService = require("../services/appointment.service");

    startNotificationWorker(notificationService);
    startBookingWorker(appointmentService, app);
    logger.info("[queues] All BullMQ workers started");
  } catch (err) {
    logger.warn(`[queues] Failed to start BullMQ workers: ${err.message}`);
  }
}

async function stopAllWorkers() {
  await closeQueues();
  logger.info("[queues] All BullMQ workers stopped");
}

module.exports = { startAllWorkers, stopAllWorkers };
