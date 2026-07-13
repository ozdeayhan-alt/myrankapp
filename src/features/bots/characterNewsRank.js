const { normalizeTitle } = require("./characterNewsDedupe");
const { looksMostlyTurkish, looksMostlyEnglish } = require("./characterNewsHint");

function scoreNewsItem(item, persona, feedIndex = 0) {
  const keywords = Array.isArray(persona.trendKeywords)
    ? persona.trendKeywords
    : [];
  const haystack = normalizeTitle(
    `${item.title} ${item.description ?? ""}`
  );

  let keywordScore = 0;
  for (const keyword of keywords) {
    const normalizedKeyword = normalizeTitle(keyword);
    if (normalizedKeyword && haystack.includes(normalizedKeyword)) {
      keywordScore += 3;
    }
  }

  // Feed sırası: önce gelen haber hafif bonus (trend proxy)
  const recencyBonus = Math.max(0, 8 - feedIndex);

  let publishedBonus = 0;
  if (item.publishedAt) {
    const published = new Date(item.publishedAt).getTime();
    if (!Number.isNaN(published)) {
      const ageHours = (Date.now() - published) / (1000 * 60 * 60);
      if (ageHours <= 6) {
        publishedBonus = 4;
      } else if (ageHours <= 24) {
        publishedBonus = 2;
      }
    }
  }

  let languageBonus = 0;
  if (looksMostlyTurkish(item.title)) {
    languageBonus += 6;
  }
  if (looksMostlyEnglish(item.title)) {
    languageBonus -= 8;
  }

  return keywordScore + recencyBonus + publishedBonus + languageBonus;
}

function rankNewsItems(items, persona) {
  return [...items]
    .map((item, index) => ({
      ...item,
      trendScore: scoreNewsItem(item, persona, index),
    }))
    .sort((a, b) => b.trendScore - a.trendScore);
}

function pickBestNewsItem(items, persona) {
  const ranked = rankNewsItems(items, persona);
  return ranked[0] ?? null;
}

module.exports = {
  scoreNewsItem,
  rankNewsItems,
  pickBestNewsItem,
};
