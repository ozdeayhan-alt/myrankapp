function buildBlockId(blockerId, blockedUserId) {
  return `${blockerId}_${blockedUserId}`;
}

module.exports = { buildBlockId };
