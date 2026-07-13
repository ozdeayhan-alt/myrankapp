const { CHARACTER_CONTENT_TYPES } = require("./characterContentTypes");
const { stripHtml, looksMostlyTurkish } = require("./characterNewsHint");

const DEFAULT_LINK_CHANCE = 0.25;

function getCharacterLinkChance() {
  const raw = process.env.CHARACTER_LINK_CHANCE?.trim();
  if (!raw) {
    return DEFAULT_LINK_CHANCE;
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    return DEFAULT_LINK_CHANCE;
  }
  return value;
}

function shouldAttachCharacterLink({ contentType, newsItem }) {
  if (contentType !== CHARACTER_CONTENT_TYPES.NEWS) {
    return false;
  }
  const url = String(newsItem?.url ?? "").trim();
  if (!url.startsWith("https://")) {
    return false;
  }
  return Math.random() < getCharacterLinkChance();
}

function buildLinkTitleFromNews(newsItem) {
  const title = stripHtml(newsItem?.title).trim();
  if (title.length >= 8 && looksMostlyTurkish(title)) {
    return title.length > 80 ? `${title.slice(0, 77).trim()}…` : title;
  }
  return "Kaynağı görüntüle";
}

function resolveCharacterLink({ contentType, newsItem }) {
  if (!shouldAttachCharacterLink({ contentType, newsItem })) {
    return null;
  }

  return {
    linkUrl: String(newsItem.url).trim(),
    linkTitle: buildLinkTitleFromNews(newsItem),
  };
}

module.exports = {
  DEFAULT_LINK_CHANCE,
  getCharacterLinkChance,
  shouldAttachCharacterLink,
  buildLinkTitleFromNews,
  resolveCharacterLink,
};
