function normalizeDisplayNameForSearch(displayName) {
  return String(displayName ?? "")
    .trim()
    .toLocaleLowerCase("tr-TR");
}

module.exports = { normalizeDisplayNameForSearch };
