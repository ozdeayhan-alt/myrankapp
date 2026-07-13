const PROVIDER_ID = "tiktok";

const TIKTOK_URL_PATTERNS = [
  /tiktok\.com\/@[^/]+\/video\/(\d+)/i,
  /tiktok\.com\/t\/([A-Za-z0-9]+)/i,
  /vm\.tiktok\.com\/([A-Za-z0-9]+)/i,
  /vt\.tiktok\.com\/([A-Za-z0-9]+)/i,
  /tiktok\.com\/embed\/v2\/(\d+)/i,
];

function extractVideoId(url) {
  if (!url || typeof url !== "string") {
    return null;
  }

  const trimmed = url.trim();
  for (const pattern of TIKTOK_URL_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

function buildEmbedUrl(videoId) {
  return `https://www.tiktok.com/embed/v2/${videoId}`;
}

async function fetchOEmbed(providerUrl) {
  const endpoint = `https://www.tiktok.com/oembed?url=${encodeURIComponent(providerUrl)}`;
  const response = await fetch(endpoint, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    return null;
  }

  return response.json();
}

const tiktokProvider = {
  id: PROVIDER_ID,
  canResolve(url) {
    return extractVideoId(url) !== null || /tiktok\.com|vm\.tiktok\.com|vt\.tiktok\.com/i.test(url);
  },
  async resolve(url) {
    const trimmed = String(url ?? "").trim();
    let providerUrl = trimmed;
    let providerVideoId = extractVideoId(trimmed);
    let title;
    let thumbnailUrl;

    try {
      const oembed = await fetchOEmbed(trimmed);
      if (oembed?.author_url && oembed?.embed_product_id) {
        providerVideoId = String(oembed.embed_product_id);
        providerUrl = trimmed;
      } else if (oembed?.author_url) {
        providerUrl = trimmed;
      }
      if (oembed?.title) {
        title = String(oembed.title);
      }
      if (oembed?.thumbnail_url) {
        thumbnailUrl = String(oembed.thumbnail_url);
      }
    } catch {
      // oEmbed is best-effort.
    }

    if (!providerVideoId) {
      providerVideoId = extractVideoId(providerUrl);
    }

    if (!providerVideoId) {
      return null;
    }

    return {
      provider: PROVIDER_ID,
      providerVideoId,
      providerUrl,
      thumbnailUrl: thumbnailUrl ?? "",
      title,
      duration: null,
    };
  },
  buildEmbedUrl(providerVideoId) {
    return buildEmbedUrl(providerVideoId);
  },
  buildPreviewEmbedUrl(providerVideoId) {
    return buildEmbedUrl(providerVideoId);
  },
};

module.exports = { tiktokProvider };
