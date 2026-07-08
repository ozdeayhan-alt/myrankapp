const { db } = require("../../lib/firestore");
const {
  SEEN_COLLECTION,
  hashNewsItem,
  normalizeTitle,
  titleOverlapRatio,
} = require("./characterNewsDedupe");

async function isNewsSeen(hash) {
  if (!hash) {
    return true;
  }
  const snap = await db.collection(SEEN_COLLECTION).doc(hash).get();
  return snap.exists;
}

async function markNewsSeen({
  hash,
  url,
  title,
  characterUid,
  postId,
  feedLabel,
}) {
  if (!hash) {
    return;
  }

  await db.collection(SEEN_COLLECTION).doc(hash).set(
    {
      hash,
      url: url ?? null,
      titleNorm: normalizeTitle(title),
      usedByCharacterUid: characterUid ?? null,
      postId: postId ?? null,
      feedLabel: feedLabel ?? null,
      usedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}

async function filterUnseenNewsItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  const unseen = [];
  for (const item of items) {
    const hash = hashNewsItem(item);
    // eslint-disable-next-line no-await-in-loop
    const seen = await isNewsSeen(hash);
    if (!seen) {
      unseen.push({ ...item, hash });
    }
  }
  return unseen;
}

function passesTitleOverlapGate(candidateTitle, sourceTitle, maxRatio = 0.45) {
  return titleOverlapRatio(candidateTitle, sourceTitle) <= maxRatio;
}

module.exports = {
  isNewsSeen,
  markNewsSeen,
  filterUnseenNewsItems,
  passesTitleOverlapGate,
};
