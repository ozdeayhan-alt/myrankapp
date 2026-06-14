const { db } = require("../../lib/firestore");
const { BOT_PERSONAS, avatarUrl } = require("./botPersonas");

async function backfillBotPostPhotos() {
  let updated = 0;

  for (const persona of BOT_PERSONAS) {
    const photoURL = avatarUrl(persona);
    const snap = await db
      .collection("posts")
      .where("authorId", "==", persona.uid)
      .get();

    if (snap.empty) continue;

    const batch = db.batch();
    snap.docs.forEach((doc) => {
      batch.update(doc.ref, { authorPhotoURL: photoURL });
    });
    await batch.commit();
    updated += snap.size;
  }

  return updated;
}

module.exports = { backfillBotPostPhotos };
