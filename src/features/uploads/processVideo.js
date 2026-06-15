const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  transcodeToHls,
  transcodeToFastStartMp4,
  extractPosterJpeg,
  repairMp4Input,
  summarizeFfmpegError,
} = require("../../lib/videoTranscode");
const { validateMp4File } = require("../../lib/mp4Utils");
const {
  downloadObjectToFileWithRetry,
  uploadLocalFile,
  uploadDirectory,
  getObjectDownloadURL,
  getBucketName,
} = require("../../lib/storageMedia");
const {
  buildPublicFirebaseMediaUrl,
  rewriteHlsPlaylistAbsolute,
} = require("../../lib/hlsPlaylist");

function hlsContentType(ext) {
  if (ext === ".m3u8") return "application/vnd.apple.mpegurl";
  if (ext === ".ts") return "video/mp2t";
  return "application/octet-stream";
}

function deriveProcessedPaths(storagePath) {
  const parsed = path.posix.parse(storagePath);
  const baseName = parsed.name;
  const dir = parsed.dir;
  const hlsPrefix = `${dir}/${baseName}_hls`;
  const fastPath = `${dir}/${baseName}_fast.mp4`;
  const posterPath = `${dir}/${baseName}_poster.jpg`;
  return { hlsPrefix, fastPath, posterPath };
}

async function tryExtractPoster(inputPath, outputPath) {
  try {
    await extractPosterJpeg(inputPath, outputPath);
    return fs.existsSync(outputPath);
  } catch (error) {
    console.warn(
      "[processVideoUpload] poster extract failed:",
      summarizeFfmpegError(error.message)
    );
    return false;
  }
}

async function resolvePosterUrl(posterPath, posterLocalPath, bucket) {
  if (fs.existsSync(posterLocalPath)) {
    try {
      return await uploadLocalFile({
        objectPath: posterPath,
        localPath: posterLocalPath,
        contentType: "image/jpeg",
      });
    } catch (error) {
      console.warn("[processVideoUpload] poster upload failed:", error.message);
    }
  }

  return buildPublicFirebaseMediaUrl(bucket, posterPath);
}

async function processVideoUpload(storagePath) {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "myrank-video-"));
  const inputPath = path.join(tmpRoot, "source.mp4");
  const repairedPath = path.join(tmpRoot, "repaired.mp4");
  const hlsDir = path.join(tmpRoot, "hls");
  const fastPath = path.join(tmpRoot, "fast.mp4");
  const posterLocalPath = path.join(tmpRoot, "poster.jpg");

  try {
    await downloadObjectToFileWithRetry(storagePath, inputPath);
    validateMp4File(inputPath);

    const { hlsPrefix, fastPath: remoteFastPath, posterPath } =
      deriveProcessedPaths(storagePath);

    const workingInput = await repairMp4Input(inputPath, repairedPath);

    await transcodeToFastStartMp4(workingInput, fastPath);
    await transcodeToHls(workingInput, hlsDir);

    const bucket = getBucketName();
    const hlsURL = rewriteHlsPlaylistAbsolute(
      path.join(hlsDir, "master.m3u8"),
      hlsPrefix,
      bucket
    );

    let hasPoster = await tryExtractPoster(workingInput, posterLocalPath);
    if (!hasPoster) {
      hasPoster = await tryExtractPoster(fastPath, posterLocalPath);
    }

    const uploaded = await uploadDirectory({
      localDir: hlsDir,
      remotePrefix: hlsPrefix,
      contentTypeForExt: hlsContentType,
    });

    if (!uploaded["master.m3u8"]) {
      throw new Error("HLS playlist upload failed");
    }

    const mediaURL = await uploadLocalFile({
      objectPath: remoteFastPath,
      localPath: fastPath,
      contentType: "video/mp4",
    });

    const posterURL = hasPoster
      ? await resolvePosterUrl(posterPath, posterLocalPath, bucket)
      : undefined;

    return { hlsURL, mediaURL, hlsPrefix, posterURL, skipped: false };
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
}

async function processVideoUploadWithFallback(storagePath) {
  try {
    return await processVideoUpload(storagePath);
  } catch (error) {
    const reason = summarizeFfmpegError(error.message);
    console.warn("[processVideoUpload] fallback to raw upload:", reason);

    const mediaURL = await getObjectDownloadURL(storagePath);

    return {
      skipped: true,
      reason,
      mediaURL,
      hlsURL: undefined,
      posterURL: undefined,
      hlsPrefix: undefined,
    };
  }
}

module.exports = {
  processVideoUpload,
  processVideoUploadWithFallback,
};
