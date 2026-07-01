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

/** Prod'da (veya REDIS_REQUIRED=true) kuyruk/cache için Redis zorunlu. */
function isRedisRequired() {
  const explicit = process.env.REDIS_REQUIRED?.trim().toLowerCase();
  if (explicit === "false") {
    return false;
  }
  if (explicit === "true") {
    return true;
  }
  return process.env.NODE_ENV === "production";
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
          isRedisRequired()
            ? "[redis] REQUIRED but unavailable:"
            : "[redis] unavailable, dev in-memory fallback:",
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
  isRedisRequired,
  closeRedis,
};
