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
