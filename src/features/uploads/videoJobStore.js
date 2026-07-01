const crypto = require("crypto");
const { getRedisClient } = require("../../lib/redis");

const JOB_PREFIX = process.env.VIDEO_JOB_REDIS_PREFIX?.trim() || "myrank:video-job:";
const JOB_TTL_SEC = Number(process.env.VIDEO_JOB_TTL_SEC) || 3600;

function jobKey(jobId) {
  return `${JOB_PREFIX}${jobId}`;
}

function createJobId() {
  return crypto.randomUUID();
}

async function createVideoJob({ userId, storagePath }) {
  const jobId = createJobId();
  const payload = {
    jobId,
    userId,
    storagePath,
    status: "pending",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    result: null,
    error: null,
  };

  const redis = await getRedisClient();
  if (!redis) {
    throw new Error("Video job queue requires Redis");
  }

  await redis.setEx(jobKey(jobId), JOB_TTL_SEC, JSON.stringify(payload));
  return payload;
}

async function readVideoJob(jobId) {
  const redis = await getRedisClient();
  if (!redis) {
    return null;
  }

  const raw = await redis.get(jobKey(jobId));
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function updateVideoJob(jobId, patch) {
  const existing = await readVideoJob(jobId);
  if (!existing) {
    return null;
  }

  const next = {
    ...existing,
    ...patch,
    updatedAt: Date.now(),
  };

  const redis = await getRedisClient();
  if (!redis) {
    return null;
  }

  await redis.setEx(jobKey(jobId), JOB_TTL_SEC, JSON.stringify(next));
  return next;
}

async function markVideoJobComplete(jobId, result) {
  return updateVideoJob(jobId, {
    status: "complete",
    result,
    error: null,
  });
}

async function markVideoJobFailed(jobId, errorMessage) {
  return updateVideoJob(jobId, {
    status: "failed",
    error: errorMessage,
    result: null,
  });
}

module.exports = {
  createVideoJob,
  readVideoJob,
  markVideoJobComplete,
  markVideoJobFailed,
};
