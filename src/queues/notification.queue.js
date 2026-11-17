const { getQueue, registerWorker } = require("../config/queue");
const logger = require("../config/logger");

const QUEUE_NAME = "notifications";

function getNotificationQueue() {
  return getQueue(QUEUE_NAME);
}

function startNotificationWorker(notificationService) {
  registerWorker(QUEUE_NAME, async (job) => {
    const { userId, type, title, body, options } = job.data;
    await notificationService.dispatchPush(userId, title, body, { type, ...options.data });
  }, { concurrency: 10 });
}

async function enqueueNotification(userId, type, title, body, options = {}) {
  const queue = getNotificationQueue();
  await queue.add("push", { userId, type, title, body, options }, {
    priority: type === "SYSTEM" ? 1 : 3,
  });
}

module.exports = { getNotificationQueue, startNotificationWorker, enqueueNotification };
