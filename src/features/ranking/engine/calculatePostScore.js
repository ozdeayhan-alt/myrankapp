const {
  SHARE_POINTS,
  SAVE_POINTS,
  COMMENT_POINTS,
} = require("../../../config/scoring");

/**
 * Post Score = (likes - dislikes) + (shares × 66) + (saves × 66) + (comments × 33)
 */
function calculatePostScore({
  likeCount = 0,
  dislikeCount = 0,
  shareCount = 0,
  saveCount = 0,
  commentCount = 0,
  likeBonusTotal = 0,
  dislikeBonusTotal = 0,
}) {
  return (
    likeCount -
    dislikeCount +
    likeBonusTotal -
    dislikeBonusTotal +
    shareCount * SHARE_POINTS +
    saveCount * SAVE_POINTS +
    commentCount * COMMENT_POINTS
  );
}

module.exports = { calculatePostScore };
