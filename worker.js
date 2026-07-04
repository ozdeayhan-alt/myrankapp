#!/usr/bin/env node
require("dotenv").config();

const { configureNetworkDns } = require("./src/lib/configureNetworkDns");
configureNetworkDns();

const { dequeueJob, processJob } = require("./src/lib/jobQueue");
const { getRedisClient, getRedisStatus, isRedisRequired, closeRedis } = require("./src/lib/redis");

const IDLE_SLEEP_MS = Number(process.env.WORKER_IDLE_SLEEP_MS) || 1_000;

let shuttingDown = false;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runWorkerLoop() {
  const redis = await getRedisClient();
  if (!redis && isRedisRequired()) {
    console.error("[worker] Redis is required but unavailable — exiting");
    process.exit(1);
  }

  if (process.env.NODE_ENV !== "production") {
    console.log(`[worker] started redisStatus=${getRedisStatus()}`);
  }

  while (!shuttingDown) {
    try {
      const job = await dequeueJob(5);
      if (!job) {
        await sleep(IDLE_SLEEP_MS);
        continue;
      }

      const startedAt = Date.now();
      const result = await processJob(job);
      if (process.env.NODE_ENV !== "production") {
        console.log(
          `[worker] ${job.type} done in ${Date.now() - startedAt}ms`,
          result
        );
      }
    } catch (error) {
      console.error("[worker] job failed:", error.message ?? error);
      await sleep(IDLE_SLEEP_MS);
    }
  }
}

function shutdown(signal) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  console.warn(`[worker] ${signal} received — stopping after current job`);
  setTimeout(() => {
    void closeRedis().finally(() => process.exit(0));
  }, 500).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

runWorkerLoop().catch((error) => {
  console.error("[worker] fatal:", error.message ?? error);
  process.exit(1);
});
