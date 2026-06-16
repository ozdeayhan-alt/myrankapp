const LEGACY_STORAGE_BUCKET = "myrank-d62b9-storage";

function currentStorageBucket() {
  return (
    process.env.FIREBASE_STORAGE_BUCKET || "myrankapp-d62b9.firebasestorage.app"
  );
}

function normalizeStoragePhotoUrl(url) {
  if (typeof url !== "string" || !url.trim()) {
    return { normalized: "", changed: false };
  }

  const trimmed = url.trim();
  if (!trimmed.includes(LEGACY_STORAGE_BUCKET)) {
    return { normalized: trimmed, changed: false };
  }

  const bucket = currentStorageBucket();
  const normalized = trimmed.replace(
    `/b/${LEGACY_STORAGE_BUCKET}/`,
    `/b/${bucket}/`
  );

  return {
    normalized,
    changed: normalized !== trimmed,
  };
}

module.exports = {
  LEGACY_STORAGE_BUCKET,
  currentStorageBucket,
  normalizeStoragePhotoUrl,
};
