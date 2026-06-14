class FollowError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "FollowError";
    this.status = status;
  }
}

function mapFollowError(error, res) {
  if (error instanceof FollowError) {
    return res.status(error.status).json({ error: error.message });
  }

  console.error("[follows]", error);
  return res.status(500).json({
    error: error.message ?? "Takip işlemi başarısız",
  });
}

module.exports = { FollowError, mapFollowError };
