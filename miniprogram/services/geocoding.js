import { request } from './api.js';

function normalizeLocation(item = {}) {
  const location = {
    name: item.name || item.displayName || item.display_name || '',
    lat: Number(item.lat ?? item.latitude),
    lon: Number(item.lon ?? item.lng ?? item.longitude),
    countryCode: (item.countryCode || item.country_code || '').toUpperCase()
  };
  const regionCode = item.regionCode || item.region_code || '';
  const address = item.address || item.formattedAddress || item.display_name || '';
  if (regionCode) location.regionCode = regionCode;
  if (address) location.address = address;
  return location;
}

export async function searchLocations(query, limit = 8) {
  const q = String(query || '').trim();
  if (!q) return [];

  const response = await request('/api/geocoding/search', {
    method: 'GET',
    query: { q, limit }
  });

  const results = response?.results || response?.data?.results || response?.data || [];
  return results.map(normalizeLocation).filter((item) => item.name && Number.isFinite(item.lat) && Number.isFinite(item.lon));
}

export async function reverseGeocode(lat, lon) {
  const latitude = Number(lat);
  const longitude = Number(lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return '';

  const response = await request('/api/geocoding/reverse', {
    method: 'GET',
    query: { lat: latitude, lon: longitude }
  });

  const data = response?.data || response || {};
  return data.name || data.displayName || data.display_name || '';
}

export default { searchLocations, reverseGeocode };
