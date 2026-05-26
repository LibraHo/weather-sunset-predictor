import { request } from './api.js';

export async function incrementVisitorCount() {
  const response = await request('/api/visitor/count', {
    method: 'POST',
    data: { client: 'miniprogram' },
    header: { 'X-Xiake-Client': 'miniprogram' }
  });
  return normalizeVisitorCount(response);
}

export async function getVisitorCount() {
  const response = await request('/api/visitor/count');
  return normalizeVisitorCount(response);
}

export function normalizeVisitorCount(response = {}) {
  const count = Number(response.count ?? response.visitorCount ?? 0);
  return Number.isFinite(count) && count >= 0 ? Math.floor(count) : null;
}

export function formatVisitorCount(count) {
  if (count === null || count === undefined || count === '') return '--';
  const value = Number(count);
  if (!Number.isFinite(value) || value < 0) return '--';
  return Math.floor(value).toLocaleString();
}

export default {
  incrementVisitorCount,
  getVisitorCount,
  normalizeVisitorCount,
  formatVisitorCount
};
