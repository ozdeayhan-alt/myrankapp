#!/usr/bin/env node
/**
 * PM2 + API health monitor.
 * Exits 1 on failure (for cron alerting). Logs to logs/health-monitor.log.
 *
 * Usage:
 *   node scripts/health-monitor.js
 *   HEALTH_ALERT_WEBHOOK=https://... node scripts/health-monitor.js
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const LOG_DIR = path.join(ROOT, "logs");
const LOG_FILE = path.join(LOG_DIR, "health-monitor.log");
const API_URL = process.env.HEALTH_CHECK_URL || "https://myrank.com.tr/status";
const STAGING_URL =
  process.env.STAGING_HEALTH_CHECK_URL || "https://staging.myrank.com.tr/status";
const PM2_APP = process.env.PM2_APP_NAME || "myrankapp";
const STAGING_PM2_APP = process.env.STAGING_PM2_APP_NAME || "myrankapp-staging";
const TIMEOUT_MS = Number(process.env.HEALTH_CHECK_TIMEOUT_MS) || 10000;
const WEBHOOK = process.env.HEALTH_ALERT_WEBHOOK?.trim() || "";

function log(line) {
  const entry = `[${new Date().toISOString()}] ${line}\n`;
  fs.mkdirSync(LOG_DIR, { recursive: true });
  fs.appendFileSync(LOG_FILE, entry);
  console.log(line);
}

async function fetchStatus(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const statusSecret = process.env.STATUS_SECRET?.trim();
  const headers = {};
  if (statusSecret) {
    headers["X-Status-Secret"] = statusSecret;
  }

  try {
    const response = await fetch(url, { signal: controller.signal, headers });
    const body = await response.json().catch(() => ({}));
    return {
      ok: response.ok && body.status === "ok",
      httpStatus: response.status,
      body,
    };
  } finally {
    clearTimeout(timer);
  }
}

function checkPm2App(name) {
  try {
    const raw = execSync(`pm2 jlist`, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    const apps = JSON.parse(raw);
    const app = apps.find((entry) => entry.name === name);
    if (!app) {
      return { ok: false, reason: `PM2 app not found: ${name}` };
    }
    const status = app.pm2_env?.status;
    const restarts = app.pm2_env?.restart_time ?? 0;
    if (status !== "online") {
      return { ok: false, reason: `${name} status=${status}` };
    }
    return { ok: true, restarts };
  } catch (error) {
    return { ok: false, reason: error.message };
  }
}

async function postWebhook(message) {
  if (!WEBHOOK) {
    return;
  }

  try {
    await fetch(WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: message }),
    });
  } catch (error) {
    log(`Webhook failed: ${error.message}`);
  }
}

async function main() {
  const failures = [];

  const pm2 = checkPm2App(PM2_APP);
  if (!pm2.ok) {
    failures.push(pm2.reason);
  } else {
    log(`PM2 ${PM2_APP}: online (restarts=${pm2.restarts})`);
  }

  const api = await fetchStatus(API_URL);
  if (!api.ok) {
    failures.push(
      `API ${API_URL} failed (http=${api.httpStatus}, status=${api.body?.status ?? "unknown"})`
    );
  } else {
    log(`API ${API_URL}: ok`);
    if (api.body?.mediaProxy && api.body.mediaProxy !== "ok") {
      failures.push(`Media proxy degraded (status=${api.body.mediaProxy})`);
    } else if (api.body?.mediaProxy === "ok") {
      log(`Media proxy: ok (cache=${api.body.mediaProxyCacheStatus ?? "n/a"})`);
    }
    if (api.body?.redisStatus && api.body.redisStatus !== "connected") {
      failures.push(`Redis not connected (status=${api.body.redisStatus})`);
    } else if (api.body?.redisStatus === "connected") {
      log("Redis: connected");
    }
    const apiRequests = api.body?.metrics?.apiRequests;
    const alertThreshold = Number(process.env.FIRESTORE_USAGE_ALERT_API_REQUESTS);
    if (
      Number.isFinite(alertThreshold) &&
      alertThreshold > 0 &&
      typeof apiRequests === "number" &&
      apiRequests > alertThreshold
    ) {
      failures.push(
        `API request volume high since restart (${apiRequests} > ${alertThreshold})`
      );
    }
  }

  const stagingPm2 = checkPm2App(STAGING_PM2_APP);
  if (stagingPm2.ok) {
    log(`PM2 ${STAGING_PM2_APP}: online (restarts=${stagingPm2.restarts})`);
    try {
      const stagingApi = await fetchStatus(STAGING_URL);
      if (!stagingApi.ok) {
        log(
          `Staging API warning: ${STAGING_URL} not ready (http=${stagingApi.httpStatus})`
        );
      } else {
        log(`Staging API ${STAGING_URL}: ok`);
      }
    } catch (error) {
      log(`Staging API skipped (DNS/HTTPS not ready): ${error.message}`);
    }
  }

  if (failures.length > 0) {
    const message = `MyRank health check FAILED:\n- ${failures.join("\n- ")}`;
    log(message);
    await postWebhook(message);
    process.exit(1);
  }

  log("Health check passed");
}

main().catch((error) => {
  log(`Monitor crashed: ${error.message}`);
  process.exit(1);
});
