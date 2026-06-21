const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { selectSceneId } = require("./sceneMapper");

describe("selectSceneId", () => {
  it("maps peaceful beach to beach_sunset_chill", () => {
    assert.equal(
      selectSceneId({
        moodKey: "peaceful",
        locationKey: "beach",
        actionKey: "walking",
      }),
      "beach_sunset_chill"
    );
  });

  it("maps stressed mood to rainy_street_walk", () => {
    assert.equal(
      selectSceneId({
        moodKey: "stressed",
        locationKey: "cafe",
        actionKey: "working",
      }),
      "rainy_street_walk"
    );
  });

  it("falls back to default_cinematic", () => {
    assert.equal(
      selectSceneId({
        moodKey: "romantic",
        locationKey: "gym",
        actionKey: "working",
      }),
      "default_cinematic"
    );
  });
});
