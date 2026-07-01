#!/usr/bin/env node
/**
 * Rebuild rankings/{segmentKey}/entries ranks.
 * Default: incremental rank recalc from existing entries (no full users scan).
 * Full rebuild: RANKING_FULL_REBUILD=true (weekly integrity / new segment entries).
 *
 * Usage: node scripts/rebuild-rankings.js
 */
require("dotenv").config();

const { FieldValue } = require("firebase-admin/firestore");
const { db } = require("../src/lib/firestore");
const {
  getRankingSegmentKeys,
  GLOBAL_RANKING_SEGMENT,
  buildSegmentKey,
} = require("../src/lib/segmentKey");
const { DEFAULT_DISPLAY_NAME } = require("../src/features/ranking/engine/updateRankings");
const {
  recalculateAllSegmentRanks,
  writeRankedSegmentEntries,
} = require("../src/features/ranking/engine/recalculateSegmentRanks");
const { syncDirtyUsersFromFirestore } = require("../src/features/ranking/rankingScoreSync");
const { clearRankingDirty } = require("../src/features/ranking/rankingDirtyService");

const USERS_PAGE = 500;
const FULL_REBUILD = process.env.RANKING_FULL_REBUILD === "true";

async function fetchAllUsers() {
  const users = [];
  let lastDoc = null;

  while (true) {
    let query = db.collection("users").orderBy("__name__").limit(USERS_PAGE);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snap = await query.get();
    if (snap.empty) break;

    snap.docs.forEach((doc) => {
      const data = doc.data();
      users.push({
        userId: doc.id,
        totalScore: typeof data.totalScore === "number" ? data.totalScore : 0,
        displayName:
          typeof data.displayName === "string" && data.displayName.trim()
            ? data.displayName.trim()
            : DEFAULT_DISPLAY_NAME,
        photoURL:
          typeof data.photoURL === "string" && data.photoURL.trim()
            ? data.photoURL.trim()
            : "",
        metadata: data.metadata ?? null,
        isBot: data.isBot === true,
        botRole: typeof data.botRole === "string" ? data.botRole : null,
        segmentBotKey:
          typeof data.segmentBotKey === "string" ? data.segmentBotKey : null,
      });
    });

    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.size < USERS_PAGE) break;
  }

  return users;
}

function buildSegmentBuckets(users) {
  const buckets = new Map();

  function addToSegment(segmentKey, entry) {
    if (!buckets.has(segmentKey)) {
      buckets.set(segmentKey, new Map());
    }
    const map = buckets.get(segmentKey);
    const existing = map.get(entry.userId);
    if (!existing || entry.totalScore > existing.totalScore) {
      map.set(entry.userId, entry);
    }
  }

  for (const user of users) {
    const base = {
      userId: user.userId,
      totalScore: user.totalScore,
      displayName: user.displayName,
      photoURL: user.photoURL,
      metadata: user.metadata,
    };

    if (user.isBot && user.botRole === "segment") {
      if (user.metadata) {
        for (const segmentKey of getRankingSegmentKeys(user.metadata)) {
          addToSegment(segmentKey, {
            ...base,
            metadata: user.metadata,
          });
        }
      } else {
        const segmentKey =
          user.segmentBotKey ||
          (user.metadata ? buildSegmentKey(user.metadata) : null);
        if (segmentKey) {
          addToSegment(segmentKey, {
            ...base,
            metadata: user.metadata ?? {},
          });
        }
      }
      continue;
    }

    addToSegment(GLOBAL_RANKING_SEGMENT, {
      ...base,
      metadata: user.metadata ?? {},
    });

    if (user.metadata) {
      for (const segmentKey of getRankingSegmentKeys(user.metadata)) {
        addToSegment(segmentKey, {
          ...base,
          metadata: user.metadata,
        });
      }
    }
  }

  return buckets;
}

async function writeSegmentEntriesFromUsers(segmentKey, entries) {
  const sorted = [...entries].sort((a, b) => b.totalScore - a.totalScore);
  return writeRankedSegmentEntries(segmentKey, sorted);
}

async function runFullRebuild() {
  console.log("[rebuild-rankings] Full rebuild — loading users...");
  const users = await fetchAllUsers();
  console.log(`[rebuild-rankings] ${users.length} users`);

  const buckets = buildSegmentBuckets(users);
  let totalEntries = 0;

  for (const [segmentKey, entryMap] of buckets) {
    const count = await writeSegmentEntriesFromUsers(segmentKey, [
      ...entryMap.values(),
    ]);
    totalEntries += count;
    console.log(`[rebuild-rankings] ${segmentKey}: ${count} entries`);
  }

  return { userCount: users.length, segmentCount: buckets.size, totalEntries };
}

async function runIncrementalRebuild() {
  console.log("[rebuild-rankings] Incremental — syncing dirty user scores...");
  const dirtySync = await syncDirtyUsersFromFirestore();
  console.log(
    `[rebuild-rankings] Dirty sync: ${dirtySync.synced}/${dirtySync.total ?? 0}`
  );

  console.log("[rebuild-rankings] Recalculating segment ranks...");
  const { segmentKeys, perSegment, totalEntries } =
    await recalculateAllSegmentRanks();

  for (const segmentKey of segmentKeys) {
    console.log(
      `[rebuild-rankings] ${segmentKey}: ${perSegment[segmentKey] ?? 0} entries`
    );
  }

  await clearRankingDirty();

  return {
    userCount: null,
    segmentCount: segmentKeys.length,
    totalEntries,
    mode: "incremental",
  };
}

async function main() {
  const rebuiltAt = FieldValue.serverTimestamp();
  const summary = FULL_REBUILD
    ? await runFullRebuild()
    : await runIncrementalRebuild();

  await db.collection("rankingSnapshots").doc("latest").set(
    {
      rebuiltAt,
      timezone: "Europe/Istanbul",
      userCount: summary.userCount,
      segmentCount: summary.segmentCount,
      totalEntries: summary.totalEntries,
      mode: FULL_REBUILD ? "full" : "incremental",
    },
    { merge: true }
  );

  console.log("[rebuild-rankings] Done.");
}

main().catch((err) => {
  console.error("[rebuild-rankings] Failed:", err);
  process.exit(1);
});
