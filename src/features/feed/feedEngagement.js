const { getBatchEngagementStatus } = require("../ranking/engine/applyInteraction");

async function attachEngagementsToFeedPage(viewerId, page) {
  if (!viewerId || !page?.posts?.length) {
    return page;
  }

  const postIds = page.posts.map((post) => post.id).filter(Boolean);
  const engagements = await getBatchEngagementStatus({
    postIds,
    actorId: viewerId,
  });

  return {
    ...page,
    engagements,
  };
}

module.exports = {
  attachEngagementsToFeedPage,
};
