const { CAPTION_MAX_LENGTH } = require("./chipKeys");

const BLOCKED_CAPTION_PATTERN =
  /(http:\/\/|https:\/\/|www\.|\.com\b|\.tr\b)/i;

function sanitizeCaption(raw) {
  if (raw == null || raw === "") {
    return null;
  }

  const trimmed = String(raw).trim().replace(/\s+/g, " ");
  if (!trimmed) {
    return null;
  }

  if (trimmed.length > CAPTION_MAX_LENGTH) {
    throw new Error(`Caption en fazla ${CAPTION_MAX_LENGTH} karakter olabilir`);
  }

  if (BLOCKED_CAPTION_PATTERN.test(trimmed)) {
    throw new Error("Caption URL içeremez");
  }

  return trimmed;
}

module.exports = {
  sanitizeCaption,
};
