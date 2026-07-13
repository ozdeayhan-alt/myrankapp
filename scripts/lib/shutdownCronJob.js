/**
 * Cron job scripts must exit cleanly so Node does not accumulate under crontab.
 * Closes Redis (if opened via feed cache / job queue) and Firebase Admin apps.
 */
async function shutdownCronJobResources() {
  try {
    const { closeRedis } = require("../../src/lib/redis");
    await closeRedis();
  } catch (error) {
    console.warn(
      "[cron-shutdown] redis close skipped:",
      error.message ?? error
    );
  }

  try {
    const admin = require("../../firebase-config");
    const apps = admin.apps.filter(Boolean);
    await Promise.all(
      apps.map((app) =>
        app.delete().catch((error) => {
          console.warn(
            "[cron-shutdown] firebase app delete:",
            error.message ?? error
          );
        })
      )
    );
  } catch (error) {
    console.warn(
      "[cron-shutdown] firebase shutdown skipped:",
      error.message ?? error
    );
  }
}

/**
 * Runs a cron main function and ensures resources are released before exit.
 */
async function runCronJobScript(label, mainFn) {
  try {
    await mainFn();
    await shutdownCronJobResources();
    process.exit(0);
  } catch (error) {
    console.error(`[${label}] Failed:`, error);
    try {
      await shutdownCronJobResources();
    } catch (_) {
      /* best effort */
    }
    process.exit(1);
  }
}

module.exports = {
  shutdownCronJobResources,
  runCronJobScript,
};
