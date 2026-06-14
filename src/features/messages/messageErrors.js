class MessageError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "MessageError";
    this.status = status;
  }
}

function mapMessageError(error, res) {
  if (error instanceof MessageError) {
    return res.status(error.status).json({ error: error.message });
  }

  console.error("[messages]", error);
  return res.status(500).json({
    error: error.message ?? "Mesaj işlemi başarısız",
  });
}

module.exports = { MessageError, mapMessageError };
