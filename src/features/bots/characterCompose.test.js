const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  pickContentTypeForNormalSlot,
  passesWhispGate,
} = require("./characterCompose");
const { CHARACTER_CONTENT_TYPES } = require("./characterContentTypes");

describe("characterCompose", () => {
  it("passes valid whisp gate", () => {
    assert.equal(
      passesWhispGate("Apple fiyatları yine konuşuluyor. Sence abartılı mı?"),
      true
    );
  });

  it("rejects missing question", () => {
    assert.equal(passesWhispGate("Apple fiyatları yine konuşuluyor."), false);
  });

  it("rejects urls", () => {
    assert.equal(
      passesWhispGate("Bakın https://example.com ne diyor?"),
      false
    );
  });

  it("pickContentTypeForNormalSlot returns known types", () => {
    const types = new Set();
    for (let i = 0; i < 50; i += 1) {
      types.add(pickContentTypeForNormalSlot());
    }
    assert.ok(types.has(CHARACTER_CONTENT_TYPES.NEWS));
    assert.ok(types.has(CHARACTER_CONTENT_TYPES.EVERGREEN));
    assert.ok(types.has(CHARACTER_CONTENT_TYPES.FUN));
  });
});
