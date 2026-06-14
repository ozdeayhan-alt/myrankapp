class BlockError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "BlockError";
    this.status = status;
  }
}

function mapBlockError(error, res) {
  if (error instanceof BlockError) {
    return res.status(error.status).json({ ok: false, error: error.message });
  }

  return res.status(500).json({
    ok: false,
    error: error.message ?? "İşlem başarısız",
  });
}

module.exports = { BlockError, mapBlockError };
