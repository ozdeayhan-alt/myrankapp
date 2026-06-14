#!/usr/bin/env node
/**
 * Enables Google Sign-In in Firebase Auth when OAuth Web client credentials exist.
 * Run after creating the Web client in Firebase Console:
 * Authentication → Sign-in method → Google → Enable
 */
const fs = require("fs");
const path = require("path");

function readFirebaseAccessToken() {
  const configPath = path.join(
    process.env.HOME || "/root",
    ".config/configstore/firebase-tools.json"
  );
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  return config?.tokens?.access_token ?? null;
}

async function getGoogleIdpConfig(token, projectId) {
  const url = `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/defaultSupportedIdpConfigs/google.com`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json();
}

async function main() {
  const projectId = process.env.FIREBASE_PROJECT_ID || "myrankapp-d62b9";
  const token = readFirebaseAccessToken();
  if (!token) {
    throw new Error("firebase-tools login gerekli");
  }

  const config = await getGoogleIdpConfig(token, projectId);
  if (!config) {
    console.log(
      "Google Sign-In henüz etkin değil. Firebase Console'da bir kez açın:"
    );
    console.log(
      `https://console.firebase.google.com/project/${projectId}/authentication/providers`
    );
    console.log(
      "Google → Enable → Web client ID'yi kopyalayıp EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID olarak kaydedin."
    );
    process.exit(1);
  }

  console.log("Google Sign-In etkin.");
  console.log(`Web client ID: ${config.clientId}`);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
