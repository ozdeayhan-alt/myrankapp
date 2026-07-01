const test = require("node:test");
const assert = require("node:assert/strict");
const {
  isMessageStoragePath,
  parseStorageObjectPath,
} = require("./signMessageMedia");

test("parseStorageObjectPath reads Firebase download URL", () => {
  const url =
    "https://firebasestorage.googleapis.com/v0/b/bucket/o/messages%2Fuid%2Ffile.jpg?alt=media&token=abc";
  assert.equal(parseStorageObjectPath(url), "messages/uid/file.jpg");
});

test("isMessageStoragePath detects message objects", () => {
  assert.equal(
    isMessageStoragePath(
      "https://firebasestorage.googleapis.com/v0/b/bucket/o/messages%2Fu%2Fx.jpg?alt=media"
    ),
    true
  );
  assert.equal(
    isMessageStoragePath(
      "https://firebasestorage.googleapis.com/v0/b/bucket/o/posts%2Fu%2Fx.jpg?alt=media"
    ),
    false
  );
});
