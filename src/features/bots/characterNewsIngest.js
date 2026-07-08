const Parser = require("rss-parser");

const parser = new Parser({
  timeout: 15_000,
  headers: {
    "User-Agent": "MyRankCharacterBot/1.0",
  },
});

function normalizeRssItem(item, feedLabel) {
  const url = item.link || item.guid || "";
  const title = item.title || "";
  const description =
    item.contentSnippet || item.summary || item.content || "";

  if (!title.trim()) {
    return null;
  }

  return {
    url: String(url).trim(),
    title: String(title).trim(),
    description: String(description).trim().slice(0, 500),
    feedLabel: feedLabel ?? "unknown",
    publishedAt: item.isoDate || item.pubDate || null,
  };
}

async function fetchRssFeed({ url, label }) {
  if (!url) {
    return [];
  }

  try {
    const feed = await parser.parseURL(url);
    const items = Array.isArray(feed.items) ? feed.items : [];
    return items
      .map((item) => normalizeRssItem(item, label))
      .filter(Boolean)
      .slice(0, 20);
  } catch (error) {
    console.warn(
      `[characterNewsIngest] feed failed ${label ?? url}:`,
      error.message ?? error
    );
    return [];
  }
}

async function fetchNewsForPersona(persona) {
  const feeds = Array.isArray(persona.rssFeeds) ? persona.rssFeeds : [];
  const all = [];

  for (const feed of feeds) {
    // eslint-disable-next-line no-await-in-loop
    const items = await fetchRssFeed(feed);
    all.push(...items);
  }

  return all;
}

module.exports = {
  fetchRssFeed,
  fetchNewsForPersona,
  normalizeRssItem,
};
