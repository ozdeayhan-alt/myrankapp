#!/usr/bin/env node
require("dotenv").config();

const { configureNetworkDns } = require("./src/lib/configureNetworkDns");
configureNetworkDns();

const { dequeueJob, processJob } = require("./src/lib/jobQueue");
const { getRedisStatus } = require("./src/lib/redis");

const IDLE_SLEEP_MS = Number(process.env.WORKER_IDLE_SLEEP_MS) || 1_000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runWorkerLoop() {
  console.log(`[worker] started redisStatus=${getRedisStatus()}`);

  while (true) {
    try {
      const job = await dequeueJob(5);
      if (!job) {
        await sleep(IDLE_SLEEP_MS);
        continue;
      }

      const startedAt = Date.now();
      const result = await processJob(job);
      console.log(
        `[worker] ${job.type} done in ${Date.now() - startedAt}ms`,
        result
      );
    } catch (error) {
      console.error("[worker] job failed:", error.message ?? error);
      await sleep(IDLE_SLEEP_MS);
    }
  }
}

runWorkerLoop().catch((error) => {
  console.error("[worker] fatal:", error.message ?? error);
  process.exit(1);
});
