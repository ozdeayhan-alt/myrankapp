#!/usr/bin/env node
/**
 * Ensure Firebase Auth authorized domains include production + staging hosts.
 * Usage: node scripts/ensure-authorized-domains.js
 */
const path = require("path");
const admin = require("../firebase-config");

const PROJECT_ID =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.GCLOUD_PROJECT ||
  "myrankapp-d62b9";

const DOMAINS = (process.env.FIREBASE_AUTHORIZED_DOMAINS ||
  "myrank.com.tr,staging.myrank.com.tr")
  .split(",")
  .map((d) => d.trim())
  .filter(Boolean);

async function getAccessToken() {
  const serviceAccountPath =
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    path.join(__dirname, "..", "service-account.json");
  const serviceAccount = require(serviceAccountPath);
  const credential = admin.credential.cert(serviceAccount);
  const token = await credential.getAccessToken();
  return token.access_token;
}

async function main() {
  const accessToken = await getAccessToken();
  const baseUrl = `https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJECT_ID}/config`;

  const getRes = await fetch(baseUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!getRes.ok) {
    const body = await getRes.text();
    throw new Error(`GET config failed (${getRes.status}): ${body}`);
  }

  const config = await getRes.json();
  const current = Array.isArray(config.authorizedDomains)
    ? config.authorizedDomains
    : [];
  const merged = [...new Set([...current, ...DOMAINS])].sort();

  const missing = DOMAINS.filter((d) => !current.includes(d));
  if (missing.length === 0) {
    console.log(
      `[authorized-domains] OK — already configured: ${merged.join(", ")}`
    );
    return;
  }

  const patchRes = await fetch(`${baseUrl}?updateMask=authorizedDomains`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ authorizedDomains: merged }),
  });

  if (!patchRes.ok) {
    const body = await patchRes.text();
    throw new Error(`PATCH config failed (${patchRes.status}): ${body}`);
  }

  const updated = await patchRes.json();
  console.log(
    `[authorized-domains] Added: ${missing.join(", ")}`
  );
  console.log(
    `[authorized-domains] Current: ${(updated.authorizedDomains || merged).join(", ")}`
  );
}

main().catch((error) => {
  console.error("[authorized-domains] FAILED:", error.message);
  process.exit(1);
});
