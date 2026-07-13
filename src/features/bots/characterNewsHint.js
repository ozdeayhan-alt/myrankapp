/** Haber başlığından Türkçe tartışma ipucu çıkarır (İngilizce başlık yapıştırmaz). */

const TURKISH_MARKERS =
  /\b(ve|bir|için|ile|gibi|olan|olarak|daha|çok|yeni|bugün|haber|sonra|kadar|değil|de|da|ki|mi|mu|mı|dır|dir|tur|tür|yapılan|eden|etti|olarak)\b/gi;

const ENGLISH_STOP_WORDS =
  /\b(the|and|for|with|from|that|this|have|has|been|will|were|was|are|is|on|in|to|of|a|an|new|how|why|what|says|said|about|after|into|over|their|they|them|you|your)\b/gi;

const GENERIC_TURKISH_LEADS = [
  "Bugün gündemde yeni bir gelişme konuşuluyor.",
  "Sosyal medyada yine hareketli bir gün var.",
  "Gündem hızlı akıyor; yeni bir başlık daha eklendi.",
  "Haber akışında bugün dikkat çeken bir konu var.",
];

function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)] ?? "";
}

function topicLeads(topic) {
  const label = String(topic ?? "").trim();
  if (!label) {
    return GENERIC_TURKISH_LEADS;
  }
  return [
    `${label} gündemde; bugün yine konuşuluyor.`,
    `${label} tarafında yeni bir gelişme var gibi.`,
    `Bugün ${label} ile ilgili haberler dolaşıyor.`,
    `${label} konusu medyada yer buldu.`,
  ];
}

function looksMostlyTurkish(text) {
  const value = String(text ?? "").trim();
  if (!value) {
    return false;
  }
  if (/[ğüşıöçĞÜŞİÖÇ]/.test(value)) {
    return true;
  }
  const trHits = (value.match(TURKISH_MARKERS) || []).length;
  return trHits >= 2;
}

function looksMostlyEnglish(text) {
  const value = String(text ?? "").trim();
  if (!value) {
    return false;
  }
  if (looksMostlyTurkish(value)) {
    return false;
  }
  const enHits = (value.match(ENGLISH_STOP_WORDS) || []).length;
  if (enHits >= 2) {
    return true;
  }
  const latinWords = value.split(/\s+/).filter((word) => /^[A-Za-z][A-Za-z'-]*$/.test(word));
  return latinWords.length >= 5 && enHits >= 1;
}

function containsEnglishSentence(text) {
  const parts = String(text ?? "")
    .split(/[.!?]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 12);
  return parts.some((part) => looksMostlyEnglish(part));
}

function extractNewsHint(headline, persona) {
  const hint = String(headline ?? "").trim();
  if (!hint) {
    return null;
  }

  const lower = hint.toLowerCase();
  const keywords = Array.isArray(persona?.trendKeywords)
    ? persona.trendKeywords
    : [];

  if (looksMostlyTurkish(hint)) {
    const trimmed = hint.replace(/\s+/g, " ").trim();
    if (trimmed.length <= 48) {
      return trimmed;
    }
    const words = trimmed.split(" ").slice(0, 6).join(" ");
    return words.length <= 48 ? words : null;
  }

  for (const keyword of keywords) {
    const normalized = String(keyword).toLowerCase();
    if (normalized && lower.includes(normalized)) {
      const label = String(keyword);
      return label.charAt(0).toUpperCase() + label.slice(1);
    }
  }

  const stopWords = new Set([
    "the",
    "a",
    "an",
    "and",
    "or",
    "for",
    "to",
    "in",
    "on",
    "at",
    "new",
    "how",
    "why",
    "what",
  ]);
  const properNouns = hint
    .split(/\s+/)
    .filter((word) => /^[A-Z][a-zA-Z0-9+'-]{1,}$/.test(word))
    .filter((word) => !stopWords.has(word.toLowerCase()))
    .slice(0, 3);

  if (properNouns.length > 0) {
    const phrase = properNouns.join(" ");
    if (phrase.length <= 48) {
      return phrase;
    }
  }

  return null;
}

function stripHtml(text) {
  return String(text ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** RSS başlığından yalnızca Türkçe haber cümlesi (şablon modu). */
function summarizeNewsSeed(newsItem, persona) {
  const title = stripHtml(newsItem?.title);

  if (title.length >= 15 && looksMostlyTurkish(title) && !looksMostlyEnglish(title)) {
    return title.length > 130 ? `${title.slice(0, 127).trim()}…` : title;
  }

  const topic = extractNewsHint(title, persona);
  return pickRandom(topic ? topicLeads(topic) : GENERIC_TURKISH_LEADS);
}

module.exports = {
  extractNewsHint,
  stripHtml,
  summarizeNewsSeed,
  looksMostlyTurkish,
  looksMostlyEnglish,
  containsEnglishSentence,
};
