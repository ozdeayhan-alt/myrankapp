const Parser = require("rss-parser");
const { getYoutubeChannelsForCharacter } = require("./characterYoutubeChannels");

const parser = new Parser({
  timeout: 12_000,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (compatible; MyRankCharacterBot/1.0; +https://myrank.com.tr)",
    Accept: "application/rss+xml, application/xml, text/xml, */*",
  },
});

const HTML_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "accept-language": "en-US,en;q=0.9",
  accept: "text/html,application/xhtml+xml",
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function channelFeedUrl(channelId) {
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
}

function extractVideoIdFromEntry(entry) {
  if (entry?.id && typeof entry.id === "string") {
    const match = entry.id.match(/yt:video:([\w-]{11})/);
    if (match?.[1]) {
      return match[1];
    }
  }
  const link = entry?.link || entry?.guid;
  if (typeof link === "string") {
    const watch = link.match(/[?&]v=([\w-]{11})/);
    if (watch?.[1]) {
      return watch[1];
    }
    const short = link.match(/youtu\.be\/([\w-]{11})/);
    if (short?.[1]) {
      return short[1];
    }
  }
  return null;
}

function publishedAtMs(entry) {
  const raw = entry.isoDate || entry.pubDate || entry.published;
  if (!raw) {
    return 0;
  }
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : 0;
}

async function fetchChannelRss(channel, { maxPerChannel = 8, retries = 2 } = {}) {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    if (attempt > 0) {
      await sleep(400 * attempt);
    }
    try {
      const feed = await parser.parseURL(channelFeedUrl(channel.channelId));
      const items = Array.isArray(feed.items) ? feed.items : [];
      return items.slice(0, maxPerChannel).flatMap((entry) => {
        const videoId = extractVideoIdFromEntry(entry);
        if (!videoId) {
          return [];
        }
        return [
          {
            videoId,
            title: String(entry.title ?? "").trim(),
            providerUrl: `https://www.youtube.com/watch?v=${videoId}`,
            channelId: channel.channelId,
            channelLabel: channel.label,
            publishedAtMs: publishedAtMs(entry),
            source: "channel_rss",
          },
        ];
      });
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error("RSS failed");
}

async function fetchOembedTitle(videoId) {
  try {
    const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(
      `https://www.youtube.com/watch?v=${videoId}`
    )}&format=json`;
    const response = await fetch(url, { headers: HTML_HEADERS });
    if (!response.ok) {
      return "";
    }
    const data = await response.json();
    return String(data.title ?? "").trim();
  } catch {
    return "";
  }
}

/**
 * HTML scrape of /@handle/videos — used when RSS is rate-limited (404/500).
 */
async function fetchChannelHtml(channel, { maxPerChannel = 8 } = {}) {
  if (!channel.handle) {
    return [];
  }
  const response = await fetch(
    `https://www.youtube.com/@${encodeURIComponent(channel.handle)}/videos`,
    { headers: HTML_HEADERS }
  );
  if (!response.ok) {
    throw new Error(`HTML ${response.status}`);
  }
  const html = await response.text();
  const ids = [
    ...new Set(
      [...html.matchAll(/"videoId":"([\w-]{11})"/g)].map((match) => match[1])
    ),
  ].slice(0, maxPerChannel);

  const results = [];
  for (const videoId of ids) {
    const title = await fetchOembedTitle(videoId);
    results.push({
      videoId,
      title: title || videoId,
      providerUrl: `https://www.youtube.com/watch?v=${videoId}`,
      channelId: channel.channelId,
      channelLabel: channel.label,
      publishedAtMs: Date.now() - results.length * 60_000,
      source: "channel_html",
    });
  }
  return results;
}

/**
 * Fetch recent videos from curated channels for a character.
 * Optional YouTube Data API search when YOUTUBE_API_KEY is set.
 */
async function fetchCharacterYoutubeCandidates(persona, { maxPerChannel = 8 } = {}) {
  const channels = getYoutubeChannelsForCharacter(persona.uid);
  const byId = new Map();

  for (const channel of channels) {
    let got = [];
    try {
      got = await fetchChannelRss(channel, { maxPerChannel });
    } catch (rssError) {
      console.warn(
        `[characterYoutubeSearch] RSS failed ${persona.uid} ${channel.label}:`,
        rssError.message ?? rssError
      );
      try {
        got = await fetchChannelHtml(channel, { maxPerChannel });
        if (got.length === 0) {
          console.warn(
            `[characterYoutubeSearch] HTML empty ${persona.uid} ${channel.label}`
          );
        }
      } catch (htmlError) {
        console.warn(
          `[characterYoutubeSearch] HTML failed ${persona.uid} ${channel.label}:`,
          htmlError.message ?? htmlError
        );
      }
    }

    for (const item of got) {
      if (!byId.has(item.videoId)) {
        byId.set(item.videoId, item);
      }
    }
    // Soft pacing between channels to reduce YouTube rate limits.
    await sleep(250);
  }

  const apiKey = process.env.YOUTUBE_API_KEY?.trim();
  if (apiKey && Array.isArray(persona.trendKeywords) && persona.trendKeywords.length > 0) {
    try {
      const query = persona.trendKeywords.slice(0, 3).join(" ");
      const publishedAfter = new Date(
        Date.now() - 45 * 24 * 60 * 60 * 1000
      ).toISOString();
      const url = new URL("https://www.googleapis.com/youtube/v3/search");
      url.searchParams.set("part", "snippet");
      url.searchParams.set("type", "video");
      url.searchParams.set("maxResults", "8");
      url.searchParams.set("order", "viewCount");
      url.searchParams.set("q", query);
      url.searchParams.set("publishedAfter", publishedAfter);
      url.searchParams.set("key", apiKey);

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        for (const item of data.items ?? []) {
          const videoId = item?.id?.videoId;
          if (!videoId || byId.has(videoId)) {
            continue;
          }
          byId.set(videoId, {
            videoId,
            title: String(item.snippet?.title ?? "").trim(),
            providerUrl: `https://www.youtube.com/watch?v=${videoId}`,
            channelId: item.snippet?.channelId ?? "",
            channelLabel: item.snippet?.channelTitle ?? "youtube-search",
            publishedAtMs: Date.parse(item.snippet?.publishedAt ?? "") || 0,
            source: "youtube_api",
          });
        }
      } else {
        console.warn(
          `[characterYoutubeSearch] API ${response.status} for ${persona.uid}`
        );
      }
    } catch (error) {
      console.warn(
        `[characterYoutubeSearch] API failed ${persona.uid}:`,
        error.message ?? error
      );
    }
  }

  return [...byId.values()].sort((a, b) => b.publishedAtMs - a.publishedAtMs);
}

module.exports = {
  channelFeedUrl,
  extractVideoIdFromEntry,
  fetchCharacterYoutubeCandidates,
  fetchChannelHtml,
  fetchChannelRss,
};
