const fs = require("fs");

const MIN_MP4_BYTES = 4096;

function validateMp4File(filePath) {
  const stat = fs.statSync(filePath);
  if (!stat.isFile() || stat.size < MIN_MP4_BYTES) {
    throw new Error(
      `İndirilen video geçersiz veya eksik (${stat.size} bayt)`
    );
  }

  const fd = fs.openSync(filePath, "r");
  try {
    const header = Buffer.alloc(12);
    fs.readSync(fd, header, 0, 12, 0);
    const boxType = header.slice(4, 8).toString("ascii");
    if (boxType !== "ftyp" && boxType !== "moov" && boxType !== "wide") {
      throw new Error("İndirilen dosya geçerli bir MP4 değil");
    }
  } finally {
    fs.closeSync(fd);
  }

  return stat.size;
}

module.exports = {
  MIN_MP4_BYTES,
  validateMp4File,
};
