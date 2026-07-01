const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

describe("feedCache", () => {
  it("uses default TTL of 240s when env unset", async () => {
    const { CACHE_TTL_MS, setCached, getCached, getCacheKey } = loadFresh();
    assert.equal(CACHE_TTL_MS, 240_000);

    const key = getCacheKey(["feed", "recent", "u1", "", "15"]);
    await setCached(key, { posts: [] });
    assert.ok(await getCached(key));
  });

  it("invalidates feed keys on invalidateFeedCaches", async () => {
    const { setCached, getCached, getCacheKey, invalidateFeedCaches } =
      loadFresh();

    const key = getCacheKey(["feed", "recent", "u1", "", "15"]);
    await setCached(key, { posts: [{ id: "p1" }] });
    assert.ok(await getCached(key));

    await invalidateFeedCaches();
    assert.equal(await getCached(key), null);
  });

  it("getCacheStats reports feed entry counts", async () => {
    const { setCached, getCacheKey, getCacheStats } = loadFresh();

    await setCached(getCacheKey(["feed", "recent", "u1"]), { posts: [] });
    await setCached(getCacheKey(["feed", "explore", "u1"]), { posts: [] });

    const stats = await getCacheStats();
    assert.equal(stats.feedEntries, 2);
    assert.equal(stats.feedByKind.recent, 1);
    assert.equal(stats.feedByKind.explore, 1);
    assert.equal(stats.ttlMs.recent, 360_000);
    assert.equal(stats.ttlMs.explore, 600_000);
    assert.equal(stats.backend, "memory");
  });
});

function loadFresh() {
  process.env.REDIS_ENABLED = "false";
  const modulePath = require.resolve("./feedCache");
  delete require.cache[modulePath];
  delete require.cache[require.resolve("../../lib/redis")];
  return require("./feedCache");
}
