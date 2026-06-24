const REDIS_URL = process.env.REDIS_URL?.trim() || "redis://127.0.0.1:6379";

let client = null;
let connectPromise = null;
let redisStatus = "disabled";

function getRedisStatus() {
  return redisStatus;
}

function isRedisEnabled() {
  return process.env.REDIS_ENABLED !== "false";
}

async function getRedisClient() {
  if (!isRedisEnabled()) {
    return null;
  }

  if (client?.isOpen) {
    return client;
  }

  if (!connectPromise) {
    connectPromise = (async () => {
      try {
        const { createClient } = require("redis");
        const nextClient = createClient({ url: REDIS_URL });
        nextClient.on("error", (error) => {
          console.error("[redis] client error:", error.message ?? error);
          redisStatus = "error";
        });
        await nextClient.connect();
        client = nextClient;
        redisStatus = "connected";
        return client;
      } catch (error) {
        redisStatus = "unavailable";
        console.warn(
          "[redis] unavailable, using in-memory cache:",
          error.message ?? error
        );
        return null;
      } finally {
        connectPromise = null;
      }
    })();
  }

  return connectPromise;
}

async function closeRedis() {
  if (client?.isOpen) {
    await client.quit();
  }
  client = null;
  redisStatus = "disabled";
}

module.exports = {
  REDIS_URL,
  getRedisClient,
  getRedisStatus,
  isRedisEnabled,
  closeRedis,
};
