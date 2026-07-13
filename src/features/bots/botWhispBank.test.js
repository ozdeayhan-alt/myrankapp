const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  BOT_WHISP_BANKS,
  pickWeeklyWhisp,
  isBotWeeklySlotToday,
  getWhispBankForBot,
} = require("./botWhispBank");
const { BOT_PERSONAS } = require("./botPersonas");

describe("botWhispBank", () => {
  it("has a bank for every seed bot", () => {
    for (const persona of BOT_PERSONAS) {
      const bank = getWhispBankForBot(persona.uid);
      assert.ok(bank.length >= 5, `${persona.uid} bank too small`);
      for (const entry of bank) {
        assert.equal(entry.contentType, "tweet");
        assert.ok(entry.content.trim().length >= 40);
        assert.equal(entry.content.includes("MyRank"), false);
      }
    }
  });

  it("avoids repeating the last bank index when possible", () => {
    const botId = "bot_myrank_01";
    const last = 0;
    let different = 0;
    for (let i = 0; i < 20; i += 1) {
      const picked = pickWeeklyWhisp(botId, last);
      if (picked.bankIndex !== last) {
        different += 1;
      }
    }
    assert.ok(different >= 15);
  });

  it("staggers weekly slots across weekdays", () => {
    const monday = new Date("2026-07-06T12:00:00Z"); // Monday
    const allowed = BOT_PERSONAS.filter((p) =>
      isBotWeeklySlotToday(p.uid, monday)
    );
    assert.ok(allowed.length >= 2);
    assert.ok(allowed.length < BOT_PERSONAS.length);
    assert.equal(Object.keys(BOT_WHISP_BANKS).length, 10);
  });
});
