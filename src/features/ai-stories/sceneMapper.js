const { getStoryTemplate } = require("./storyTemplates");

/**
 * Deterministic scene selection from chip keys (MVP — no LLM).
 * @param {{ moodKey: string, locationKey: string, actionKey: string }} input
 * @returns {string} sceneId
 */
function selectSceneId({ moodKey, locationKey, actionKey }) {
  if (moodKey === "peaceful" && locationKey === "beach") {
    return "beach_sunset_chill";
  }
  if (moodKey === "cool" && locationKey === "city_night") {
    return "neon_city_night";
  }
  if (moodKey === "stressed") {
    return "rainy_street_walk";
  }
  if (moodKey === "peaceful" && locationKey === "nature") {
    return "nature_calm";
  }
  if (locationKey === "home" || actionKey === "relaxing") {
    return "home_cozy";
  }
  if (moodKey === "energetic" && actionKey === "exercising") {
    return "nature_calm";
  }
  if (locationKey === "city_night") {
    return "neon_city_night";
  }
  if (locationKey === "beach") {
    return "beach_sunset_chill";
  }

  return "default_cinematic";
}

/**
 * @param {{ moodKey: string, locationKey: string, actionKey: string }} input
 */
function resolveStoryScene(input) {
  const sceneId = selectSceneId(input);
  return {
    sceneId,
    template: getStoryTemplate(sceneId),
  };
}

module.exports = {
  selectSceneId,
  resolveStoryScene,
};
