const { Queue, Worker, QueueEvents } = require("bullmq");
const { getRedisClient } = require("./redis");
const logger = require("./logger");
const env = require("./env");

const queues = new Map();
const workers = new Map();

function getQueue(name) {
  if (queues.has(name)) return queues.get(name);
  const queue = new Queue(name, {
    connection: getRedisClient(),
    defaultJobOptions: {
      attempts: env.bullmq.defaultAttempts,
      backoff: { type: "exponential", delay: env.bullmq.backoffDelay },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    },
  });
  queues.set(name, queue);
  return queue;
}

function registerWorker(name, processor, opts = {}) {
  if (workers.has(name)) return workers.get(name);
  const worker = new Worker(name, processor, {
    connection: getRedisClient(),
    concurrency: opts.concurrency || 5,
    ...opts,
  });
  worker.on("completed", (job) => logger.info(`[queue:${name}] Job ${job.id} completed`));
  worker.on("failed", (job, err) => logger.error(`[queue:${name}] Job ${job?.id} failed: ${err.message}`));
  workers.set(name, worker);
  return worker;
}

async function closeQueues() {
  for (const [name, worker] of workers) {
    await worker.close();
    logger.info(`[queue:${name}] Worker closed`);
  }
  for (const [name, queue] of queues) {
    await queue.close();
    logger.info(`[queue:${name}] Queue closed`);
  }
  workers.clear();
  queues.clear();
}

module.exports = { getQueue, registerWorker, closeQueues };
