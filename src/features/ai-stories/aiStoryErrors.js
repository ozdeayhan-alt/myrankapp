class AiStoryError extends Error {
  /** @param {number} status */
  constructor(status, message) {
    super(message);
    this.name = "AiStoryError";
    this.status = status;
  }
}

module.exports = {
  AiStoryError,
};
