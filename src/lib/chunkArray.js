function chunkArray(items, size) {
  if (!Array.isArray(items) || size < 1) {
    return [];
  }
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

module.exports = { chunkArray };
