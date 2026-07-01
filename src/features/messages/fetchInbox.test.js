const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { mapInboxDoc } = require("./fetchInbox");

describe("fetchInbox mapInboxDoc", () => {
  it("maps inbox fields with ISO timestamp", () => {
    const at = new Date("2024-06-01T12:00:00.000Z");
    const entry = mapInboxDoc("conv1", {
      otherUserId: "u2",
      otherDisplayName: "Ada",
      lastMessageText: "Selam",
      unreadCount: 2,
      lastMessageAt: { toDate: () => at },
    });

    assert.equal(entry.conversationId, "conv1");
    assert.equal(entry.otherUserId, "u2");
    assert.equal(entry.lastMessageAt, at.toISOString());
    assert.equal(entry.unreadCount, 2);
  });

  it("clamps negative unread counts to zero", () => {
    const entry = mapInboxDoc("conv1", { unreadCount: -3 });
    assert.equal(entry.unreadCount, 0);
  });
});
