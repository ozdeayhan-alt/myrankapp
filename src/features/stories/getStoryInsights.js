const { loadAccessibleStory } = require("./storyAccess");
const { StoryError } = require("./storyErrors");

function serializeActorEntry(doc) {
  const data = doc.data();
  const ts = data.viewedAt ?? data.likedAt;
  return {
    userId: data.actorId ?? doc.id,
    displayName: data.displayName ?? "Kullanıcı",
    photoURL: data.photoURL ?? null,
    at: ts?.toMillis?.() ?? null,
  };
}

/**
 * @param {string} ownerId
 * @param {string} storyId
 */
async function getStoryInsights(ownerId, storyId) {
  const { ref, data } = await loadAccessibleStory(ownerId, storyId);

  if (data.userId !== ownerId) {
    throw new StoryError(403, "Yalnızca kendi story'nizin istatistiklerini görebilirsiniz");
  }

  const [viewsSnap, likesSnap] = await Promise.all([
    ref.collection("views").orderBy("viewedAt", "desc").limit(100).get(),
    ref.collection("likes").orderBy("likedAt", "desc").limit(100).get(),
  ]);

  return {
    storyId,
    viewCount: data.viewCount ?? viewsSnap.size,
    heartLikeCount: data.heartLikeCount ?? likesSnap.size,
    storyScore: data.storyScore ?? 0,
    viewers: viewsSnap.docs.map(serializeActorEntry),
    likers: likesSnap.docs.map(serializeActorEntry),
  };
}

module.exports = { getStoryInsights };
