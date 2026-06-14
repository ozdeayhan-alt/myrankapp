const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const FFMPEG_BIN = process.env.FFMPEG_PATH || "ffmpeg";

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(FFMPEG_BIN, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";

    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr.trim() || `ffmpeg exited with code ${code}`));
    });
  });
}

/**
 * Reels için HLS (2 sn segment, 720p ~1.8 Mbps).
 */
async function transcodeToHls(inputPath, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });

  const playlistPath = path.join(outputDir, "master.m3u8");
  const segmentPattern = path.join(outputDir, "seg_%03d.ts");

  await runFfmpeg([
    "-y",
    "-i",
    inputPath,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-profile:v",
    "main",
    "-vf",
    "scale='min(720,iw)':-2",
    "-b:v",
    "1800k",
    "-maxrate",
    "2000k",
    "-bufsize",
    "4000k",
    "-g",
    "48",
    "-keyint_min",
    "48",
    "-sc_threshold",
    "0",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-ac",
    "2",
    "-f",
    "hls",
    "-hls_time",
    "1",
    "-hls_list_size",
    "0",
    "-hls_segment_type",
    "mpegts",
    "-hls_segment_filename",
    segmentPattern,
    playlistPath,
  ]);

  return playlistPath;
}

/**
 * Progressive MP4 fast-start (moov başta) — HLS yoksa hızlı başlangıç.
 */
async function transcodeToFastStartMp4(inputPath, outputPath) {
  await runFfmpeg([
    "-y",
    "-i",
    inputPath,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-profile:v",
    "main",
    "-vf",
    "scale='min(720,iw)':-2",
    "-b:v",
    "1800k",
    "-maxrate",
    "2000k",
    "-bufsize",
    "4000k",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    outputPath,
  ]);

  return outputPath;
}

/**
 * Feed önizlemesi için JPEG kapak (0.5 sn).
 */
async function extractPosterJpeg(inputPath, outputPath) {
  await runFfmpeg([
    "-y",
    "-ss",
    "0.5",
    "-i",
    inputPath,
    "-frames:v",
    "1",
    "-q:v",
    "3",
    "-vf",
    "scale='min(720,iw)':-2",
    outputPath,
  ]);

  return outputPath;
}

/**
 * Bozuk / moov-sonda MP4'ü onarır; başarısızsa yeniden encode dener.
 */
async function repairMp4Input(inputPath, outputPath) {
  try {
    await runFfmpeg([
      "-y",
      "-fflags",
      "+genpts",
      "-i",
      inputPath,
      "-c",
      "copy",
      "-movflags",
      "+faststart",
      outputPath,
    ]);
    return outputPath;
  } catch (copyError) {
    await runFfmpeg([
      "-y",
      "-err_detect",
      "ignore_err",
      "-i",
      inputPath,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-profile:v",
      "main",
      "-vf",
      "scale='min(720,iw)':-2",
      "-b:v",
      "1800k",
      "-maxrate",
      "2000k",
      "-bufsize",
      "4000k",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      outputPath,
    ]);
    return outputPath;
  }
}

function summarizeFfmpegError(message) {
  if (!message) return "Video işleme başarısız";
  if (message.includes("moov atom not found")) {
    return "Yüklenen video dosyası bozuk veya eksik (moov atomu yok)";
  }
  const lines = message
    .split("\n")
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.startsWith("Error") ||
        line.includes("Invalid data") ||
        line.includes("No such file")
    );
  return lines[lines.length - 1] || "Video işleme başarısız";
}

module.exports = {
  transcodeToHls,
  transcodeToFastStartMp4,
  extractPosterJpeg,
  repairMp4Input,
  summarizeFfmpegError,
};
