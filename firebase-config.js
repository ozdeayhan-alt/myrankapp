require("dotenv").config();

const { configureNetworkDns } = require("./src/lib/configureNetworkDns");
configureNetworkDns();

const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

// service-account.json yolunu .env üzerinden de geçirebilirsiniz (GOOGLE_APPLICATION_CREDENTIALS).
// Varsayılan olarak proje kökündeki service-account.json dosyası kullanılır.
const serviceAccountPath =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  path.join(__dirname, "service-account.json");

if (!fs.existsSync(serviceAccountPath)) {
  throw new Error(
    `Firebase service account dosyası bulunamadı: ${serviceAccountPath}\n` +
      "Lütfen Firebase service-account.json dosyasını proje köküne ekleyin " +
      "veya GOOGLE_APPLICATION_CREDENTIALS ortam değişkenini ayarlayın."
  );
}

const serviceAccount = require(serviceAccountPath);

// Uygulamanın birden fazla kez başlatılmasını önlemek için kontrol ediyoruz.
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
    storageBucket:
      process.env.FIREBASE_STORAGE_BUCKET ||
        "myrankapp-d62b9.firebasestorage.app",
  });
}

module.exports = admin;
