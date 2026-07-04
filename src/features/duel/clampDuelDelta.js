const { MAX_DUEL_DELTA_PER_MATCH } = require("./constants");

function clampDuelDelta(rawDelta) {
  if (!Number.isFinite(rawDelta) || rawDelta === 0) {
    return 0;
  }
  const sign = rawDelta > 0 ? 1 : -1;
  const magnitude = Math.min(Math.abs(rawDelta), MAX_DUEL_DELTA_PER_MATCH);
  return sign * magnitude;
}

module.exports = { clampDuelDelta };
