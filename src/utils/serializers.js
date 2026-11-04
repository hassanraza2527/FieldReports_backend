/** Shapes database rows into the JSON the mobile app receives. */

function imageDto(image, urlMap) {
  const path = image.storage_path;
  return {
    id: image.id,
    position: image.position,
    uploaded: Boolean(path),
    sizeBytes: image.size_bytes ?? null,
    url: (path && urlMap && urlMap.get(path)) || null,
  };
}

function reportDto(report, images, urlMap) {
  const sorted = [...images].sort((a, b) => a.position - b.position);
  return {
    id: report.id,
    description: report.description,
    status: report.status,
    createdAt: report.created_at,
    committedAt: report.committed_at ?? null,
    images: sorted.map((image) => imageDto(image, urlMap)),
  };
}

module.exports = { imageDto, reportDto };
