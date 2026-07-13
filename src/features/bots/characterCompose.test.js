const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  pickContentTypeForNormalSlot,
  passesWhispGate,
} = require("./characterCompose");
const { buildNewsTemplateWhisp } = require("./characterTemplates");
const { getCharacterPersonaByUid } = require("./characterPersonas");
const { CHARACTER_CONTENT_TYPES } = require("./characterContentTypes");

describe("characterCompose", () => {
  it("passes valid whisp with news and comment", () => {
    assert.equal(
      passesWhispGate(
        "Apple fiyatları yine konuşuluyor. Bence bu sefer abartılmış gibi duruyor."
      ),
      true
    );
  });

  it("passes valid whisp without question", () => {
    assert.equal(
      passesWhispGate(
        "Yeni roman raflarda. Bence anlatım güçlü ama tempo biraz ağır kalmış."
      ),
      true
    );
  });

  it("rejects too short text", () => {
    assert.equal(passesWhispGate("Kısa."), false);
  });

  it("rejects English sentences in whisp", () => {
    assert.equal(
      passesWhispGate(
        "Apple gündemde. The US has launched strikes on Iran in response to attacks."
      ),
      false
    );
  });

  it("rejects urls", () => {
    assert.equal(
      passesWhispGate(
        "Bakın https://example.com adresinde bir haber var. Bence ilginç bir gelişme."
      ),
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

describe("characterTemplates", () => {
  it("builds literature news whisp with lead and opinion", () => {
    const persona = getCharacterPersonaByUid("bot_char_11");
    const text = buildNewsTemplateWhisp(persona, {
      title: "Orhan Pamuk'un yeni romanı raflarda: okurlar ne diyor?",
      description: "ignored",
    });
    assert.ok(text.length >= 50);
    assert.ok(passesWhispGate(text));
  });
});
