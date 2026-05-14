const fs = require('fs');
const path = require('path');

const GEOJSON_PATH = path.resolve(__dirname, '../../public/data/east-asia-geojson.json');
const SUPPORTED_COUNTRY_NAMES = new Set(['China', 'Japan', 'South Korea']);

let cachedFeatures = null;

function loadFeatures() {
  if (cachedFeatures) return cachedFeatures;
  try {
    const data = JSON.parse(fs.readFileSync(GEOJSON_PATH, 'utf8'));
    cachedFeatures = Array.isArray(data?.features)
      ? data.features.filter(feature => SUPPORTED_COUNTRY_NAMES.has(feature?.properties?.name))
      : [];
  } catch (err) {
    console.warn('[SupportedFirecloudRegion] failed to load GeoJSON:', err.message);
    cachedFeatures = [];
  }
  return cachedFeatures;
}

function isPointInRing(lon, lat, ring) {
  if (!Array.isArray(ring) || ring.length < 3) return false;
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const current = ring[i];
    const previous = ring[j];
    if (!Array.isArray(current) || !Array.isArray(previous)) continue;

    const xi = Number(current[0]);
    const yi = Number(current[1]);
    const xj = Number(previous[0]);
    const yj = Number(previous[1]);
    if (![xi, yi, xj, yj].every(Number.isFinite)) continue;

    const intersects = ((yi > lat) !== (yj > lat))
      && (lon < ((xj - xi) * (lat - yi)) / ((yj - yi) || Number.EPSILON) + xi);
    if (intersects) inside = !inside;
  }

  return inside;
}

function isPointInPolygon(lon, lat, polygon) {
  if (!Array.isArray(polygon) || polygon.length === 0) return false;
  const [outer, ...holes] = polygon;
  if (!isPointInRing(lon, lat, outer)) return false;
  return !holes.some(ring => isPointInRing(lon, lat, ring));
}

function isPointInGeometry(lon, lat, geometry) {
  if (!geometry) return false;
  if (geometry.type === 'Polygon') {
    return isPointInPolygon(lon, lat, geometry.coordinates);
  }
  if (geometry.type === 'MultiPolygon') {
    return (geometry.coordinates || []).some(polygon => isPointInPolygon(lon, lat, polygon));
  }
  return false;
}

function isSupportedFirecloudRegion(lat, lon) {
  const latitude = Number(lat);
  const longitude = Number(lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;

  return loadFeatures().some(feature => isPointInGeometry(longitude, latitude, feature.geometry));
}

module.exports = {
  isSupportedFirecloudRegion,
  _test: {
    isPointInRing,
    isPointInPolygon,
    isPointInGeometry
  }
};
