/** Haber başlığından Türkçe tartışma ipucu çıkarır (İngilizce başlık yapıştırmaz). */
function extractNewsHint(headline, persona) {
  const hint = String(headline ?? "").trim();
  if (!hint) {
    return null;
  }

  const lower = hint.toLowerCase();
  const keywords = Array.isArray(persona?.trendKeywords)
    ? persona.trendKeywords
    : [];

  for (const keyword of keywords) {
    const normalized = String(keyword).toLowerCase();
    if (normalized && lower.includes(normalized)) {
      const label = String(keyword);
      return label.charAt(0).toUpperCase() + label.slice(1);
    }
  }

  const stopWords = new Set(["the", "a", "an", "and", "or", "for", "to", "in", "on", "at"]);
  const properNouns = hint
    .split(/\s+/)
    .filter((word) => /^[A-Z][a-zA-Z0-9+'-]{1,}$/.test(word))
    .filter((word) => !stopWords.has(word.toLowerCase()))
    .slice(0, 3);

  if (properNouns.length > 0) {
    const phrase = properNouns.join(" ");
    if (phrase.length <= 36) {
      return phrase;
    }
  }

  return null;
}

module.exports = {
  extractNewsHint,
};
