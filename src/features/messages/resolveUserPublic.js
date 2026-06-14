const { db } = require("../../lib/firestore");

async function resolveUserPublic(userId) {
  const publicSnap = await db.collection("publicProfiles").doc(userId).get();
  if (publicSnap.exists) {
    const data = publicSnap.data();
    return {
      userId,
      displayName: String(data.displayName ?? "").trim() || "Kullanıcı",
      photoURL: data.photoURL ? String(data.photoURL) : undefined,
    };
  }

  const userSnap = await db.collection("users").doc(userId).get();
  if (userSnap.exists) {
    const data = userSnap.data();
    return {
      userId,
      displayName: String(data.displayName ?? "").trim() || "Kullanıcı",
      photoURL: data.photoURL ? String(data.photoURL) : undefined,
    };
  }

  return {
    userId,
    displayName: "Kullanıcı",
    photoURL: undefined,
  };
}

module.exports = { resolveUserPublic };
