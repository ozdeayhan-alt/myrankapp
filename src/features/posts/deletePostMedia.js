const path = require("path");
const { parseFirebaseStorageUrl } = require("./parseFirebaseStorageUrl");
const {
  deleteObject,
  deleteObjectsByPrefix,
} = require("../../lib/storageMedia");

function collectPostStorageTargets(post) {
  const paths = new Set();
  const prefixes = new Set();

  for (const url of [post.mediaURL, post.hlsURL, post.posterURL]) {
    const objectPath = parseFirebaseStorageUrl(url);
    if (!objectPath) {
      continue;
    }

    if (objectPath.includes("_hls/")) {
      const idx = objectPath.indexOf("_hls/");
      prefixes.add(objectPath.slice(0, idx + 5));
      continue;
    }

    paths.add(objectPath);

    const dir = path.posix.dirname(objectPath);
    const file = path.posix.basename(objectPath);
    const stampMatch = file.match(/^(\d+)/);
    if (!stampMatch) {
      continue;
    }

    const stamp = stampMatch[1];
    paths.add(`${dir}/${stamp}.mp4`);
    paths.add(`${dir}/${stamp}.mov`);
    paths.add(`${dir}/${stamp}_fast.mp4`);
    paths.add(`${dir}/${stamp}_poster.jpg`);
    prefixes.add(`${dir}/${stamp}_hls/`);
  }

  return { paths, prefixes };
}

async function deletePostMedia(post) {
  const { paths, prefixes } = collectPostStorageTargets(post);

  await Promise.all([
    ...[...paths].map((objectPath) => deleteObject(objectPath)),
    ...[...prefixes].map((prefix) => deleteObjectsByPrefix(prefix)),
  ]);
}

module.exports = { deletePostMedia, collectPostStorageTargets };
