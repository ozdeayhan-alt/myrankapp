const { BOT_UID_SET } = require("./botPersonas");
const { CHARACTER_UID_SET } = require("./characterPersonas");
const { isSegmentBotUserId } = require("./segmentBotPersonas");

function randomInt(min, max) {
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

function isCharacterBotUserId(userId) {
  return CHARACTER_UID_SET.has(userId);
}

function isBotUserId(userId) {
  return (
    BOT_UID_SET.has(userId) ||
    CHARACTER_UID_SET.has(userId) ||
    isSegmentBotUserId(userId)
  );
}

function daysBetween(a, b) {
  const ms = Math.abs(a.getTime() - b.getTime());
  return ms / (1000 * 60 * 60 * 24);
}

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value === "object" && typeof value.seconds === "number") {
    return new Date(value.seconds * 1000);
  }
  return null;
}

module.exports = {
  randomInt,
  isBotUserId,
  isCharacterBotUserId,
  daysBetween,
  toDate,
};
