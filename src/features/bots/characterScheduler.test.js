const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  buildDailySlotsForCharacter,
  buildGlobalDailySchedule,
  MIN_SLOT_GAP_MINUTES,
  POSTS_PER_CHARACTER_MIN,
  POSTS_PER_CHARACTER_MAX,
  WINDOW_START_HOUR,
  WINDOW_END_HOUR,
} = require("./characterScheduler");
const { CHARACTER_PERSONAS } = require("./characterPersonas");

describe("characterScheduler", () => {
  it("creates 3-7 slots per character within window", () => {
    const { slots } = buildDailySlotsForCharacter({ postCount: 5 });
    assert.equal(slots.length, 5);
    for (const minute of slots) {
      assert.ok(minute >= WINDOW_START_HOUR * 60);
      assert.ok(minute <= WINDOW_END_HOUR * 60);
    }
  });

  it("enforces minimum gap between slots", () => {
    const used = [];
    const { slots } = buildDailySlotsForCharacter({
      postCount: 4,
      usedMinutes: used,
    });
    for (let i = 1; i < slots.length; i += 1) {
      assert.ok(Math.abs(slots[i] - slots[i - 1]) >= MIN_SLOT_GAP_MINUTES);
    }
  });

  it("clamps post count to min/max", () => {
    const low = buildDailySlotsForCharacter({ postCount: 1 });
    assert.equal(low.slots.length, POSTS_PER_CHARACTER_MIN);
    const high = buildDailySlotsForCharacter({ postCount: 99 });
    assert.equal(high.slots.length, POSTS_PER_CHARACTER_MAX);
  });

  it("assigns exactly one spotlight character per day", () => {
    const plan = buildGlobalDailySchedule({
      date: new Date("2026-07-08T12:00:00+03:00"),
      postCountsByUid: Object.fromEntries(
        CHARACTER_PERSONAS.map((p) => [p.uid, 4])
      ),
    });

    let spotlightCount = 0;
    for (const persona of CHARACTER_PERSONAS) {
      const schedule = plan.schedules[persona.uid];
      const hasSpotlight = schedule.slots.some((s) => s.type === "spotlight");
      if (hasSpotlight) {
        spotlightCount += 1;
      }
    }
    assert.equal(spotlightCount, 1);
  });

  it("avoids duplicate minutes across characters in global schedule", () => {
    const plan = buildGlobalDailySchedule({
      date: new Date("2026-07-08T12:00:00+03:00"),
      postCountsByUid: Object.fromEntries(
        CHARACTER_PERSONAS.map((p) => [p.uid, 3])
      ),
    });

    const allMinutes = [];
    for (const persona of CHARACTER_PERSONAS) {
      for (const slot of plan.schedules[persona.uid].slots) {
        allMinutes.push(slot.minuteOfDay);
      }
    }
    assert.equal(allMinutes.length, new Set(allMinutes).size);
  });
});
