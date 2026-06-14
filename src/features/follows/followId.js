function buildFollowId(followerId, targetUserId) {
  return `${followerId}_${targetUserId}`;
}

module.exports = { buildFollowId };
