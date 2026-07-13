const { youtubeProvider } = require("./youtube");
const { tiktokProvider } = require("./tiktok");

/** @type {import("./types").FlowProvider[]} */
const providers = [youtubeProvider, tiktokProvider];

/**
 * @param {string} url
 * @returns {import("./types").FlowProvider | null}
 */
function findProviderForUrl(url) {
  for (const provider of providers) {
    if (provider.canResolve(url)) {
      return provider;
    }
  }
  return null;
}

/**
 * @param {string} providerId
 * @returns {import("./types").FlowProvider | null}
 */
function getProviderById(providerId) {
  if (!providerId) {
    return null;
  }

  return providers.find((entry) => entry.id === providerId) ?? null;
}

/**
 * @param {string} url
 * @returns {Promise<import("./types").FlowResolvedVideo | null>}
 */
async function resolveFlowUrl(url) {
  const provider = findProviderForUrl(url);
  if (!provider) {
    return null;
  }

  return provider.resolve(url);
}

/**
 * @param {{ provider?: string, providerVideoId?: string }} post
 * @param {Record<string, unknown>} [options]
 * @returns {string | null}
 */
function buildEmbedUrlForPost(post, options = {}) {
  const provider = getProviderById(post?.provider);
  if (!provider || !post?.providerVideoId) {
    return null;
  }

  return provider.buildEmbedUrl(post.providerVideoId, options);
}

module.exports = {
  providers,
  findProviderForUrl,
  getProviderById,
  resolveFlowUrl,
  buildEmbedUrlForPost,
};
