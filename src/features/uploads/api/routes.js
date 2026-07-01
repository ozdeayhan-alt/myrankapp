const express = require("express");
const { verifyAuth } = require("../../../lib/verifyAuth");
const { uploadRateLimit } = require("../../../lib/rateLimit");
const {
  uploadBuffer,
  createSignedUploadUrl,
  finalizeUploadedObject,
} = require("../../../lib/storageGcs");
const {
  isAllowedStoragePath,
  normalizeStoragePath,
  isAllowedContentType,
  validateContentLength,
} = require("../uploadPathUtils");
const { processVideoUploadWithFallback } = require("../processVideo");
const { createVideoJob, readVideoJob } = require("../videoJobStore");
const { enqueueProcessVideo } = require("../../../lib/jobQueue");
const { getRedisClient, isRedisRequired } = require("../../../lib/redis");

const router = express.Router();

const STORAGE_BUCKET =
  process.env.FIREBASE_STORAGE_BUCKET ||
  "myrankapp-d62b9.firebasestorage.app";

const MAX_BASE64_LENGTH = 20 * 1024 * 1024;

router.post("/uploads/sign", verifyAuth, uploadRateLimit, async (req, res) => {
  try {
    const { storagePath, contentType, contentLength } = req.body;

    if (!storagePath || !contentType) {
      return res.status(400).json({
        error: "storagePath and contentType are required",
      });
    }

    const normalizedContentType = String(contentType).trim().toLowerCase();

    if (!isAllowedContentType(normalizedContentType)) {
      return res.status(400).json({ error: "Unsupported content type" });
    }

    const lengthError = validateContentLength(
      normalizedContentType,
      contentLength
    );
    if (lengthError) {
      return res.status(400).json({ error: lengthError });
    }

    const normalizedPath = normalizeStoragePath(storagePath);

    if (!isAllowedStoragePath(normalizedPath, req.user.uid)) {
      return res.status(403).json({
        error:
          "storagePath must be under posts/{uid}/, profiles/{uid}/, messages/{uid}/ or stories/{uid}/",
      });
    }

    const signed = await createSignedUploadUrl({
      bucket: STORAGE_BUCKET,
      objectPath: normalizedPath,
      contentType: normalizedContentType,
    });

    res.json({
      ok: true,
      ...signed,
    });
  } catch (error) {
    console.error("[uploads/sign]", error);
    res.status(500).json({
      error: error.message ?? "Signed URL generation failed",
    });
  }
});

router.post("/uploads/finalize", verifyAuth, uploadRateLimit, async (req, res) => {
  try {
    const { storagePath, contentType } = req.body;

    if (!storagePath || !contentType) {
      return res.status(400).json({
        error: "storagePath and contentType are required",
      });
    }

    const normalizedContentType = String(contentType).trim().toLowerCase();

    if (!isAllowedContentType(normalizedContentType)) {
      return res.status(400).json({ error: "Unsupported content type" });
    }

    const normalizedPath = normalizeStoragePath(storagePath);

    if (!isAllowedStoragePath(normalizedPath, req.user.uid)) {
      return res.status(403).json({
        error:
          "storagePath must be under posts/{uid}/, profiles/{uid}/, messages/{uid}/ or stories/{uid}/",
      });
    }

    const result = await finalizeUploadedObject({
      bucket: STORAGE_BUCKET,
      objectPath: normalizedPath,
      contentType: normalizedContentType,
    });

    res.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    console.error("[uploads/finalize]", error);
    res.status(500).json({
      error: error.message ?? "Upload finalize failed",
    });
  }
});

router.post(
  "/uploads/process-video",
  verifyAuth,
  uploadRateLimit,
  async (req, res) => {
    try {
      const { storagePath } = req.body;

      if (!storagePath || typeof storagePath !== "string") {
        return res.status(400).json({ error: "storagePath is required" });
      }

      const normalizedPath = normalizeStoragePath(storagePath);

      if (!isAllowedStoragePath(normalizedPath, req.user.uid)) {
        return res.status(403).json({
          error:
            "storagePath must be under posts/{uid}/, profiles/{uid}/, messages/{uid}/ or stories/{uid}/",
        });
      }

      if (!normalizedPath.endsWith(".mp4")) {
        return res.status(400).json({ error: "Only .mp4 videos can be processed" });
      }

      const redis = await getRedisClient();
      if (!redis) {
        if (isRedisRequired()) {
          return res.status(503).json({
            error:
              "Video işleme geçici olarak kullanılamıyor. Lütfen biraz sonra tekrar deneyin.",
          });
        }

        const result = await processVideoUploadWithFallback(normalizedPath);
        return res.json({
          ok: true,
          skipped: Boolean(result.skipped),
          reason: result.reason,
          hlsURL: result.hlsURL,
          mediaURL: result.mediaURL,
          posterURL: result.posterURL,
          hlsPrefix: result.hlsPrefix,
        });
      }

      const job = await createVideoJob({
        userId: req.user.uid,
        storagePath: normalizedPath,
      });

      await enqueueProcessVideo({
        jobId: job.jobId,
        storagePath: normalizedPath,
        userId: req.user.uid,
      });

      return res.status(202).json({
        ok: true,
        jobId: job.jobId,
        status: "pending",
      });
    } catch (error) {
      console.error("[uploads/process-video]", error);
      res.status(500).json({
        error: error.message ?? "Video processing failed",
      });
    }
  }
);

router.get(
  "/uploads/process-video/:jobId",
  verifyAuth,
  uploadRateLimit,
  async (req, res) => {
    try {
      const job = await readVideoJob(req.params.jobId);
      if (!job || job.userId !== req.user.uid) {
        return res.status(404).json({ error: "Job not found" });
      }

      if (job.status === "complete" && job.result) {
        return res.json({
          ok: true,
          status: "complete",
          skipped: Boolean(job.result.skipped),
          reason: job.result.reason,
          hlsURL: job.result.hlsURL,
          mediaURL: job.result.mediaURL,
          posterURL: job.result.posterURL,
          hlsPrefix: job.result.hlsPrefix,
        });
      }

      if (job.status === "failed") {
        return res.status(500).json({
          ok: false,
          status: "failed",
          error: job.error ?? "Video processing failed",
        });
      }

      return res.json({
        ok: true,
        status: "pending",
        jobId: job.jobId,
      });
    } catch (error) {
      console.error("[uploads/process-video/status]", error);
      res.status(500).json({
        error: error.message ?? "Video job status failed",
      });
    }
  }
);

/** @deprecated İstemci signed URL kullanmalı. Geriye dönük uyumluluk. */
router.post("/uploads", verifyAuth, uploadRateLimit, async (req, res) => {
  if (process.env.ALLOW_DEPRECATED_BASE64_UPLOADS !== "true") {
    return res.status(410).json({
      error:
        "Deprecated upload endpoint disabled. Use POST /api/uploads/sign instead.",
    });
  }

  console.warn(
    "[uploads] Deprecated base64 proxy upload — migrate client to POST /uploads/sign"
  );
  res.set("Deprecation", "true");

  try {
    const { storagePath, contentType, dataBase64 } = req.body;

    if (!storagePath || !dataBase64) {
      return res.status(400).json({
        error: "storagePath and dataBase64 are required",
      });
    }

    if (typeof dataBase64 !== "string" || dataBase64.length > MAX_BASE64_LENGTH) {
      return res.status(400).json({ error: "Invalid or oversized file payload" });
    }

    const normalizedPath = normalizeStoragePath(storagePath);

    if (!isAllowedStoragePath(normalizedPath, req.user.uid)) {
      return res.status(403).json({
        error:
          "storagePath must be under posts/{uid}/, profiles/{uid}/, messages/{uid}/ or stories/{uid}/",
      });
    }

    const normalizedContentType = contentType
      ? String(contentType).trim().toLowerCase()
      : "application/octet-stream";

    if (
      normalizedContentType !== "application/octet-stream" &&
      !isAllowedContentType(normalizedContentType)
    ) {
      return res.status(400).json({ error: "Unsupported content type" });
    }

    const buffer = Buffer.from(dataBase64, "base64");
    if (buffer.length === 0) {
      return res.status(400).json({ error: "Empty file data" });
    }

    const downloadURL = await uploadBuffer({
      bucket: STORAGE_BUCKET,
      objectPath: normalizedPath,
      buffer,
      contentType: normalizedContentType,
    });

    res.json({
      ok: true,
      downloadURL,
      storagePath: normalizedPath,
    });
  } catch (error) {
    console.error("[uploads]", error);
    res.status(500).json({
      error: error.message ?? "Upload failed",
    });
  }
});

module.exports = router;
