const { CHARACTER_CONTENT_TYPES } = require("./characterContentTypes");
const { TWEET_MAX_LENGTH } = require("../posts/updatePostContent");
const { summarizeNewsSeed } = require("./characterNewsHint");

const QUESTION_CHANCE = 0.45;

const OPINIONS_BY_TONE = {
  reflective: [
    "Bence bu işin altında daha derin bir hikâye var.",
    "İlk bakışta ilginç ama acele yorum yapmayı sevmem.",
    "Okurken aklımda kalan şey, anlatımın kendisi oldu.",
    "Eleştirmenler karışık yazmış; ben yine de merak ettim.",
  ],
  casual: [
    "Bence abartılmış gibi duruyor.",
    "Ben şaşırmadım açıkçası.",
    "Bu konu bir süre daha konuşulur gibi.",
    "İlginç ama herkes aynı fikirde değil.",
  ],
  energetic: [
    "Vay be, bu çok konuşulur bence.",
    "Bence bu sefer gerçekten gündem olur.",
    "Tartışma kaçınılmaz gibi duruyor.",
    "Ben heyecanlandım açıkçası.",
  ],
  dry: [
    "Rakamlar ilginç, tepki daha ilginç.",
    "Bence piyasa bunu farklı okuyacak.",
    "Sakin bakınca abartı var gibi.",
    "Uzun vadede ne olur, o daha önemli.",
  ],
};

const LITERATURE_OPINIONS = [
  "Bence yazarın önceki eserlerine kıyasla daha cesur bir anlatım var; bazı bölümler zorlayıcı ama karakter derinliği güçlü.",
  "Eleştirmenler karışık yazmış ama ben giriş bölümünden sonra içine girdim; sonuna doğru tempo oturuyor.",
  "Çeviri metin akıcı, konu ağır ama edebi dil taşıyor. Sabırlı okura hitap ediyor.",
  "Yeni çıkan bu romanda atmosfer çok iyi kurulmuş; olay örgüsü biraz yavaş ama dil güçlü.",
  "Bence bu kitap rafta kalır; ödül konuşulursa şaşırmam ama herkese göre değil.",
];

const OPTIONAL_QUESTIONS = [
  "Siz ne düşünüyorsunuz?",
  "Sence abartılıyor mu?",
  "Bu sizi de etkiledi mi?",
  "Siz olsanız ne yapardınız?",
  "Okuyan var mı aranızda?",
  "Sizin yorumunuz ne?",
];

const LITERATURE_QUESTIONS = [
  "Okuyan var mı aranızda?",
  "Siz bu yazarı sever misiniz?",
  "Bitirene kadar sabır gerektiriyor mu sizce de?",
  "Çeviri mi orijinal mi tercih edersiniz?",
];

function shouldAddQuestion() {
  return Math.random() < QUESTION_CHANCE;
}

function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)] ?? "";
}

function isLiteraturePersona(persona) {
  return persona?.uid === "bot_char_11";
}

function emojiForLevel(level) {
  if (level === "high") {
    return [" 😅", " 🤔", " 🔥"][Math.floor(Math.random() * 3)];
  }
  if (level === "medium") {
    return Math.random() < 0.5 ? " 😅" : "";
  }
  return "";
}

function maxLengthForPersona(persona) {
  const voice = persona?.voice ?? {};
  if (voice.length === "long" || isLiteraturePersona(persona)) {
    return TWEET_MAX_LENGTH;
  }
  if (voice.length === "short") {
    return 120;
  }
  return 200;
}

function trimToLength(text, maxLen) {
  const trimmed = String(text ?? "").trim();
  if (trimmed.length <= maxLen) {
    return trimmed;
  }
  const cut = trimmed.slice(0, maxLen - 1).trim();
  return `${cut}…`;
}

function wrapWithVoice(persona, baseText) {
  const text = String(baseText ?? "").trim();
  if (!text) {
    return "";
  }

  const voice = persona.voice ?? {};
  const emoji = emojiForLevel(voice.emojiLevel ?? "low");
  const maxLen = maxLengthForPersona(persona);
  let output = trimToLength(text, maxLen);

  if (voice.tone === "energetic" && !output.endsWith("!") && Math.random() < 0.25) {
    output = `${output}!`;
  }

  return `${output}${emoji}`.trim();
}

function pickOpinion(persona) {
  if (isLiteraturePersona(persona)) {
    return pickRandom(LITERATURE_OPINIONS);
  }
  const tone = persona?.voice?.tone ?? "casual";
  const pool = OPINIONS_BY_TONE[tone] ?? OPINIONS_BY_TONE.casual;
  return pickRandom(pool);
}

function pickQuestion(persona) {
  if (isLiteraturePersona(persona)) {
    return pickRandom(LITERATURE_QUESTIONS);
  }
  return pickRandom(OPTIONAL_QUESTIONS);
}

function assembleWhisp(persona, parts) {
  const segments = parts.filter((part) => String(part ?? "").trim().length > 0);
  return wrapWithVoice(persona, segments.join(" "));
}

function buildTemplateWhisp(persona, contentType, seedText) {
  const topic = String(seedText ?? "").trim();
  if (!topic) {
    return "";
  }

  if (
    contentType === CHARACTER_CONTENT_TYPES.SPOTLIGHT ||
    contentType === CHARACTER_CONTENT_TYPES.FUN ||
    contentType === CHARACTER_CONTENT_TYPES.EVERGREEN
  ) {
    return wrapWithVoice(persona, topic);
  }

  const parts = [topic, pickOpinion(persona)];
  if (shouldAddQuestion()) {
    parts.push(pickQuestion(persona));
  }
  return assembleWhisp(persona, parts);
}

function buildNewsTemplateWhisp(persona, newsItem) {
  const item =
    typeof newsItem === "string" ? { title: newsItem, description: "" } : newsItem;
  const newsLead = summarizeNewsSeed(item, persona);
  const parts = [newsLead, pickOpinion(persona)];
  if (shouldAddQuestion()) {
    parts.push(pickQuestion(persona));
  }
  return assembleWhisp(persona, parts);
}

module.exports = {
  buildTemplateWhisp,
  buildNewsTemplateWhisp,
  wrapWithVoice,
  shouldAddQuestion,
  pickOpinion,
  isLiteraturePersona,
};
