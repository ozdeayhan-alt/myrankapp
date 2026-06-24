const { getRedisClient, isRedisEnabled } = require("./redis");
const { fanOutPostById, fanOutPostToFollowers } = require("../features/feed/userFeedService");

const QUEUE_KEY = process.env.JOB_QUEUE_KEY?.trim() || "myrank:jobs";

async function processJob(job) {
  if (!job || typeof job.type !== "string") {
    throw new Error("Invalid job payload");
  }

  switch (job.type) {
    case "fanOut": {
      const result = await fanOutPostById(job.postId);
      return { type: job.type, postId: job.postId, ...result };
    }
    case "fanOutDirect": {
      const result = await fanOutPostToFollowers({
        postId: job.postId,
        authorId: job.authorId,
        createdAtMillis: job.createdAtMillis,
      });
      return { type: job.type, postId: job.postId, ...result };
    }
    default:
      throw new Error(`Unknown job type: ${job.type}`);
  }
}

async function enqueueJob(job) {
  const redis = await getRedisClient();
  if (redis) {
    await redis.rPush(QUEUE_KEY, JSON.stringify(job));
    return { queued: true };
  }

  if (isRedisEnabled()) {
    console.warn("[jobQueue] Redis unavailable, processing inline:", job.type);
  }

  const result = await processJob(job);
  return { queued: false, ...result };
}

async function enqueueFanOut(postId) {
  return enqueueJob({ type: "fanOut", postId });
}

async function enqueueFanOutDirect({ postId, authorId, createdAtMillis }) {
  return enqueueJob({
    type: "fanOutDirect",
    postId,
    authorId,
    createdAtMillis,
  });
}

async function dequeueJob(timeoutSec = 5) {
  const redis = await getRedisClient();
  if (!redis) {
    return null;
  }

  const result = await redis.brPop(QUEUE_KEY, timeoutSec);
  if (!result?.element) {
    return null;
  }

  return JSON.parse(result.element);
}

module.exports = {
  QUEUE_KEY,
  enqueueJob,
  enqueueFanOut,
  enqueueFanOutDirect,
  dequeueJob,
  processJob,
};
