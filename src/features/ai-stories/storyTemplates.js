/** @typedef {{ sceneId: string, name: string, type: string, backgroundUrl: string, overlays: string[], colorGrade: string, animationPreset: string }} StoryTemplate */

/** Placeholder backgrounds — replace with CDN assets on myrank.com.tr */
const PLACEHOLDER_VERTICAL =
  "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";

/** @type {Record<string, StoryTemplate>} */
const STORY_TEMPLATES = {
  beach_sunset_chill: {
    sceneId: "beach_sunset_chill",
    name: "Beach Sunset",
    type: "beach",
    backgroundUrl: PLACEHOLDER_VERTICAL,
    overlays: [],
    colorGrade: "warm",
    animationPreset: "slow_zoom",
  },
  neon_city_night: {
    sceneId: "neon_city_night",
    name: "Neon City",
    type: "city",
    backgroundUrl: PLACEHOLDER_VERTICAL,
    overlays: [],
    colorGrade: "cool",
    animationPreset: "parallax",
  },
  rainy_street_walk: {
    sceneId: "rainy_street_walk",
    name: "Rainy Street",
    type: "city",
    backgroundUrl: PLACEHOLDER_VERTICAL,
    overlays: [],
    colorGrade: "muted",
    animationPreset: "fade_in",
  },
  nature_calm: {
    sceneId: "nature_calm",
    name: "Nature Calm",
    type: "nature",
    backgroundUrl: PLACEHOLDER_VERTICAL,
    overlays: [],
    colorGrade: "natural",
    animationPreset: "slow_zoom",
  },
  home_cozy: {
    sceneId: "home_cozy",
    name: "Cozy Home",
    type: "home",
    backgroundUrl: PLACEHOLDER_VERTICAL,
    overlays: [],
    colorGrade: "warm",
    animationPreset: "fade_in",
  },
  default_cinematic: {
    sceneId: "default_cinematic",
    name: "Cinematic",
    type: "default",
    backgroundUrl: PLACEHOLDER_VERTICAL,
    overlays: [],
    colorGrade: "neutral",
    animationPreset: "slow_zoom",
  },
};

function getStoryTemplate(sceneId) {
  return STORY_TEMPLATES[sceneId] ?? STORY_TEMPLATES.default_cinematic;
}

module.exports = {
  STORY_TEMPLATES,
  getStoryTemplate,
};
