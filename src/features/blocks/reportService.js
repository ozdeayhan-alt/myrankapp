const { FieldValue } = require("firebase-admin/firestore");
const { db } = require("../../lib/firestore");
const { BlockError } = require("./blockErrors");

const REPORT_REASONS = new Set([
  "spam",
  "harassment",
  "inappropriate",
  "other",
]);

const REASON_LABELS = {
  spam: "Spam",
  harassment: "Taciz",
  inappropriate: "Uygunsuz içerik",
  other: "Diğer",
};

function normalizeReason(reason) {
  const value = typeof reason === "string" ? reason.trim() : "";
  if (!REPORT_REASONS.has(value)) {
    throw new BlockError(400, "Geçersiz şikayet nedeni");
  }
  return value;
}

async function createReport({
  reporterId,
  targetUserId,
  targetPostId,
  reason,
  details,
}) {
  const normalizedReason = normalizeReason(reason);
  const userId =
    typeof targetUserId === "string" && targetUserId.trim()
      ? targetUserId.trim()
      : null;
  const postId =
    typeof targetPostId === "string" && targetPostId.trim()
      ? targetPostId.trim()
      : null;

  if (!userId && !postId) {
    throw new BlockError(400, "Şikayet hedefi gerekli");
  }

  if (userId && userId === reporterId) {
    throw new BlockError(400, "Kendinizi şikayet edemezsiniz");
  }

  const ref = await db.collection("reports").add({
    reporterId,
    targetUserId: userId,
    targetPostId: postId,
    reason: normalizedReason,
    reasonLabel: REASON_LABELS[normalizedReason],
    details:
      typeof details === "string" && details.trim() ? details.trim() : null,
    createdAt: FieldValue.serverTimestamp(),
  });

  return { ok: true, reportId: ref.id };
}

module.exports = {
  createReport,
  REPORT_REASONS,
  REASON_LABELS,
};
