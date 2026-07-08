const { CHARACTER_CONTENT_TYPES } = require("./characterContentTypes");
const { extractNewsHint } = require("./characterNewsHint");

function emojiForLevel(level) {
  if (level === "high") {
    return [" 😅", " 🤔", " 🔥"][Math.floor(Math.random() * 3)];
  }
  if (level === "medium") {
    return Math.random() < 0.5 ? " 😅" : "";
  }
  return "";
}

function wrapWithVoice(persona, baseText) {
  const text = String(baseText ?? "").trim();
  if (!text) {
    return "";
  }

  const voice = persona.voice ?? {};
  const emoji = emojiForLevel(voice.emojiLevel ?? "low");

  if (voice.tone === "energetic" && !text.endsWith("!") && Math.random() < 0.3) {
    return `${text}!${emoji}`;
  }

  if (voice.length === "short" && text.length > 120) {
    const cut = text.slice(0, 117).trim();
    return `${cut}…${emoji}`;
  }

  return `${text}${emoji}`;
}

function buildTemplateWhisp(persona, contentType, seedText) {
  const topic = String(seedText ?? "").trim();
  if (!topic) {
    return "";
  }

  if (contentType === CHARACTER_CONTENT_TYPES.SPOTLIGHT) {
    return wrapWithVoice(persona, topic);
  }

  if (contentType === CHARACTER_CONTENT_TYPES.FUN) {
    return wrapWithVoice(persona, topic);
  }

  if (contentType === CHARACTER_CONTENT_TYPES.EVERGREEN) {
    return wrapWithVoice(persona, topic);
  }

  // news fallback when AI off — generic discussion opener
  const openers = [
    "Bunu okuyunca aklıma takıldı:",
    "Şunu görünce merak ettim:",
    "Bu konu dönüyor bugün:",
  ];
  const opener = openers[Math.floor(Math.random() * openers.length)];
  const question = "Siz ne düşünüyorsunuz?";
  const body = `${opener} ${topic.slice(0, 80)}… ${question}`;
  return wrapWithVoice(persona, body);
}

function buildNewsTemplateWhisp(persona, headlineHint) {
  const hint = String(headlineHint ?? "").trim();
  const topic = extractNewsHint(hint, persona);
  const questions = [
    "Sence abartılıyor mu yoksa haklı mı?",
    "Bu sizi de etkiledi mi?",
    "Gerçekten bu kadar önemli mi sizce?",
    "Siz olsanız ne yapardınız?",
    "Sence gerçekten parasını hak ediyor mu?",
  ];
  const q = questions[Math.floor(Math.random() * questions.length)];

  const lines = topic
    ? [`${topic} yine konuşuluyor bugün.`, q]
    : ["Gündemde yeni bir konu daha var.", q];

  return wrapWithVoice(persona, lines.join(" "));
}

module.exports = {
  buildTemplateWhisp,
  buildNewsTemplateWhisp,
  wrapWithVoice,
};
