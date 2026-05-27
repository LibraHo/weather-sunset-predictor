const DEFAULT_CLUSTER_DISTANCE = 54;

function getZoomDistance(zoom, baseDistance = DEFAULT_CLUSTER_DISTANCE) {
  const z = Number(zoom);
  if (!Number.isFinite(z)) return baseDistance;
  if (z < 5) return baseDistance + 18;
  if (z < 7) return baseDistance + 8;
  if (z < 10) return baseDistance;
  if (z < 13) return baseDistance - 14;
  return baseDistance - 26;
}

function isValidPhotoLocation(photo) {
  return Number.isFinite(Number(photo?.lat)) && Number.isFinite(Number(photo?.lon));
}

function preferredPhotoUrl(photo) {
  if (!photo) return '';
  return photo.thumbUrl || photo.thumbnailUrl || photo.imageThumbUrl || photo.url || photo.imageUrl || '';
}

function photoClusterRepresentative(photos) {
  return [...(photos || [])].sort((a, b) => {
    const aHasThumb = preferredPhotoUrl(a) === a?.thumbUrl ? 1 : 0;
    const bHasThumb = preferredPhotoUrl(b) === b?.thumbUrl ? 1 : 0;
    if (bHasThumb !== aHasThumb) return bHasThumb - aHasThumb;
    return new Date(b?.uploadedAt || b?.takenAt || 0) - new Date(a?.uploadedAt || a?.takenAt || 0);
  })[0];
}

function clusterPhotosByPixelDistance(photos, { zoom = 4, distance, project } = {}) {
  const maxDistance = Number.isFinite(Number(distance)) ? Number(distance) : getZoomDistance(zoom);
  const projector = typeof project === 'function'
    ? project
    : (photo) => ({ x: Number(photo.lon), y: Number(photo.lat) });

  const clusters = [];
  for (const photo of photos || []) {
    if (!isValidPhotoLocation(photo)) continue;
    const point = projector(photo);
    if (!Number.isFinite(Number(point?.x)) || !Number.isFinite(Number(point?.y))) continue;

    let target = null;
    for (const cluster of clusters) {
      const dx = Number(point.x) - cluster.point.x;
      const dy = Number(point.y) - cluster.point.y;
      if (Math.sqrt(dx * dx + dy * dy) <= maxDistance) {
        target = cluster;
        break;
      }
    }

    if (!target) {
      clusters.push({ photos: [photo], point: { x: Number(point.x), y: Number(point.y) } });
    } else {
      const n = target.photos.length;
      target.point = {
        x: ((target.point.x * n) + Number(point.x)) / (n + 1),
        y: ((target.point.y * n) + Number(point.y)) / (n + 1)
      };
      target.photos.push(photo);
    }
  }

  return clusters.map((cluster, index) => {
    const representative = photoClusterRepresentative(cluster.photos) || cluster.photos[0];
    const avgLat = cluster.photos.reduce((sum, photo) => sum + Number(photo.lat), 0) / cluster.photos.length;
    const avgLon = cluster.photos.reduce((sum, photo) => sum + Number(photo.lon), 0) / cluster.photos.length;
    return {
      id: cluster.photos.length === 1 ? `photo-${representative?.id || index}` : `cluster-${index}`,
      photos: cluster.photos,
      count: cluster.photos.length,
      representative,
      lat: avgLat,
      lon: avgLon,
      isCluster: cluster.photos.length > 1
    };
  });
}

export {
  DEFAULT_CLUSTER_DISTANCE,
  getZoomDistance,
  isValidPhotoLocation,
  preferredPhotoUrl,
  photoClusterRepresentative,
  clusterPhotosByPixelDistance
};
