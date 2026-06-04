import { request } from './api.js';
import { getSessionToken, loginWithWechat } from './auth.js';

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function getAuthorizedToken(options = {}) {
  const existing = options.token ?? getSessionToken({ wx: options.wx });
  if (existing) return existing;
  if (options.autoLogin === false) return null;
  let session = null;
  try {
    session = await loginWithWechat({ wx: options.wx });
  } catch (error) {
    return null;
  }
  return session?.sessionToken || session?.token || null;
}

function unwrap(response) {
  return response?.data ?? response;
}

function pickList(response, key) {
  const data = unwrap(response);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.[key])) return data[key];
  return [];
}

function pickItem(response, key, fallback) {
  const data = unwrap(response);
  return data?.[key] ?? data ?? fallback;
}

function stableLocationId({ name, lat, lon }) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const normalizedName = String(name || 'location').trim().toLowerCase();
  return `loc:${lat.toFixed(6)}:${lon.toFixed(6)}:${encodeURIComponent(normalizedName)}`;
}

export function normalizeLocation(input = {}) {
  const lat = input.lat ?? input.latitude ?? input.coordinate?.lat;
  const lon = input.lon ?? input.lng ?? input.longitude ?? input.coordinate?.lon;
  const name = input.name || input.locationName || input.location || input.title || '当前位置';
  const normalizedLat = lat === undefined || lat === null ? null : Number(lat);
  const normalizedLon = lon === undefined || lon === null ? null : Number(lon);
  const id = input.id || stableLocationId({ name, lat: normalizedLat, lon: normalizedLon });

  return {
    ...input,
    ...(id ? { id } : {}),
    name,
    locationName: input.locationName || name,
    lat: normalizedLat,
    lon: normalizedLon,
    type: input.type || input.period || 'sunset',
    date: input.date || null
  };
}

export async function listFavorites(options = {}) {
  const token = await getAuthorizedToken(options);
  if (!token) return [];
  const response = await request('/api/user/favorites', {
    method: 'GET',
    token,
    header: authHeaders(token),
    wx: options.wx
  });
  return pickList(response, 'favorites').map(normalizeLocation);
}

export async function addFavorite(location, options = {}) {
  const token = await getAuthorizedToken(options);
  const payload = normalizeLocation(location);
  if (!token) return payload;
  const response = await request('/api/user/favorites', {
    method: 'POST',
    data: payload,
    token,
    header: authHeaders(token),
    wx: options.wx
  });
  return normalizeLocation(pickItem(response, 'favorite', payload));
}

export async function deleteFavorite(location, options = {}) {
  const token = await getAuthorizedToken(options);
  const payload = normalizeLocation(location);
  if (!token) return { success: true };
  const response = await request(`/api/user/favorites/${encodeURIComponent(payload.id)}`, {
    method: 'DELETE',
    token,
    header: authHeaders(token),
    wx: options.wx
  });
  return unwrap(response) ?? { success: true };
}

export async function listRecentLocations(options = {}) {
  const token = await getAuthorizedToken(options);
  if (!token) return [];
  const response = await request('/api/user/recent-locations', {
    method: 'GET',
    token,
    header: authHeaders(token),
    wx: options.wx
  });
  return pickList(response, 'recentLocations').map(normalizeLocation);
}

export async function addRecentLocation(location, options = {}) {
  const token = await getAuthorizedToken(options);
  const payload = normalizeLocation(location);
  if (!token) return payload;
  const response = await request('/api/user/recent-locations', {
    method: 'POST',
    data: payload,
    token,
    header: authHeaders(token),
    wx: options.wx
  });
  return normalizeLocation(pickItem(response, 'location', payload));
}

export default {
  normalizeLocation,
  listFavorites,
  addFavorite,
  deleteFavorite,
  listRecentLocations,
  addRecentLocation
};
