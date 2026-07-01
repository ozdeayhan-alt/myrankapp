const { db } = require("../../lib/firestore");

function mapOwnProfile(userId, data) {
  if (!data) {
    return null;
  }

  const metadata =
    data.metadata && typeof data.metadata === "object"
      ? {
          country: String(data.metadata.country ?? ""),
          city: String(data.metadata.city ?? ""),
          gender: String(data.metadata.gender ?? ""),
          age: typeof data.metadata.age === "number" ? data.metadata.age : null,
          profession: String(data.metadata.profession ?? ""),
          maritalStatus: String(data.metadata.maritalStatus ?? ""),
        }
      : {
          country: "",
          city: "",
          age: null,
          gender: "",
          profession: "",
          maritalStatus: "",
        };

  return {
    userId,
    email: String(data.email ?? ""),
    displayName: String(data.displayName ?? ""),
    photoURL: data.photoURL ? String(data.photoURL) : "",
    bio: typeof data.bio === "string" ? data.bio.trim() : "",
    bioCategoryVisibility:
      data.bioCategoryVisibility &&
      typeof data.bioCategoryVisibility === "object"
        ? data.bioCategoryVisibility
        : undefined,
    metadata,
    totalScore: typeof data.totalScore === "number" ? data.totalScore : 0,
  };
}

async function fetchOwnProfile(userId) {
  const snap = await db.collection("users").doc(userId).get();
  if (!snap.exists) {
    return null;
  }
  return mapOwnProfile(userId, snap.data());
}

module.exports = { fetchOwnProfile, mapOwnProfile };
