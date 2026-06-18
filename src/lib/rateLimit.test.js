const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  createRateLimiter,
  shouldSkipWriteLimit,
  normalizePath,
} = require("./rateLimit");

describe("rateLimit", () => {
  it("normalizePath trims trailing slashes", () => {
    assert.equal(
      normalizePath("/interactions/engagements/batch/"),
      "/interactions/engagements/batch"
    );
  });

  it("shouldSkipWriteLimit skips batch engagement reads", () => {
    assert.equal(
      shouldSkipWriteLimit({
        path: "/interactions/engagements/batch",
      }),
      true
    );
    assert.equal(
      shouldSkipWriteLimit({
        path: "/post-votes/batch",
      }),
      false
    );
  });

  it("write limiter ignores GET requests", () => {
    const limiter = createRateLimiter({
      windowMs: 60_000,
      max: 1,
      methods: new Set(["POST"]),
    });

    const req = {
      method: "GET",
      path: "/interactions/engagement",
      headers: {},
      socket: { remoteAddress: "127.0.0.1" },
    };

    let passed = 0;
    const next = () => {
      passed += 1;
    };
    const res = {
      headers: {},
      setHeader(name, value) {
        this.headers[name] = value;
      },
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json() {},
    };

    limiter(req, res, next);
    limiter(req, res, next);

    assert.equal(passed, 2);
  });

  it("write limiter enforces max for POST requests", () => {
    const limiter = createRateLimiter({
      windowMs: 60_000,
      max: 1,
      methods: new Set(["POST"]),
    });

    const req = {
      method: "POST",
      path: "/interactions",
      headers: {},
      socket: { remoteAddress: "127.0.0.1" },
    };

    let passed = 0;
    const next = () => {
      passed += 1;
    };
    const res = {
      headers: {},
      setHeader(name, value) {
        this.headers[name] = value;
      },
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json() {},
    };

    limiter(req, res, next);
    limiter(req, res, next);

    assert.equal(passed, 1);
    assert.equal(res.statusCode, 429);
  });
});
