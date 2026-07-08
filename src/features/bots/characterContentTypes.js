/** Karakter içerik tipleri — sponsor için kind genişletilebilir. */
const CHARACTER_CONTENT_TYPES = {
  NEWS: "news",
  EVERGREEN: "evergreen",
  FUN: "fun",
  SPOTLIGHT: "spotlight",
};

/** İçerik kaynağı — ileride sponsored eklenebilir. */
const CHARACTER_SOURCE_KINDS = {
  RSS: "rss",
  BANK: "bank",
  TEMPLATE: "template",
  AI: "ai",
  SPONSORED: "sponsored",
};

module.exports = {
  CHARACTER_CONTENT_TYPES,
  CHARACTER_SOURCE_KINDS,
};
