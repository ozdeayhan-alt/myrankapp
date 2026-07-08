const { CHARACTER_CONTENT_TYPES, CHARACTER_SOURCE_KINDS } = require("./characterContentTypes");
const { TWEET_MAX_LENGTH } = require("../posts/updatePostContent");
const { getCharacterPersonaByUid } = require("./characterPersonas");
const {
  pickEvergreenPrompt,
  pickFunPrompt,
  pickSpotlightPrompt,
} = require("./characterEvergreenBank");
const { fetchNewsForPersona } = require("./characterNewsIngest");
const { filterUnseenNewsItems, markNewsSeen, passesTitleOverlapGate } = require("./characterNewsStore");
const { pickBestNewsItem } = require("./characterNewsRank");
const { buildTemplateWhisp, buildNewsTemplateWhisp } = require("./characterTemplates");
const { rewriteWithAi } = require("./characterVoiceRewrite");
const { createBotPost } = require("./botPostService");

function pickContentTypeForNormalSlot() {
  const roll = Math.random();
  if (roll < 0.6) {
    return CHARACTER_CONTENT_TYPES.NEWS;
  }
  if (roll < 0.85) {
    return CHARACTER_CONTENT_TYPES.EVERGREEN;
  }
  return CHARACTER_CONTENT_TYPES.FUN;
}

function passesWhispGate(text, sourceTitle = "") {
  const trimmed = String(text ?? "").trim();
  if (!trimmed || trimmed.length > TWEET_MAX_LENGTH) {
    return false;
  }
  if (!trimmed.includes("?")) {
    return false;
  }
  if (/https?:\/\//i.test(trimmed)) {
    return false;
  }
  if (/kaynak:|haberin özeti|son dakika/i.test(trimmed)) {
    return false;
  }
  if (sourceTitle && !passesTitleOverlapGate(trimmed, sourceTitle)) {
    return false;
  }
  return true;
}

async function resolveNewsSeed(persona) {
  const rawItems = await fetchNewsForPersona(persona);
  const unseen = await filterUnseenNewsItems(rawItems);
  if (unseen.length === 0) {
    return null;
  }
  return pickBestNewsItem(unseen, persona);
}

async function buildWhispText({ persona, contentType, slotType }) {
  let resolvedType = contentType;
  if (slotType === "spotlight") {
    resolvedType = CHARACTER_CONTENT_TYPES.SPOTLIGHT;
  } else if (!resolvedType) {
    resolvedType = pickContentTypeForNormalSlot();
  }

  let seedText = null;
  let newsItem = null;
  let source = { kind: CHARACTER_SOURCE_KINDS.BANK, refId: null };

  if (resolvedType === CHARACTER_CONTENT_TYPES.SPOTLIGHT) {
    seedText = pickSpotlightPrompt();
    source = { kind: CHARACTER_SOURCE_KINDS.BANK, refId: "spotlight" };
  } else if (resolvedType === CHARACTER_CONTENT_TYPES.EVERGREEN) {
    seedText = pickEvergreenPrompt(persona.uid);
    source = { kind: CHARACTER_SOURCE_KINDS.BANK, refId: "evergreen" };
  } else if (resolvedType === CHARACTER_CONTENT_TYPES.FUN) {
    seedText = pickFunPrompt(persona.uid);
    source = { kind: CHARACTER_SOURCE_KINDS.BANK, refId: "fun" };
  } else {
    newsItem = await resolveNewsSeed(persona);
    if (!newsItem) {
      resolvedType = CHARACTER_CONTENT_TYPES.EVERGREEN;
      seedText = pickEvergreenPrompt(persona.uid);
      source = { kind: CHARACTER_SOURCE_KINDS.BANK, refId: "evergreen-fallback" };
    } else {
      source = {
        kind: CHARACTER_SOURCE_KINDS.RSS,
        refId: newsItem.hash,
        feedLabel: newsItem.feedLabel,
      };
    }
  }

  let text = null;
  try {
    text = await rewriteWithAi({
      persona,
      contentType: resolvedType,
      seedText,
      newsItem,
    });
    if (text) {
      source = { ...source, kind: CHARACTER_SOURCE_KINDS.AI };
    }
  } catch (error) {
    console.warn(
      `[characterCompose] AI failed for ${persona.uid}:`,
      error.message ?? error
    );
  }

  if (!text) {
    if (newsItem) {
      text = buildNewsTemplateWhisp(persona, newsItem.title);
      source = { ...source, kind: CHARACTER_SOURCE_KINDS.TEMPLATE };
    } else {
      text = buildTemplateWhisp(persona, resolvedType, seedText);
      source = { ...source, kind: CHARACTER_SOURCE_KINDS.TEMPLATE };
    }
  }

  if (!passesWhispGate(text, newsItem?.title ?? "")) {
    if (newsItem) {
      text = buildNewsTemplateWhisp(persona, newsItem.title);
    } else {
      text = buildTemplateWhisp(persona, resolvedType, seedText);
    }
    source = { ...source, kind: CHARACTER_SOURCE_KINDS.TEMPLATE };
  }

  return {
    text: String(text).trim().slice(0, TWEET_MAX_LENGTH),
    contentType: resolvedType,
    source,
    newsItem,
  };
}

async function composeAndPublishCharacterWhisp({
  characterUid,
  slotType = "normal",
  contentType = null,
}) {
  const persona = getCharacterPersonaByUid(characterUid);
  if (!persona) {
    throw new Error(`Unknown character: ${characterUid}`);
  }

  const composed = await buildWhispText({
    persona,
    contentType,
    slotType,
  });

  const postId = await createBotPost({
    authorId: persona.uid,
    contentType: "tweet",
    content: composed.text,
  });

  if (composed.newsItem?.hash) {
    await markNewsSeen({
      hash: composed.newsItem.hash,
      url: composed.newsItem.url,
      title: composed.newsItem.title,
      characterUid: persona.uid,
      postId,
      feedLabel: composed.newsItem.feedLabel,
    });
  }

  return {
    postId,
    characterUid,
    contentType: composed.contentType,
    source: composed.source,
    text: composed.text,
  };
}

module.exports = {
  pickContentTypeForNormalSlot,
  passesWhispGate,
  buildWhispText,
  composeAndPublishCharacterWhisp,
};
