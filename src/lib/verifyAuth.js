const { admin } = require("./firestore");

function extractBearerToken(authHeader) {
  if (!authHeader || typeof authHeader !== "string") {
    return null;
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) {
    return null;
  }

  return match[1].trim();
}

async function verifyAuth(req, res, next) {
  const token = extractBearerToken(req.headers.authorization);

  if (!token) {
    return res.status(401).json({ error: "Authorization header required" });
  }

  try {
    req.user = await admin.auth().verifyIdToken(token);
    next();
  } catch (error) {
    const code = error?.code ?? "auth/unknown";
    const message = error?.message ?? "Token verification failed";

    console.error("[verifyAuth]", code, message);

    if (code === "auth/argument-error") {
      return res.status(401).json({ error: "Invalid token format" });
    }

    if (code === "auth/id-token-expired") {
      return res.status(401).json({ error: "Token expired" });
    }

    if (code === "app/invalid-credential") {
      return res.status(503).json({
        error: "Backend Firebase credentials unavailable",
        code,
      });
    }

    return res.status(401).json({
      error: "Invalid or expired token",
      code,
    });
  }
}

module.exports = { verifyAuth, extractBearerToken };
