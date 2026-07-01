/**
 * Story score = likeCount - dislikeCount (vote taps only).
 */
function calculateStoryScore({ likeCount = 0, dislikeCount = 0 }) {
  return likeCount - dislikeCount;
}

module.exports = { calculateStoryScore };
