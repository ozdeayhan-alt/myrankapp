#!/usr/bin/env node
/**
 * Rebuild rankings/{segmentKey}/entries from users.totalScore.
 * Schedule: 00:00 Europe/Istanbul (see package.json / crontab).
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

const USERS_PAGE = 500;
const WRITE_BATCH = 400;

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

function computeTrendLabel(rankChange) {
  if (rankChange == null) return null;
  if (rankChange >= 20) return "rising";
  if (rankChange <= -20) return "falling";
  return "stable";
}

function computeMomentum(existingData, currentRank, currentTotalScore) {
  const previousRank =
    typeof existingData?.rank === "number" ? existingData.rank : null;
  const previousTotalScore =
    typeof existingData?.totalScore === "number"
      ? existingData.totalScore
      : null;

  const rankChange =
    previousRank != null ? previousRank - currentRank : null;
  const tpChange =
    previousTotalScore != null
      ? currentTotalScore - previousTotalScore
      : null;

  return {
    previousRank,
    rankChange,
    previousTotalScore,
    tpChange,
    trendLabel: computeTrendLabel(rankChange),
  };
}

async function writeSegmentEntries(segmentKey, entries) {
  const sorted = [...entries].sort((a, b) => b.totalScore - a.totalScore);
  const segmentTotal = sorted.length;

  for (let i = 0; i < sorted.length; i += WRITE_BATCH) {
    const chunk = sorted.slice(i, i + WRITE_BATCH);

    const entryRefs = chunk.map((entry) =>
      db
        .collection("rankings")
        .doc(segmentKey)
        .collection("entries")
        .doc(entry.userId)
    );
    const existingSnaps = await db.getAll(...entryRefs);
    const existingByUserId = new Map();
    for (const snap of existingSnaps) {
      if (snap.exists) {
        existingByUserId.set(snap.id, snap.data());
      }
    }

    const batch = db.batch();

    chunk.forEach((entry, chunkIndex) => {
      const globalIndex = i + chunkIndex;
      const currentRank = globalIndex + 1;
      const aheadEntry = globalIndex > 0 ? sorted[globalIndex - 1] : null;
      const behindEntry =
        globalIndex < sorted.length - 1 ? sorted[globalIndex + 1] : null;
      const entryRef = entryRefs[chunkIndex];
      const existing = existingByUserId.get(entry.userId);
      const momentum = computeMomentum(
        existing,
        currentRank,
        entry.totalScore
      );

      batch.set(entryRef, {
        userId: entry.userId,
        totalScore: entry.totalScore,
        displayName: entry.displayName,
        photoURL: entry.photoURL ?? "",
        metadata: entry.metadata ?? {},
        rank: currentRank,
        segmentTotal,
        aheadRank: aheadEntry ? currentRank - 1 : null,
        aheadTotalScore: aheadEntry ? aheadEntry.totalScore : null,
        behindRank: behindEntry ? currentRank + 1 : null,
        behindTotalScore: behindEntry ? behindEntry.totalScore : null,
        ...momentum,
        momentumUpdatedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    await batch.commit();
  }

  return sorted.length;
}

async function main() {
  console.log("[rebuild-rankings] Loading users...");
  const users = await fetchAllUsers();
  console.log(`[rebuild-rankings] ${users.length} users`);

  const buckets = buildSegmentBuckets(users);
  const rebuiltAt = FieldValue.serverTimestamp();

  let totalEntries = 0;
  for (const [segmentKey, entryMap] of buckets) {
    const count = await writeSegmentEntries(segmentKey, [...entryMap.values()]);
    totalEntries += count;
    console.log(`[rebuild-rankings] ${segmentKey}: ${count} entries`);
  }

  await db.collection("rankingSnapshots").doc("latest").set(
    {
      rebuiltAt,
      timezone: "Europe/Istanbul",
      userCount: users.length,
      segmentCount: buckets.size,
      totalEntries,
    },
    { merge: true }
  );

  console.log("[rebuild-rankings] Done.");
}

main().catch((err) => {
  console.error("[rebuild-rankings] Failed:", err);
  process.exit(1);
});
