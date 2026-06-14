const admin = require("../../firebase-config");

const db = admin.firestore();

// gRPC DNS sorunlarında HTTPS REST kullan (global https agent ile uyumlu)
db.settings({ preferRest: true });

module.exports = { admin, db };
