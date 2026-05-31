import { request } from './api.js';

export const ANALYTICS_EVENTS = {
  PAGE_VISIT: 'page_view',
  SHARE_CLICK: 'share_click',
  MAP_VIEW: 'map_view',
  UPLOAD_ENTRY: 'upload_entry',
  API_APPLICATION_ENTRY: 'api_application_entry'
};

const DEFAULT_EVENT = {
  channel: 'miniprogram',
  status: 'success'
};

function sanitizePath(path = '') {
  if (!path) return '';
  return String(path).split('?')[0].split('#')[0];
}

export function buildAnalyticsEvent(eventName, payload = {}) {
  const {
    path,
    targetType,
    targetLabel,
    referrerType,
    deviceType,
    status,
    elapsedMs,
    errorCode,
    extra
  } = payload;

  return {
    ...DEFAULT_EVENT,
    eventName,
    occurredAt: new Date().toISOString(),
    path: sanitizePath(path),
    targetType: targetType || 'feature',
    targetLabel: targetLabel || '',
    referrerType: referrerType || '',
    deviceType: deviceType || '',
    status: status || DEFAULT_EVENT.status,
    elapsedMs: Number.isFinite(Number(elapsedMs)) ? Number(elapsedMs) : undefined,
    errorCode: errorCode || undefined,
    extra: extra && typeof extra === 'object' ? extra : undefined
  };
}

export async function trackAnalyticsEvent(eventName, payload = {}) {
  try {
    await request('/api/analytics/event', {
      method: 'POST',
      data: buildAnalyticsEvent(eventName, payload),
      header: { 'X-Xiake-Client': 'miniprogram' }
    });
    return true;
  } catch (error) {
    return false;
  }
}

export function trackPageVisit(payload = {}) {
  return trackAnalyticsEvent(ANALYTICS_EVENTS.PAGE_VISIT, {
    targetType: 'page',
    ...payload
  });
}

export function trackShareClick(payload = {}) {
  return trackAnalyticsEvent(ANALYTICS_EVENTS.SHARE_CLICK, {
    targetType: 'share',
    ...payload
  });
}

export function trackMapView(payload = {}) {
  return trackAnalyticsEvent(ANALYTICS_EVENTS.MAP_VIEW, {
    targetType: 'feature',
    targetLabel: 'firecloud-map',
    ...payload
  });
}

export function trackUploadEntry(payload = {}) {
  return trackAnalyticsEvent(ANALYTICS_EVENTS.UPLOAD_ENTRY, {
    targetType: 'feature',
    targetLabel: 'photo-upload',
    ...payload
  });
}

export function trackApiApplicationEntry(payload = {}) {
  return trackAnalyticsEvent(ANALYTICS_EVENTS.API_APPLICATION_ENTRY, {
    targetType: 'feature',
    targetLabel: 'api-application',
    ...payload
  });
}

export default {
  ANALYTICS_EVENTS,
  buildAnalyticsEvent,
  trackAnalyticsEvent,
  trackPageVisit,
  trackShareClick,
  trackMapView,
  trackUploadEntry,
  trackApiApplicationEntry
};
