function parseFirebaseStorageUrl(url) {
  if (!url || typeof url !== "string") {
    return null;
  }

  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes("firebasestorage.googleapis.com")) {
      return null;
    }

    const match = parsed.pathname.match(/\/o\/(.+)$/);
    if (!match?.[1]) {
      return null;
    }

    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

module.exports = { parseFirebaseStorageUrl };
