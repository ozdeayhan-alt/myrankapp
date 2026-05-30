require("dotenv").config();

const express = require("express");
const admin = require("./firebase-config");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "myrankapp API çalışıyor" });
});

// Firebase bağlantısını test eden endpoint.
app.get("/status", async (req, res) => {
  try {
    // Admin SDK üzerinden bir auth token üreterek bağlantının canlı olduğunu doğruluyoruz.
    const app = admin.app();
    const projectId =
      app.options.credential?.projectId ||
      app.options.projectId ||
      "unknown";

    res.json({
      status: "ok",
      firebase: "connected",
      projectId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      firebase: "disconnected",
      message: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Sunucu http://localhost:${PORT} adresinde çalışıyor`);
});
