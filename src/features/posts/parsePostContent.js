const HASHTAG_PATTERN = /#([\p{L}\p{N}_]+)/gu;
const MENTION_PATTERN = /@([\p{L}\p{N}_.]+)/gu;

function normalizeHashtag(raw) {
  return raw.replace(/^#/, "").trim().toLocaleLowerCase("tr-TR");
}

function extractHashtags(content) {
  const tags = new Set();
  for (const match of content.matchAll(HASHTAG_PATTERN)) {
    const normalized = normalizeHashtag(match[1] ?? "");
    if (normalized.length >= 2) {
      tags.add(normalized);
    }
  }
  return [...tags];
}

function extractMentionTokens(content) {
  const tokens = new Set();
  for (const match of content.matchAll(MENTION_PATTERN)) {
    const token = (match[1] ?? "").trim();
    if (token.length >= 2) {
      tokens.add(token);
    }
  }
  return [...tokens];
}

module.exports = {
  extractHashtags,
  extractMentionTokens,
};
