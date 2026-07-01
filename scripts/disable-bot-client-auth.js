#!/usr/bin/env node
/**
 * Production: mevcut bot Firebase Auth hesaplarını client login'e kapatır.
 * Sunucu script'leri admin SDK ile çalışmaya devam eder.
 *
 * Usage: NODE_ENV=production node scripts/disable-bot-client-auth.js
 */
require("dotenv").config();

const crypto = require("crypto");
const admin = require("../firebase-config");
const { BOT_PERSONAS } = require("../src/features/bots/botPersonas");

function randomPassword() {
  return crypto.randomBytes(32).toString("base64url");
}

(async () => {
  for (const persona of BOT_PERSONAS) {
    try {
      await admin.auth().updateUser(persona.uid, {
        disabled: true,
        password: randomPassword(),
      });
      console.log(`[bots] disabled client auth: ${persona.uid}`);
    } catch (error) {
      if (error.code === "auth/user-not-found") {
        console.log(`[bots] skip missing: ${persona.uid}`);
        continue;
      }
      throw error;
    }
  }
  console.log("[bots] done");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
