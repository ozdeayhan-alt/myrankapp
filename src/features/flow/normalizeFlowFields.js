const { PostError } = require("../posts/postErrors");
const { resolveFlowUrl } = require("./providers/registry");

async function normalizeFlowFields(input = {}) {
  const providerUrl = typeof input.providerUrl === "string" ? input.providerUrl.trim() : "";
  if (!providerUrl) {
    throw new PostError(400, "Flow paylaşımı için video bağlantısı gerekli");
  }

  let resolved;
  try {
    resolved = await resolveFlowUrl(providerUrl);
  } catch (error) {
    console.warn("[normalizeFlowFields] provider resolve failed:", error?.message ?? error);
    throw new PostError(400, "Video bağlantısı doğrulanamadı");
  }

  if (!resolved) {
    throw new PostError(400, "Desteklenmeyen veya geçersiz video bağlantısı");
  }

  return {
    provider: resolved.provider,
    providerUrl: resolved.providerUrl,
    providerVideoId: resolved.providerVideoId,
    thumbnailUrl: resolved.thumbnailUrl,
    title: resolved.title ?? "",
    duration: typeof resolved.duration === "number" ? resolved.duration : null,
  };
}

module.exports = { normalizeFlowFields };
