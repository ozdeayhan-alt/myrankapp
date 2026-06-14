/** Human-readable label from a partial segment key (e.g. city:İzmir). */

function formatSegmentLabel(segmentKey) {
  if (!segmentKey || segmentKey === "global") {
    return "Global";
  }

  const parts = String(segmentKey).split("|");
  for (const part of parts) {
    const [field, value] = part.split(":");
    if (!value || value === "") continue;
    if (field === "city") return value;
    if (field === "country") return value;
  }

  return segmentKey;
}

module.exports = { formatSegmentLabel };
