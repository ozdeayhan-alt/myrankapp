/** Manifesto puanlama sabitleri — PROJECT_MANIFEST.md */

const SHARE_POINTS = 66;
const SAVE_POINTS = 66;
const COMMENT_POINTS = 33;

/** Basılı tut beğeni bonus seçenekleri */
const LIKE_BONUS_TIERS = [33, 66, 99];

const INTERACTION_TYPES = ["like", "dislike", "share", "comment", "save"];

module.exports = {
  SHARE_POINTS,
  SAVE_POINTS,
  COMMENT_POINTS,
  LIKE_BONUS_TIERS,
  INTERACTION_TYPES,
};
