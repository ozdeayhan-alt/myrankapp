class VoteError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "VoteError";
    this.status = status;
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

module.exports = { VoteError, mapVoteError };
