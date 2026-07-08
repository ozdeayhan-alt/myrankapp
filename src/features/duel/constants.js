/**
 * Max net vote delta per post in a single 9s duel match.
 * ~8 taps/sec × 9s — human physical limit; server silently clamps above this.
 */
const MAX_DUEL_DELTA_PER_MATCH =
  Number(process.env.MAX_DUEL_DELTA_PER_MATCH) || 72;

/** Glow posts fetched per duel match query (pool for random pair). */
const DUEL_MATCH_POOL_SIZE =
  Number(process.env.DUEL_MATCH_POOL_SIZE) || 24;

/** Bot Glow posts merged into duel candidate pool. */
const DUEL_BOT_GLOW_POOL_SIZE =
  Number(process.env.DUEL_BOT_GLOW_POOL_SIZE) || 20;

module.exports = {
  MAX_DUEL_DELTA_PER_MATCH,
  DUEL_MATCH_POOL_SIZE,
  DUEL_BOT_GLOW_POOL_SIZE,
};
