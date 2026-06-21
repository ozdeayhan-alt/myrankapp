const MOOD_KEYS = new Set([
  "peaceful",
  "energetic",
  "stressed",
  "cool",
  "romantic",
  "focused",
]);

const LOCATION_KEYS = new Set([
  "beach",
  "city_night",
  "nature",
  "home",
  "cafe",
  "gym",
]);

const ACTION_KEYS = new Set([
  "walking",
  "relaxing",
  "having_fun",
  "working",
  "traveling",
  "exercising",
]);

const CAPTION_MAX_LENGTH = 40;

module.exports = {
  MOOD_KEYS,
  LOCATION_KEYS,
  ACTION_KEYS,
  CAPTION_MAX_LENGTH,
};
