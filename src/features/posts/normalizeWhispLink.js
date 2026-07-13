const { PostError } = require("./postErrors");

const LINK_TITLE_MAX = 120;
const LINK_DESCRIPTION_MAX = 200;

function normalizeLinkDescription(raw) {
  if (raw === undefined || raw === null || raw === "") {
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

function normalizeLinkImageUrl(raw) {
  if (raw === undefined || raw === null || raw === "") {
    return null;
  }
  return normalizeHttpsUrl(raw);
}

function hasUrlScheme(value) {
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value);
}

function coerceHttpsCandidate(raw) {
  const trimmed = String(raw).trim();
  if (!trimmed) {
    return null;
  }
  if (hasUrlScheme(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

function normalizeHttpsUrl(raw) {
  if (raw === undefined || raw === null || raw === "") {
    return null;
  }

  const candidate = coerceHttpsCandidate(raw);
  if (!candidate) {
    return null;
  }

  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new PostError(400, "Geçersiz link");
  }

  if (parsed.protocol !== "https:") {
    throw new PostError(400, "Link https ile başlamalı");
  }

  const hostname = parsed.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname.endsWith(".local") ||
    hostname === "127.0.0.1" ||
    !hostname.includes(".")
  ) {
    throw new PostError(400, "Geçersiz link");
  }

  return parsed.toString();
}

function normalizeLinkTitle(raw) {
  if (raw === undefined || raw === null || raw === "") {
    return null;
  }

  const trimmed = String(raw).trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.length > LINK_TITLE_MAX) {
    return `${trimmed.slice(0, LINK_TITLE_MAX - 1).trim()}…`;
  }

  return trimmed;
}

function normalizeWhispLinkFields(contentType, input = {}) {
  const hasLinkInput = input.linkUrl != null && String(input.linkUrl).trim() !== "";
  const hasTitleInput =
    input.linkTitle != null && String(input.linkTitle).trim() !== "";

  if (contentType !== "tweet") {
    if (hasLinkInput || hasTitleInput) {
      throw new PostError(400, "Link yalnızca Whisp gönderilerinde kullanılabilir");
    }
    return {};
  }

  const linkUrl = normalizeHttpsUrl(input.linkUrl);
  if (!linkUrl) {
    if (hasTitleInput) {
      throw new PostError(400, "Link başlığı için geçerli bir link gerekli");
    }
    return {};
  }

  const linkTitle = normalizeLinkTitle(input.linkTitle);
  const linkDescription = normalizeLinkDescription(input.linkDescription);
  const linkImageUrl = normalizeLinkImageUrl(input.linkImageUrl);

  return {
    linkUrl,
    ...(linkTitle ? { linkTitle } : {}),
    ...(linkDescription ? { linkDescription } : {}),
    ...(linkImageUrl ? { linkImageUrl } : {}),
  };
}

module.exports = {
  LINK_TITLE_MAX,
  LINK_DESCRIPTION_MAX,
  normalizeHttpsUrl,
  normalizeLinkTitle,
  normalizeLinkDescription,
  normalizeLinkImageUrl,
  normalizeWhispLinkFields,
};
