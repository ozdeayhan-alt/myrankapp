const { applyInteraction } = require("../ranking/engine/applyInteraction");
const { applyPostVoteBatch } = require("../ranking/engine/applyPostVoteBatch");
const { applyProfileVoteBatch } = require("../ranking/engine/applyProfileVoteBatch");
const { afterAuthorScoreChange } = require("../ranking/rankingScoreSync");
const {
  notifyPostVotes,
  notifyProfileVotes,
} = require("../notifications/createNotification");
const { isBotAccount } = require("./botUserService");
const { randomInt } = require("./botUtils");

async function botLikePost({ botId, postId, notify = true, delta = 1 }) {
  const result = await applyPostVoteBatch({
    postId,
    actorId: botId,
    delta,
  });

  afterAuthorScoreChange(result.authorId, result.scoreDelta);

  if (notify && result.authorId && result.authorId !== botId && delta > 0) {
    const targetIsBot = await isBotAccount(result.authorId);
    if (!targetIsBot) {
      void notifyPostVotes({
        authorId: result.authorId,
        actorId: botId,
        postId,
        delta,
      }).catch((err) => {
        console.error("[bot-like-notify]", err.message ?? err);
      });
    }
  }

  return result;
}

async function botLikeBonus99({ botId, postId }) {
  return botLikePost({ botId, postId, notify: false, delta: 99 });
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

  afterAuthorScoreChange(targetUserId, result.scoreDelta);

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
