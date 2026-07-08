const crypto = require("crypto");

const SEEN_COLLECTION = "characterNewsSeen";

function normalizeTitle(title) {
  return String(title ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9ğüşıöçĞÜŞİÖÇ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hashNewsItem({ url, title }) {
  const canonicalUrl = String(url ?? "").trim().toLowerCase();
  if (canonicalUrl) {
    return crypto.createHash("sha256").update(`url:${canonicalUrl}`).digest("hex");
  }
  const normalized = normalizeTitle(title);
  return crypto
    .createHash("sha256")
    .update(`title:${normalized}`)
    .digest("hex");
}

function titleOverlapRatio(a, b) {
  const tokensA = new Set(normalizeTitle(a).split(" ").filter(Boolean));
  const tokensB = new Set(normalizeTitle(b).split(" ").filter(Boolean));
  if (tokensA.size === 0 || tokensB.size === 0) {
    return 0;
  }
  let overlap = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) {
      overlap += 1;
    }
  }
  return overlap / Math.max(tokensA.size, tokensB.size);
}

module.exports = {
  SEEN_COLLECTION,
  normalizeTitle,
  hashNewsItem,
  titleOverlapRatio,
};
