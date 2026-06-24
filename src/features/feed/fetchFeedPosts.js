const { db } = require("../../lib/firestore");
const { mapPostDoc } = require("./mapPostDoc");

const DEFAULT_LIMIT = 15;

function encodeCursor(docId, sortField, sortValue) {
  const payload = `${docId}|${sortField}|${sortValue}`;
  return Buffer.from(payload, "utf8").toString("base64url");
}

function decodeCursor(cursor) {
  if (!cursor || typeof cursor !== "string") {
    return null;
  }

  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8");
    const [docId, sortField, sortValue] = decoded.split("|");
    if (!docId || !sortField) {
      return null;
    }
    return { docId, sortField, sortValue };
  } catch {
    return null;
  }
}

async function resolveStartAfter(cursorInfo) {
  if (!cursorInfo?.docId) {
    return null;
  }

  const snap = await db.collection("posts").doc(cursorInfo.docId).get();
  return snap.exists ? snap : null;
}

function buildPageResult(docs, pageSize, sortField) {
  const posts = docs.map((doc) => mapPostDoc(doc.id, doc.data()));
  const lastDoc = docs[docs.length - 1] ?? null;
  const cursor = lastDoc
    ? encodeCursor(
        lastDoc.id,
        sortField,
        sortField === "createdAt"
          ? lastDoc.data().createdAt?.toMillis?.() ?? 0
          : lastDoc.data().postScore ?? 0
      )
    : null;

  return {
    posts,
    cursor,
    hasMore: docs.length === pageSize,
  };
}

async function fetchRecentFeedPage({ cursor, limit = DEFAULT_LIMIT }) {
  const pageSize = Math.min(Math.max(Number(limit) || DEFAULT_LIMIT, 1), 50);
  let query = db.collection("posts").orderBy("createdAt", "desc").limit(pageSize);

  const cursorInfo = decodeCursor(cursor);
  if (cursorInfo) {
    const startAfterDoc = await resolveStartAfter(cursorInfo);
    if (startAfterDoc) {
      query = query.startAfter(startAfterDoc);
    }
  }

  const snap = await query.get();
  return buildPageResult(snap.docs, pageSize, "createdAt");
}

async function fetchExploreFeedPage({
  segmentKey,
  filters,
  cursor,
  limit = DEFAULT_LIMIT,
}) {
  const pageSize = Math.min(Math.max(Number(limit) || DEFAULT_LIMIT, 1), 50);
  let queryRef = db.collection("posts");

  const exploreOrderField =
    process.env.EXPLORE_ORDER_BY === "postScore" ? "postScore" : "createdAt";

  const metadataFilters = filters && typeof filters === "object" ? filters : null;
  const hasSegmentKey =
    segmentKey && typeof segmentKey === "string" && segmentKey.trim().length > 0;

  if (hasSegmentKey) {
    queryRef = queryRef
      .where("segmentKey", "==", segmentKey.trim())
      .orderBy(exploreOrderField, "desc");
  } else if (metadataFilters) {
    if (metadataFilters.country?.trim()) {
      queryRef = queryRef.where(
        "metadata.country",
        "==",
        metadataFilters.country.trim()
      );
    }
    if (metadataFilters.city?.trim()) {
      queryRef = queryRef.where("metadata.city", "==", metadataFilters.city.trim());
    }
    if (metadataFilters.gender?.trim()) {
      queryRef = queryRef.where(
        "metadata.gender",
        "==",
        metadataFilters.gender.trim()
      );
    }
    if (typeof metadataFilters.age === "number" && metadataFilters.age > 0) {
      queryRef = queryRef.where("metadata.age", "==", metadataFilters.age);
    }
    if (metadataFilters.profession?.trim()) {
      queryRef = queryRef.where(
        "metadata.profession",
        "==",
        metadataFilters.profession.trim()
      );
    }
    if (metadataFilters.maritalStatus?.trim()) {
      queryRef = queryRef.where(
        "metadata.maritalStatus",
        "==",
        metadataFilters.maritalStatus.trim()
      );
    }
    queryRef = queryRef.orderBy(exploreOrderField, "desc");
  } else {
    queryRef = queryRef.orderBy(exploreOrderField, "desc");
  }

  queryRef = queryRef.limit(pageSize);

  const cursorInfo = decodeCursor(cursor);
  if (cursorInfo) {
    const startAfterDoc = await resolveStartAfter(cursorInfo);
    if (startAfterDoc) {
      queryRef = queryRef.startAfter(startAfterDoc);
    }
  }

  const snap = await queryRef.get();
  return buildPageResult(snap.docs, pageSize, exploreOrderField);
}

const MAX_FOLLOWING_AUTHORS = 100;
const IN_QUERY_CHUNK_SIZE = 10;

const {
  getFollowingAuthorsCached,
  setFollowingAuthorsCached,
} = require("./feedCache");

function chunkArray(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function getFollowingAuthorIds(userId) {
  const cached = await getFollowingAuthorsCached(userId);
  if (cached) {
    return cached;
  }

  const snap = await db
    .collection("follows")
    .where("followerId", "==", userId)
    .orderBy("createdAt", "desc")
    .limit(MAX_FOLLOWING_AUTHORS)
    .get();

  const authorIds = snap.docs
    .map((doc) => doc.data().targetUserId)
    .filter((id) => typeof id === "string" && id.trim().length > 0);

  await setFollowingAuthorsCached(userId, authorIds);
  return authorIds;
}

function comparePostDocsDesc(a, b) {
  const aMs = a.data().createdAt?.toMillis?.() ?? 0;
  const bMs = b.data().createdAt?.toMillis?.() ?? 0;
  if (bMs !== aMs) {
    return bMs - aMs;
  }
  return b.id.localeCompare(a.id);
}

function isBeforeCursor(doc, cursorMillis, cursorDocId) {
  if (!cursorDocId) {
    return true;
  }

  const ms = doc.data().createdAt?.toMillis?.() ?? 0;
  if (ms < cursorMillis) {
    return true;
  }
  if (ms === cursorMillis) {
    return doc.id < cursorDocId;
  }
  return false;
}

async function fetchFollowingFeedPageLegacy({
  userId,
  cursor,
  limit = DEFAULT_LIMIT,
}) {
  const pageSize = Math.min(Math.max(Number(limit) || DEFAULT_LIMIT, 1), 50);
  const authorIds = await getFollowingAuthorIds(userId);

  if (authorIds.length === 0) {
    return { posts: [], cursor: null, hasMore: false };
  }

  const cursorInfo = decodeCursor(cursor);
  let cursorMillis = null;
  let cursorDocId = null;

  if (cursorInfo?.docId) {
    const cursorDoc = await db.collection("posts").doc(cursorInfo.docId).get();
    if (cursorDoc.exists) {
      cursorMillis = cursorDoc.data().createdAt?.toMillis?.() ?? 0;
      cursorDocId = cursorDoc.id;
    }
  }

  const chunks = chunkArray(authorIds, IN_QUERY_CHUNK_SIZE);
  const perChunkLimit = pageSize + 5;
  const docMap = new Map();

  await Promise.all(
    chunks.map(async (chunk) => {
      const snap = await db
        .collection("posts")
        .where("authorId", "in", chunk)
        .orderBy("createdAt", "desc")
        .limit(perChunkLimit)
        .get();

      for (const doc of snap.docs) {
        if (!docMap.has(doc.id)) {
          docMap.set(doc.id, doc);
        }
      }
    })
  );

  const merged = Array.from(docMap.values())
    .filter((doc) =>
      isBeforeCursor(doc, cursorMillis ?? Number.MAX_SAFE_INTEGER, cursorDocId)
    )
    .sort(comparePostDocsDesc);

  const pageDocs = merged.slice(0, pageSize);
  const hasMore = merged.length > pageSize;

  const posts = pageDocs.map((doc) => mapPostDoc(doc.id, doc.data()));
  const lastDoc = pageDocs[pageDocs.length - 1] ?? null;
  const nextCursor = lastDoc
    ? encodeCursor(
        lastDoc.id,
        "createdAt",
        lastDoc.data().createdAt?.toMillis?.() ?? 0
      )
    : null;

  return {
    posts,
    cursor: hasMore ? nextCursor : null,
    hasMore,
  };
}

async function fetchFollowingFeedFromUserFeeds({
  userId,
  cursor,
  limit = DEFAULT_LIMIT,
}) {
  const pageSize = Math.min(Math.max(Number(limit) || DEFAULT_LIMIT, 1), 50);
  let queryRef = db
    .collection("userFeeds")
    .doc(userId)
    .collection("items")
    .orderBy("createdAtMillis", "desc")
    .limit(pageSize + 1);

  const cursorInfo = decodeCursor(cursor);
  if (cursorInfo?.docId) {
    const cursorDoc = await db
      .collection("userFeeds")
      .doc(userId)
      .collection("items")
      .doc(cursorInfo.docId)
      .get();
    if (cursorDoc.exists) {
      queryRef = db
        .collection("userFeeds")
        .doc(userId)
        .collection("items")
        .orderBy("createdAtMillis", "desc")
        .startAfter(cursorDoc)
        .limit(pageSize + 1);
    }
  }

  const itemSnap = await queryRef.get();
  const itemDocs = itemSnap.docs;
  const hasMore = itemDocs.length > pageSize;
  const pageItems = hasMore ? itemDocs.slice(0, pageSize) : itemDocs;

  if (pageItems.length === 0) {
    return { posts: [], cursor: null, hasMore: false, source: "userFeeds" };
  }

  const postRefs = pageItems.map((itemDoc) =>
    db.collection("posts").doc(itemDoc.id)
  );
  const postSnaps = await db.getAll(...postRefs);
  const posts = postSnaps
    .filter((snap) => snap.exists)
    .map((snap) => mapPostDoc(snap.id, snap.data()));

  posts.sort((a, b) => {
    const aMs = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bMs = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bMs - aMs;
  });

  const lastItem = pageItems[pageItems.length - 1] ?? null;
  const nextCursor = lastItem
    ? encodeCursor(
        lastItem.id,
        "createdAt",
        lastItem.data().createdAtMillis ?? 0
      )
    : null;

  return {
    posts,
    cursor: hasMore ? nextCursor : null,
    hasMore,
    source: "userFeeds",
  };
}

const USE_USER_FEEDS_ONLY =
  process.env.FOLLOWING_FEED_USER_FEEDS_ONLY === "true";

async function fetchFollowingFeedPage({
  userId,
  cursor,
  limit = DEFAULT_LIMIT,
}) {
  const userFeedPage = await fetchFollowingFeedFromUserFeeds({
    userId,
    cursor,
    limit,
  });

  if (USE_USER_FEEDS_ONLY) {
    return userFeedPage;
  }

  if (userFeedPage.posts.length > 0 || cursor) {
    return userFeedPage;
  }

  return fetchFollowingFeedPageLegacy({ userId, cursor, limit });
}

async function fetchAuthorFeedPage({
  authorId,
  cursor,
  limit = DEFAULT_LIMIT,
}) {
  if (!authorId || typeof authorId !== "string") {
    return { posts: [], cursor: null, hasMore: false };
  }

  const pageSize = Math.min(Math.max(Number(limit) || DEFAULT_LIMIT, 1), 50);
  let query = db
    .collection("posts")
    .where("authorId", "==", authorId.trim())
    .orderBy("createdAt", "desc")
    .limit(pageSize);

  const cursorInfo = decodeCursor(cursor);
  if (cursorInfo) {
    const startAfterDoc = await resolveStartAfter(cursorInfo);
    if (startAfterDoc) {
      query = db
        .collection("posts")
        .where("authorId", "==", authorId.trim())
        .orderBy("createdAt", "desc")
        .startAfter(startAfterDoc)
        .limit(pageSize);
    }
  }

  const snap = await query.get();
  return buildPageResult(snap.docs, pageSize, "createdAt");
}

async function fetchHashtagFeedPage({
  tag,
  cursor,
  limit = DEFAULT_LIMIT,
}) {
  const normalizedTag =
    typeof tag === "string"
      ? tag.trim().replace(/^#/, "").toLowerCase()
      : "";

  if (!normalizedTag) {
    return { posts: [], cursor: null, hasMore: false };
  }

  const pageSize = Math.min(Math.max(Number(limit) || DEFAULT_LIMIT, 1), 50);
  let query = db
    .collection("posts")
    .where("hashtags", "array-contains", normalizedTag)
    .orderBy("createdAt", "desc")
    .limit(pageSize);

  const cursorInfo = decodeCursor(cursor);
  if (cursorInfo) {
    const startAfterDoc = await resolveStartAfter(cursorInfo);
    if (startAfterDoc) {
      query = db
        .collection("posts")
        .where("hashtags", "array-contains", normalizedTag)
        .orderBy("createdAt", "desc")
        .startAfter(startAfterDoc)
        .limit(pageSize);
    }
  }

  const snap = await query.get();
  return buildPageResult(snap.docs, pageSize, "createdAt");
}

module.exports = {
  fetchRecentFeedPage,
  fetchExploreFeedPage,
  fetchFollowingFeedPage,
  fetchAuthorFeedPage,
  fetchHashtagFeedPage,
};
