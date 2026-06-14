function buildConversationId(userIdA, userIdB) {
  if (!userIdA || !userIdB || userIdA === userIdB) {
    throw new Error("Invalid participant ids");
  }
  return userIdA < userIdB ? `${userIdA}_${userIdB}` : `${userIdB}_${userIdA}`;
}

function getOtherParticipantId(conversationId, userId) {
  const [a, b] = conversationId.split("_");
  if (a === userId) return b;
  if (b === userId) return a;
  return null;
}

module.exports = { buildConversationId, getOtherParticipantId };
