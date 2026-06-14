class PostError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "PostError";
    this.status = status;
  }
}

function mapPostError(error, res) {
  if (error instanceof PostError) {
    return res.status(error.status).json({ error: error.message });
  }

  console.error("[posts]", error);
  return res.status(500).json({
    error: error.message ?? "Post işlemi başarısız",
  });
}

module.exports = { PostError, mapPostError };
