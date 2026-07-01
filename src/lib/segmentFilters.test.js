const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  hasActiveSegmentFilters,
  buildSingleFieldSegmentKey,
  entryMatchesSegmentFilters,
  parseFiltersFromQuery,
  getRankingSegmentKey,
} = require("./segmentFilters");
const { GLOBAL_RANKING_SEGMENT } = require("./segmentKey");

describe("segmentFilters", () => {
  it("detects active filters", () => {
    assert.equal(hasActiveSegmentFilters(null), false);
    assert.equal(
      hasActiveSegmentFilters({
        country: "",
        city: "",
        gender: "",
        age: null,
        profession: "",
        maritalStatus: "",
      }),
      false
    );
    assert.equal(
      hasActiveSegmentFilters({
        country: "Türkiye",
        city: "",
        gender: "",
        age: null,
        profession: "",
        maritalStatus: "",
      }),
      true
    );
  });

  it("builds single-field segment key", () => {
    const key = buildSingleFieldSegmentKey({
      country: "Türkiye",
      city: "",
      gender: "",
      age: null,
      profession: "",
      maritalStatus: "",
    });
    assert.match(key, /country:Türkiye/);
    assert.equal(
      buildSingleFieldSegmentKey({
        country: "Türkiye",
        city: "İstanbul",
        gender: "",
        age: null,
        profession: "",
        maritalStatus: "",
      }),
      null
    );
  });

  it("matches multi-field filters against entry metadata", () => {
    const filters = {
      country: "Türkiye",
      city: "İstanbul",
      gender: "",
      age: null,
      profession: "",
      maritalStatus: "",
    };
    assert.equal(
      entryMatchesSegmentFilters(
        {
          country: "Türkiye",
          city: "İstanbul",
          gender: "",
          age: null,
          profession: "",
          maritalStatus: "",
        },
        filters
      ),
      true
    );
    assert.equal(
      entryMatchesSegmentFilters(
        {
          country: "Türkiye",
          city: "Ankara",
          gender: "",
          age: null,
          profession: "",
          maritalStatus: "",
        },
        filters
      ),
      false
    );
  });

  it("parses query filters and resolves segment key", () => {
    const filters = parseFiltersFromQuery({
      country: "Türkiye",
      age: "25",
    });
    assert.equal(filters.country, "Türkiye");
    assert.equal(filters.age, 25);
    assert.equal(hasActiveSegmentFilters(filters), true);
    assert.equal(getRankingSegmentKey(null), GLOBAL_RANKING_SEGMENT);
  });
});
