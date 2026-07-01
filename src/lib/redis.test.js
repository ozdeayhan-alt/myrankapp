const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");

describe("isRedisRequired", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete require.cache[require.resolve("./redis")];
  });

  afterEach(() => {
    process.env = originalEnv;
    delete require.cache[require.resolve("./redis")];
  });

  it("requires Redis in production by default", () => {
    process.env.NODE_ENV = "production";
    delete process.env.REDIS_REQUIRED;
    const { isRedisRequired } = require("./redis");
    assert.equal(isRedisRequired(), true);
  });

  it("allows opt-out in production via REDIS_REQUIRED=false", () => {
    process.env.NODE_ENV = "production";
    process.env.REDIS_REQUIRED = "false";
    const { isRedisRequired } = require("./redis");
    assert.equal(isRedisRequired(), false);
  });

  it("does not require Redis in development by default", () => {
    process.env.NODE_ENV = "development";
    delete process.env.REDIS_REQUIRED;
    const { isRedisRequired } = require("./redis");
    assert.equal(isRedisRequired(), false);
  });
});
