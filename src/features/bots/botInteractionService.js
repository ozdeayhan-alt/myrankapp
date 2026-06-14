const { applyInteraction } = require("../ranking/engine/applyInteraction");
const { applyLikeBonus } = require("../ranking/engine/applyLikeBonus");
const { applyProfileVoteBatch } = require("../ranking/engine/applyProfileVoteBatch");
const {
  notifyPostInteraction,
  notifyProfileVotes,
} = require("../notifications/createNotification");
const { isBotAccount } = require("./botUserService");
const { randomInt } = require("./botUtils");

async function botLikePost({ botId, postId, notify = true }) {
  const result = await applyInteraction({
    postId,
    actorId: botId,
    type: "like",
  });

  if (notify && result.authorId && result.authorId !== botId) {
    const targetIsBot = await isBotAccount(result.authorId);
    if (!targetIsBot) {
      void notifyPostInteraction({
        authorId: result.authorId,
        actorId: botId,
        postId,
        type: "like",
      }).catch((err) => {
        console.error("[bot-like-notify]", err.message ?? err);
      });
    }
  }

  return result;
}

async function botLikeBonus99({ botId, postId }) {
  return applyLikeBonus({
    postId,
    actorId: botId,
    bonusPoints: 99,
  });
}

async function botProfileBoost({ botId, targetUserId, notify = true }) {
  if (botId === targetUserId) {
    return null;
  }

  const targetIsBot = await isBotAccount(targetUserId);
  if (targetIsBot) {
    return null;
  }

  const delta = randomInt(1, 50);
  const result = await applyProfileVoteBatch({
    actorId: botId,
    targetUserId,
    delta,
  });

  if (notify && delta > 0) {
    void notifyProfileVotes({
      targetUserId,
      actorId: botId,
      delta,
    }).catch((err) => {
      console.error("[bot-boost-notify]", err.message ?? err);
    });
  }

  return { ...result, delta };
}

module.exports = {
  botLikePost,
  botLikeBonus99,
  botProfileBoost,
};
