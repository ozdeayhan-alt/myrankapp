const { FieldValue } = require("firebase-admin/firestore");
const { db } = require("../../lib/firestore");
const { CHARACTER_PERSONAS } = require("./characterPersonas");
const { randomInt } = require("./botUtils");

const SCHEDULE_COLLECTION = "characterSchedule";
const DAILY_QUOTA_COLLECTION = "characterDailyQuota";

const WINDOW_START_HOUR = 8;
const WINDOW_END_HOUR = 23;
const MIN_SLOT_GAP_MINUTES = 10;
const POSTS_PER_CHARACTER_MIN = 3;
const POSTS_PER_CHARACTER_MAX = 7;

function isCharacterPostsEnabled() {
  const raw = process.env.CHARACTER_POSTS_ENABLED?.trim().toLowerCase();
  if (raw === "0" || raw === "false") {
    return false;
  }
  return true;
}

function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function scheduleDocId(dateKey, characterUid) {
  return `${dateKey}_${characterUid}`;
}

function scheduleRef(dateKey, characterUid) {
  return db.collection(SCHEDULE_COLLECTION).doc(scheduleDocId(dateKey, characterUid));
}

function quotaRef(dateKey, characterUid) {
  return db.collection(DAILY_QUOTA_COLLECTION).doc(scheduleDocId(dateKey, characterUid));
}

function randomMinuteInWindow() {
  const startMinutes = WINDOW_START_HOUR * 60;
  const endMinutes = WINDOW_END_HOUR * 60;
  return randomInt(startMinutes, endMinutes);
}

/**
 * Üretir: dakika listesi (sıralı, min gap), bir spotlight slot index.
 * Pure — test için export.
 */
function buildDailySlotsForCharacter({
  postCount,
  usedMinutes = [],
  spotlightSlotIndex = null,
}) {
  const count = Math.min(
    POSTS_PER_CHARACTER_MAX,
    Math.max(POSTS_PER_CHARACTER_MIN, postCount)
  );
  const taken = new Set(usedMinutes);
  const slots = [];

  let attempts = 0;
  while (slots.length < count && attempts < 500) {
    attempts += 1;
    const minute = randomMinuteInWindow();
    if (taken.has(minute)) {
      continue;
    }
    const tooClose = [...taken].some(
      (other) => Math.abs(other - minute) < MIN_SLOT_GAP_MINUTES
    );
    if (tooClose) {
      continue;
    }
    taken.add(minute);
    slots.push(minute);
  }

  slots.sort((a, b) => a - b);

  const spotlightIndex =
    spotlightSlotIndex != null && spotlightSlotIndex < slots.length
      ? spotlightSlotIndex
      : slots.length > 0
        ? randomInt(0, slots.length - 1)
        : null;

  return { slots, spotlightIndex, takenMinutes: [...taken] };
}

function buildGlobalDailySchedule({ date = new Date(), postCountsByUid = {} } = {}) {
  const globalTaken = new Set();
  const spotlightCharacterUid =
    CHARACTER_PERSONAS[randomInt(0, CHARACTER_PERSONAS.length - 1)].uid;
  const result = {};

  for (const persona of CHARACTER_PERSONAS) {
    const postCount =
      postCountsByUid[persona.uid] ??
      randomInt(POSTS_PER_CHARACTER_MIN, POSTS_PER_CHARACTER_MAX);

    const isSpotlightCharacter = persona.uid === spotlightCharacterUid;
    const built = buildDailySlotsForCharacter({
      postCount,
      usedMinutes: [...globalTaken],
      spotlightSlotIndex: isSpotlightCharacter ? 0 : null,
    });

    for (const minute of built.slots) {
      globalTaken.add(minute);
    }

    result[persona.uid] = {
      slots: built.slots.map((minuteOfDay, index) => ({
        minuteOfDay,
        at: slotAtFromMinute(date, minuteOfDay),
        type:
          isSpotlightCharacter && index === built.spotlightIndex
            ? "spotlight"
            : "normal",
        posted: false,
      })),
      spotlightSlotIndex: built.spotlightIndex,
    };
  }

  return {
    dateKey: todayKey(date),
    spotlightCharacterUid,
    schedules: result,
  };
}

function slotAtFromMinute(date, minuteOfDay) {
  const at = new Date(date);
  at.setHours(0, 0, 0, 0);
  at.setMinutes(minuteOfDay);
  return at.toISOString();
}

async function ensureDailySchedules(date = new Date()) {
  const dateKey = todayKey(date);
  const missing = [];

  for (const persona of CHARACTER_PERSONAS) {
    const snap = await scheduleRef(dateKey, persona.uid).get();
    if (!snap.exists) {
      missing.push(persona.uid);
    }
  }

  if (missing.length === 0) {
    return { created: 0, dateKey };
  }

  const plan = buildGlobalDailySchedule({ date });
  const batch = db.batch();
  let created = 0;

  for (const persona of CHARACTER_PERSONAS) {
    const ref = scheduleRef(dateKey, persona.uid);
    const snap = await ref.get();
    if (snap.exists) {
      continue;
    }

    const schedule = plan.schedules[persona.uid];
    batch.set(ref, {
      dateKey,
      characterUid: persona.uid,
      slots: schedule.slots,
      spotlightCharacterUid: plan.spotlightCharacterUid,
      createdAt: FieldValue.serverTimestamp(),
    });

    batch.set(
      quotaRef(dateKey, persona.uid),
      {
        dateKey,
        characterUid: persona.uid,
        targetCount: schedule.slots.length,
        postedCount: 0,
      },
      { merge: true }
    );

    created += 1;
  }

  if (created > 0) {
    await batch.commit();
  }

  return { created, dateKey };
}

async function listDueSlots(now = new Date()) {
  const dateKey = todayKey(now);
  const due = [];

  for (const persona of CHARACTER_PERSONAS) {
    const snap = await scheduleRef(dateKey, persona.uid).get();
    if (!snap.exists) {
      continue;
    }

    const data = snap.data();
    const slots = Array.isArray(data.slots) ? data.slots : [];

    for (let index = 0; index < slots.length; index += 1) {
      const slot = slots[index];
      if (slot.posted) {
        continue;
      }
      const at = new Date(slot.at);
      if (Number.isNaN(at.getTime()) || at > now) {
        continue;
      }
      due.push({
        dateKey,
        characterUid: persona.uid,
        slotIndex: index,
        slotType: slot.type === "spotlight" ? "spotlight" : "normal",
      });
    }
  }

  return due;
}

async function markSlotPosted({ dateKey, characterUid, slotIndex, postId }) {
  const ref = scheduleRef(dateKey, characterUid);
  const snap = await ref.get();
  if (!snap.exists) {
    return false;
  }

  const data = snap.data();
  const slots = Array.isArray(data.slots) ? [...data.slots] : [];
  if (!slots[slotIndex] || slots[slotIndex].posted) {
    return false;
  }

  slots[slotIndex] = {
    ...slots[slotIndex],
    posted: true,
    postId: postId ?? null,
    postedAt: FieldValue.serverTimestamp(),
  };

  await ref.update({ slots });

  await quotaRef(dateKey, characterUid).set(
    {
      postedCount: FieldValue.increment(1),
      lastPostAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return true;
}

module.exports = {
  SCHEDULE_COLLECTION,
  DAILY_QUOTA_COLLECTION,
  WINDOW_START_HOUR,
  WINDOW_END_HOUR,
  MIN_SLOT_GAP_MINUTES,
  POSTS_PER_CHARACTER_MIN,
  POSTS_PER_CHARACTER_MAX,
  isCharacterPostsEnabled,
  todayKey,
  buildDailySlotsForCharacter,
  buildGlobalDailySchedule,
  slotAtFromMinute,
  ensureDailySchedules,
  listDueSlots,
  markSlotPosted,
};
