class VoteError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "VoteError";
    this.status = status;
  }
}

function assertNotSelfVote(actorId, targetId) {
  if (actorId && targetId && actorId === targetId) {
    throw new VoteError(403, "Kendi içeriğinize oy veremezsiniz");
  }
}

function mapVoteError(error, res, fallbackMessage) {
  if (error instanceof VoteError) {
    return res.status(error.status).json({ error: error.message });
  }

  console.error("[votes]", error);
  return res.status(500).json({
    error: error.message ?? fallbackMessage,
  });
}

module.exports = { VoteError, assertNotSelfVote, mapVoteError };
