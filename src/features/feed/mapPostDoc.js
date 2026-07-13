function parsePostMetadata(data) {
  const metadata = data?.metadata;
  if (!metadata || typeof metadata !== "object") {
    return undefined;
  }
  return {
    country: String(metadata.country ?? ""),
    city: String(metadata.city ?? ""),
    gender: String(metadata.gender ?? ""),
    age: typeof metadata.age === "number" ? metadata.age : null,
    profession: String(metadata.profession ?? ""),
    maritalStatus: String(metadata.maritalStatus ?? ""),
  };
}

function mapPostDoc(id, data) {
  return {
    id,
    authorId: String(data.authorId ?? ""),
    authorDisplayName: data.authorDisplayName
      ? String(data.authorDisplayName)
      : undefined,
    authorPhotoURL: data.authorPhotoURL
      ? String(data.authorPhotoURL)
      : undefined,
    segmentKey: data.segmentKey ? String(data.segmentKey) : undefined,
    metadata: parsePostMetadata(data),
    postScore: typeof data.postScore === "number" ? data.postScore : 0,
    likeCount: typeof data.likeCount === "number" ? data.likeCount : 0,
    likeBonusTotal:
      typeof data.likeBonusTotal === "number" ? data.likeBonusTotal : 0,
    dislikeBonusTotal:
      typeof data.dislikeBonusTotal === "number" ? data.dislikeBonusTotal : 0,
    dislikeCount: typeof data.dislikeCount === "number" ? data.dislikeCount : 0,
    shareCount: typeof data.shareCount === "number" ? data.shareCount : 0,
    saveCount: typeof data.saveCount === "number" ? data.saveCount : 0,
    commentCount: typeof data.commentCount === "number" ? data.commentCount : 0,
    contentType: data.contentType,
    originalPostId: data.originalPostId
      ? String(data.originalPostId)
      : undefined,
    repostCaption: data.repostCaption ? String(data.repostCaption) : undefined,
    originalSnapshot:
      data.originalSnapshot && typeof data.originalSnapshot === "object"
        ? {
            authorId: String(data.originalSnapshot.authorId ?? ""),
            authorDisplayName: data.originalSnapshot.authorDisplayName
              ? String(data.originalSnapshot.authorDisplayName)
              : undefined,
            authorPhotoURL: data.originalSnapshot.authorPhotoURL
              ? String(data.originalSnapshot.authorPhotoURL)
              : undefined,
            contentType: data.originalSnapshot.contentType,
            content: data.originalSnapshot.content
              ? String(data.originalSnapshot.content)
              : undefined,
            mediaURL: data.originalSnapshot.mediaURL
              ? String(data.originalSnapshot.mediaURL)
              : undefined,
            hlsURL: data.originalSnapshot.hlsURL
              ? String(data.originalSnapshot.hlsURL)
              : undefined,
            posterURL: data.originalSnapshot.posterURL
              ? String(data.originalSnapshot.posterURL)
              : undefined,
            mediaWidth:
              typeof data.originalSnapshot.mediaWidth === "number"
                ? data.originalSnapshot.mediaWidth
                : undefined,
            mediaHeight:
              typeof data.originalSnapshot.mediaHeight === "number"
                ? data.originalSnapshot.mediaHeight
                : undefined,
          }
        : undefined,
    content: data.content ? String(data.content) : undefined,
    linkUrl: data.linkUrl ? String(data.linkUrl) : undefined,
    linkTitle: data.linkTitle ? String(data.linkTitle) : undefined,
    linkDescription: data.linkDescription
      ? String(data.linkDescription)
      : undefined,
    linkImageUrl: data.linkImageUrl ? String(data.linkImageUrl) : undefined,
    mediaURL: data.mediaURL ? String(data.mediaURL) : undefined,
    hlsURL: data.hlsURL ? String(data.hlsURL) : undefined,
    posterURL: data.posterURL ? String(data.posterURL) : undefined,
    mediaWidth:
      typeof data.mediaWidth === "number" ? data.mediaWidth : undefined,
    mediaHeight:
      typeof data.mediaHeight === "number" ? data.mediaHeight : undefined,
    provider: data.provider ? String(data.provider) : undefined,
    providerUrl: data.providerUrl ? String(data.providerUrl) : undefined,
    providerVideoId: data.providerVideoId
      ? String(data.providerVideoId)
      : undefined,
    thumbnailUrl: data.thumbnailUrl ? String(data.thumbnailUrl) : undefined,
    title: data.title ? String(data.title) : undefined,
    duration:
      typeof data.duration === "number" ? data.duration : undefined,
    createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? undefined,
  };
}

module.exports = { mapPostDoc };
