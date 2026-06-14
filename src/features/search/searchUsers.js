const { db } = require("../../lib/firestore");
const { filterUsersForViewer } = require("../blocks/blockService");
const { normalizeDisplayNameForSearch } = require("../../lib/normalizeDisplayNameForSearch");

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 30;
const MIN_QUERY_LENGTH = 2;

function parseLimit(rawLimit) {
  const parsed = Number.parseInt(String(rawLimit ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_LIMIT;
  }
  return Math.min(parsed, MAX_LIMIT);
}

function mapSearchDoc(doc) {
  const data = doc.data();
  return {
    userId: doc.id,
    displayName:
      typeof data.displayName === "string" && data.displayName.trim()
        ? data.displayName.trim()
        : "Kullanıcı",
    photoURL:
      typeof data.photoURL === "string" && data.photoURL.trim()
        ? data.photoURL.trim()
        : null,
  };
}

async function searchUsers(rawQuery, { limit = DEFAULT_LIMIT, viewerId } = {}) {
  const query = normalizeDisplayNameForSearch(rawQuery);

  if (query.length < MIN_QUERY_LENGTH) {
    return { ok: true, users: [], query: rawQuery.trim() };
  }

  const pageSize = parseLimit(limit);
  const snapshot = await db
    .collection("publicProfiles")
    .where("displayNameLower", ">=", query)
    .where("displayNameLower", "<=", `${query}\uf8ff`)
    .limit(pageSize)
    .get();

  const users = await filterUsersForViewer(
    viewerId,
    snapshot.docs.map(mapSearchDoc)
  );

  return {
    ok: true,
    users,
    query: rawQuery.trim(),
  };
}

module.exports = { searchUsers, MIN_QUERY_LENGTH };
