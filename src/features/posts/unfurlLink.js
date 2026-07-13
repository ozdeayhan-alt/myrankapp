const { normalizeHttpsUrl, normalizeLinkTitle } = require("./normalizeWhispLink");

const FETCH_TIMEOUT_MS = 5000;
const MAX_BODY_BYTES = 512 * 1024;
const MAX_REDIRECTS = 3;
const LINK_DESCRIPTION_MAX = 200;

const META_PATTERNS = {
  title: [
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i,
    /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:title["']/i,
  ],
  description: [
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i,
    /<meta[^>]+name=["']twitter:description["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:description["']/i,
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i,
  ],
  image: [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
  ],
};

function decodeHtmlEntities(value) {
  let decoded = String(value ?? "");

  decoded = decoded.replace(/&#(\d+);/g, (_, digits) => {
    const code = Number.parseInt(digits, 10);
    return Number.isFinite(code) ? String.fromCodePoint(code) : _;
  });

  decoded = decoded.replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
    const code = Number.parseInt(hex, 16);
    return Number.isFinite(code) ? String.fromCodePoint(code) : _;
  });

  return decoded
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function extractFirstMatch(html, patterns) {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      const decoded = decodeHtmlEntities(match[1]);
      if (decoded) {
        return decoded;
      }
    }
  }
  return null;
}

function extractTitleTag(html) {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match?.[1] ? decodeHtmlEntities(match[1]) : null;
}

function normalizeLinkDescription(raw) {
  if (!raw) {
    return null;
  }
  const trimmed = String(raw).replace(/\s+/g, " ").trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.length > LINK_DESCRIPTION_MAX) {
    return `${trimmed.slice(0, LINK_DESCRIPTION_MAX - 1).trim()}…`;
  }
  return trimmed;
}

function resolveImageUrl(rawImage, pageUrl) {
  if (!rawImage) {
    return null;
  }

  let candidate = String(rawImage).trim();
  if (!candidate) {
    return null;
  }

  try {
    if (candidate.startsWith("//")) {
      candidate = `https:${candidate}`;
    } else if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(candidate)) {
      candidate = new URL(candidate, pageUrl).toString();
    }
    return normalizeHttpsUrl(candidate);
  } catch {
    return null;
  }
}

function parseOpenGraphFromHtml(html, pageUrl) {
  const title =
    extractFirstMatch(html, META_PATTERNS.title) ?? extractTitleTag(html);
  const description = extractFirstMatch(html, META_PATTERNS.description);
  const imageRaw = extractFirstMatch(html, META_PATTERNS.image);

  return {
    linkTitle: normalizeLinkTitle(title),
    linkDescription: normalizeLinkDescription(description),
    linkImageUrl: resolveImageUrl(imageRaw, pageUrl),
  };
}

async function readResponseBody(response) {
  const reader = response.body?.getReader?.();
  if (!reader) {
    const text = await response.text();
    return text.slice(0, MAX_BODY_BYTES);
  }

  const chunks = [];
  let total = 0;

  while (total < MAX_BODY_BYTES) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    const chunk = Buffer.from(value);
    const remaining = MAX_BODY_BYTES - total;
    chunks.push(chunk.length > remaining ? chunk.subarray(0, remaining) : chunk);
    total += chunk.length;
  }

  return Buffer.concat(chunks).toString("utf8");
}

async function fetchHtml(url, redirectCount = 0) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
      headers: {
        "User-Agent": "MyRankLinkPreview/1.0",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location || redirectCount >= MAX_REDIRECTS) {
        return null;
      }
      const nextUrl = normalizeHttpsUrl(new URL(location, url).toString());
      if (!nextUrl) {
        return null;
      }
      return fetchHtml(nextUrl, redirectCount + 1);
    }

    if (!response.ok) {
      return null;
    }

    const contentType = String(response.headers.get("content-type") ?? "");
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      return null;
    }

    return readResponseBody(response);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function unfurlLink(rawUrl) {
  const linkUrl = normalizeHttpsUrl(rawUrl);
  if (!linkUrl) {
    return {};
  }

  const html = await fetchHtml(linkUrl);
  if (!html) {
    return { linkUrl };
  }

  const parsed = parseOpenGraphFromHtml(html, linkUrl);
  return {
    linkUrl,
    ...(parsed.linkTitle ? { linkTitle: parsed.linkTitle } : {}),
    ...(parsed.linkDescription ? { linkDescription: parsed.linkDescription } : {}),
    ...(parsed.linkImageUrl ? { linkImageUrl: parsed.linkImageUrl } : {}),
  };
}

module.exports = {
  LINK_DESCRIPTION_MAX,
  parseOpenGraphFromHtml,
  unfurlLink,
};
