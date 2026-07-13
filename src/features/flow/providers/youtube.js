const PROVIDER_ID = "youtube";

const VIDEO_ID_PATTERNS = [
  /(?:youtube\.com\/watch\?v=|youtube\.com\/watch\?.*&v=)([\w-]{11})/i,
  /youtu\.be\/([\w-]{11})/i,
  /youtube\.com\/shorts\/([\w-]{11})/i,
  /youtube\.com\/embed\/([\w-]{11})/i,
  /m\.youtube\.com\/watch\?v=([\w-]{11})/i,
];

function extractVideoId(url) {
  if (!url || typeof url !== "string") {
    return null;
  }

  const trimmed = url.trim();
  for (const pattern of VIDEO_ID_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

function buildCanonicalUrl(videoId) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

function buildThumbnailUrl(videoId) {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

function buildEmbedUrl(videoId, options = {}) {
  const params = new URLSearchParams({
    playsinline: "1",
    rel: "0",
    modestbranding: "1",
  });

  if (options.autoplay) {
    params.set("autoplay", "1");
  }
  if (options.muted) {
    params.set("mute", "1");
  }
  if (options.controls === false) {
    params.set("controls", "0");
  }
  if (typeof options.startSeconds === "number") {
    params.set("start", String(options.startSeconds));
  }
  if (typeof options.endSeconds === "number") {
    params.set("end", String(options.endSeconds));
  }
  if (options.loop) {
    params.set("loop", "1");
    params.set("playlist", videoId);
  }

  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

async function fetchOEmbed(providerUrl) {
  const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(providerUrl)}&format=json`;
  const response = await fetch(endpoint, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    return null;
  }

  return response.json();
}

const youtubeProvider = {
  id: PROVIDER_ID,
  canResolve(url) {
    return extractVideoId(url) !== null;
  },
  async resolve(url) {
    const providerVideoId = extractVideoId(url);
    if (!providerVideoId) {
      return null;
    }

    const providerUrl = buildCanonicalUrl(providerVideoId);
    let title;
    let thumbnailUrl = buildThumbnailUrl(providerVideoId);

    try {
      const oembed = await fetchOEmbed(providerUrl);
      if (oembed?.title) {
        title = String(oembed.title);
      }
      if (oembed?.thumbnail_url) {
        thumbnailUrl = String(oembed.thumbnail_url);
      }
    } catch {
      // oEmbed is best-effort; thumbnail fallback is always available.
    }

    return {
      provider: PROVIDER_ID,
      providerVideoId,
      providerUrl,
      thumbnailUrl,
      title,
      duration: null,
    };
  },
  buildEmbedUrl(providerVideoId, options) {
    return buildEmbedUrl(providerVideoId, options);
  },
  buildPreviewEmbedUrl(providerVideoId) {
    return buildEmbedUrl(providerVideoId, {
      autoplay: true,
      muted: true,
      controls: false,
      startSeconds: 0,
      endSeconds: 3,
      loop: true,
    });
  },
};

module.exports = { youtubeProvider };
