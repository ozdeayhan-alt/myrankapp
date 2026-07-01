const { db } = require("../../lib/firestore");

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

const NOTIFICATION_TYPES = new Set([
  "post_liked",
  "post_commented",
  "post_saved",
  "post_reposted",
  "message_received",
  "profile_votes",
  "rank_passed",
  "user_followed",
  "post_mentioned",
]);

function mapNotification(id, data) {
  if (!data || !NOTIFICATION_TYPES.has(data.type)) {
    return null;
  }

  const payload =
    data.payload && typeof data.payload === "object" ? data.payload : {};

  return {
    id,
    type: data.type,
    actorId: typeof data.actorId === "string" ? data.actorId : "",
    actorDisplayName:
      typeof data.actorDisplayName === "string"
        ? data.actorDisplayName
        : "Biri",
    payload,
    createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? null,
  };
}

async function fetchNotifications(userId, limit = DEFAULT_LIMIT) {
  const pageLimit = Math.min(
    Math.max(Number(limit) || DEFAULT_LIMIT, 1),
    MAX_LIMIT
  );

  const snap = await db
    .collection("users")
    .doc(userId)
    .collection("notifications")
    .orderBy("createdAt", "desc")
    .limit(pageLimit)
    .get();

  const items = [];
  for (const doc of snap.docs) {
    const mapped = mapNotification(doc.id, doc.data());
    if (mapped) {
      items.push(mapped);
    }
  }

  return items;
}

module.exports = {
  fetchNotifications,
  DEFAULT_LIMIT,
  MAX_LIMIT,
};
