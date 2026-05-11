import { request } from './api.js';

function normalizeLocation(item = {}) {
  return {
    name: item.name || item.displayName || item.display_name || '',
    lat: Number(item.lat ?? item.latitude),
    lon: Number(item.lon ?? item.lng ?? item.longitude),
    countryCode: (item.countryCode || item.country_code || '').toUpperCase()
  };
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

export default { searchLocations };
