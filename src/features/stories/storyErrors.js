class StoryError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "StoryError";
    this.status = status;
  }
}

module.exports = {
  StoryError,
};
