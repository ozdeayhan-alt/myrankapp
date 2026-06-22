const CAPTION_MAX_LENGTH = 40;

function sanitizeCaption(value) {
  if (value == null || value === "") {
    return null;
  }
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.slice(0, CAPTION_MAX_LENGTH);
}

module.exports = {
  sanitizeCaption,
  CAPTION_MAX_LENGTH,
};
