'use strict';

const express = require('express');

const DEFAULT_LIMIT = 10;
const SLOW_REQUEST_MS = 1000;

function tryLoadDefaultAnalyticsService() {
  try {
    const mod = require('../services/AnalyticsService');
    const exported = mod.default || mod;
    const candidates = [
      exported,
      exported.analyticsService,
      exported.AnalyticsService
    ].filter(Boolean);
    for (const candidate of candidates) {
      if (typeof candidate === 'function') {
        try {
          return new candidate();
        } catch (_) {
          continue;
        }
      }
      if (candidate && typeof candidate === 'object') {
        return candidate;
      }
    }
  } catch (_) {
    // Fall through to an empty read-only adapter when the service is not present yet.
  }
  return {
    listEvents: () => []
  };
}

function parseDays(value) {
  const days = parseInt(value, 10);
  if (!Number.isFinite(days)) return 7;
  return Math.min(Math.max(days, 1), 90);
}

function roundPercent(value) {
  return Number((value || 0).toFixed(2));
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.events)) return value.events;
  if (Array.isArray(value?.items)) return value.items;
  return [];
}

async function readEvents(analyticsService, req) {
  const options = {
    days: parseDays(req.query.days),
    startDate: req.query.startDate || undefined,
    endDate: req.query.endDate || undefined
  };

  if (analyticsService && typeof analyticsService.listEvents === 'function') {
    return asArray(await analyticsService.listEvents(options));
  }
  if (analyticsService && typeof analyticsService.getEvents === 'function') {
    return asArray(await analyticsService.getEvents(options));
  }
  if (analyticsService && typeof analyticsService.queryEvents === 'function') {
    return asArray(await analyticsService.queryEvents(options));
  }
  if (analyticsService && typeof analyticsService.getDailyAggregates === 'function') {
    return expandDailyAggregates(await analyticsService.getDailyAggregates(options));
  }
  return [];
}

function expandDailyAggregates(value) {
  const rows = Array.isArray(value) ? value : asArray(value);
  const events = [];
  for (const row of rows) {
    const pageViews = Number(row.pageViews || row.pv || 0);
    const visitors = Number(row.uniqueVisitors || row.uv || 0);
    if (pageViews > 0) {
      events.push({
        type: 'page_view',
        count: pageViews,
        uniqueVisitorCount: visitors,
        path: row.path || row.topPath || null,
        channel: row.channel || null,
        source: row.source || null,
        device: row.device || null,
        referrer: row.referrer || null,
        location: row.location || null
      });
    }
  }
  return events;
}

function eventName(event = {}) {
  return String(event.eventName || event.type || event.eventType || event.name || event.action || '').toLowerCase();
}

function eventCount(event = {}) {
  const count = Number(event.count);
  return Number.isFinite(count) && count > 0 ? count : 1;
}

function eventPath(event = {}) {
  const raw = event.path || event.page || event.route || event.url || event.endpoint || '';
  if (!raw) return 'unknown';
  try {
    if (/^https?:\/\//i.test(raw)) {
      return new URL(raw).pathname || '/';
    }
  } catch (_) {
    return String(raw);
  }
  return String(raw);
}

function isAdminEvent(event = {}) {
  if (event.admin === true || event.isAdmin === true || event.adminRequest === true) return true;
  const path = eventPath(event);
  return path === '/admin'
    || path.startsWith('/admin/')
    || path === '/api/admin'
    || path.startsWith('/api/admin/');
}

function isPageView(event = {}) {
  const name = eventName(event);
  return name === 'page_view' || name === 'pageview' || name === 'pv' || name === 'visit';
}

function isEvent(event, names) {
  return names.includes(eventName(event));
}

function valueOf(event, fields, fallback = 'unknown') {
  for (const field of fields) {
    const value = event[field];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return fallback;
}

function visitorKey(event = {}) {
  const keys = ['visitorId', 'visitorID', 'userId', 'userID', 'openid', 'sessionId', 'clientId', 'ip'];
  for (const key of keys) {
    if (event[key]) return String(event[key]);
  }
  return null;
}

function locationKey(event = {}) {
  const location = event.location || event.geo || event.region;
  if (typeof location === 'string') return location.trim();
  if (location && typeof location === 'object') {
    return [
      location.city,
      location.province || location.region,
      location.country
    ].filter(Boolean)[0] || '';
  }
  return '';
}

function increment(map, key, count = 1, extra = {}) {
  if (!key || key === 'unknown') return;
  const existing = map.get(key) || { key, count: 0, ...extra };
  existing.count += count;
  for (const [extraKey, extraValue] of Object.entries(extra)) {
    if (existing[extraKey] === undefined || existing[extraKey] === null || existing[extraKey] === '') {
      existing[extraKey] = extraValue;
    }
  }
  map.set(key, existing);
}

function ranked(map, limit = DEFAULT_LIMIT) {
  return Array.from(map.values())
    .sort((a, b) => b.count - a.count || String(a.key).localeCompare(String(b.key)))
    .slice(0, limit);
}

function pageEvents(events) {
  return events.filter(event => isPageView(event) && !isAdminEvent(event));
}

function buildSummary(events) {
  const pages = pageEvents(events);
  const visitors = new Set();
  const channels = new Map();
  const sources = new Map();
  const devices = new Map();
  const referrers = new Map();
  const topPaths = new Map();
  const locations = new Map();
  let pageViews = 0;
  let aggregateUniqueVisitors = 0;

  for (const event of pages) {
    const count = eventCount(event);
    pageViews += count;
    const visitor = visitorKey(event);
    if (visitor) visitors.add(visitor);
    aggregateUniqueVisitors += Number(event.uniqueVisitorCount || 0);
    increment(channels, valueOf(event, ['channel', 'utmChannel', 'trafficChannel'], 'direct'), count);
    increment(sources, valueOf(event, ['source', 'utmSource', 'trafficSource'], 'direct'), count);
    increment(devices, valueOf(event, ['device', 'deviceType', 'platform'], 'unknown'), count);
    increment(referrers, valueOf(event, ['referrer', 'referer'], 'direct'), count);
    increment(topPaths, eventPath(event), count);
    increment(locations, locationKey(event), count);
  }

  return {
    pageViews,
    uniqueVisitors: visitors.size || aggregateUniqueVisitors,
    channels: ranked(channels),
    sources: ranked(sources),
    devices: ranked(devices),
    referrers: ranked(referrers),
    topPaths: ranked(topPaths),
    locations: ranked(locations)
  };
}

function buildBehavior(events) {
  const visibleEvents = events.filter(event => !isAdminEvent(event) || !isPageView(event));
  return {
    pageVisits: pageEvents(events).reduce((sum, event) => sum + eventCount(event), 0),
    shareClicks: countEvents(visibleEvents, ['share_click', 'share_clicks', 'share']),
    mapViews: countEvents(visibleEvents, ['map_view', 'map_views', 'map_layer_view']),
    uploadEntries: countEvents(visibleEvents, ['upload_entry', 'upload_entries', 'photo_upload_entry', 'upload_click']),
    apiApplicationEntries: countEvents(visibleEvents, ['api_application_entry', 'api_apply_entry', 'application_entry'])
  };
}

function countEvents(events, names) {
  return events
    .filter(event => isEvent(event, names))
    .reduce((sum, event) => sum + eventCount(event), 0);
}

function buildFunnel(events) {
  const behavior = buildBehavior(events);
  const base = behavior.pageVisits;
  const steps = [
    ['page_visits', 'Page visits', behavior.pageVisits],
    ['map_views', 'Map views', behavior.mapViews],
    ['share_clicks', 'Share clicks', behavior.shareClicks],
    ['upload_entries', 'Upload entries', behavior.uploadEntries],
    ['api_application_entries', 'API application entries', behavior.apiApplicationEntries]
  ].map(([key, label, count]) => ({
    key,
    label,
    count,
    conversionFromPageVisits: base > 0 ? roundPercent((count / base) * 100) : 0
  }));

  return { steps };
}

function isRequestEvent(event = {}) {
  const name = eventName(event);
  return name === 'api_request'
    || name === 'request'
    || name === 'http_request'
    || event.status !== undefined
    || event.statusCode !== undefined;
}

function isFailedRequest(event = {}) {
  const status = Number(event.status ?? event.statusCode ?? 0);
  return status >= 400 || event.success === false || Boolean(event.errorCode && isRequestEvent(event));
}

function durationMs(event = {}) {
  const value = Number(event.durationMs ?? event.elapsedMs ?? event.responseTimeMs ?? event.latencyMs ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function buildSlowRequests(events) {
  const grouped = new Map();
  for (const event of events) {
    if (!isRequestEvent(event)) continue;
    const duration = durationMs(event);
    if (duration < SLOW_REQUEST_MS) continue;
    const path = eventPath(event);
    const row = grouped.get(path) || { path, count: 0, maxDurationMs: 0, totalDurationMs: 0 };
    const count = eventCount(event);
    row.count += count;
    row.maxDurationMs = Math.max(row.maxDurationMs, duration);
    row.totalDurationMs += duration * count;
    grouped.set(path, row);
  }

  return Array.from(grouped.values())
    .map(row => ({
      path: row.path,
      count: row.count,
      maxDurationMs: row.maxDurationMs,
      avgDurationMs: Math.round(row.totalDurationMs / row.count)
    }))
    .sort((a, b) => b.maxDurationMs - a.maxDurationMs || String(a.path).localeCompare(String(b.path)))
    .slice(0, DEFAULT_LIMIT);
}

function buildQuality(events) {
  const requestEvents = events.filter(isRequestEvent);
  const totalRequests = requestEvents.reduce((sum, event) => sum + eventCount(event), 0);
  const failedRequests = requestEvents
    .filter(isFailedRequest)
    .reduce((sum, event) => sum + eventCount(event), 0);
  const geocoding = new Map();
  const miniprogram = new Map();
  const mapLayers = new Map();
  const tokenAnomalies = new Map();

  for (const event of events) {
    if (isEvent(event, ['geocoding_failed', 'geocode_failed', 'geocoding_failure'])) {
      increment(geocoding, valueOf(event, ['query', 'keyword', 'q']), eventCount(event), {
        reason: event.reason || event.errorCode || null
      });
    }
    if (isEvent(event, ['miniprogram_error', 'mini_program_error', 'mp_error'])) {
      increment(miniprogram, valueOf(event, ['errorCode', 'code'], 'unknown'), eventCount(event), {
        message: event.message || null
      });
    }
    if (isEvent(event, ['map_layer_failure', 'map_layer_failed', 'map_failure'])) {
      increment(mapLayers, valueOf(event, ['layer', 'layerId', 'source'], 'unknown'), eventCount(event), {
        errorCode: event.errorCode || event.code || null
      });
    }
    if (isEvent(event, ['api_token_anomaly', 'token_anomaly', 'api_token_abuse'])) {
      increment(tokenAnomalies, valueOf(event, ['tokenId', 'token', 'prefix'], 'unknown'), eventCount(event), {
        reason: event.reason || event.errorCode || null
      });
    }
  }

  return {
    failureRate: totalRequests > 0 ? roundPercent((failedRequests / totalRequests) * 100) : 0,
    totalRequests,
    failedRequests,
    slowRequestsTop: buildSlowRequests(events),
    geocodingFailedQueries: ranked(geocoding),
    miniprogramErrors: ranked(miniprogram),
    mapLayerFailures: ranked(mapLayers),
    apiTokenAnomalies: ranked(tokenAnomalies)
  };
}

function createRouter(deps = {}) {
  const router = express.Router();
  const analyticsService = deps.analyticsService || tryLoadDefaultAnalyticsService();

  async function withEvents(req, res, build, errorCode) {
    try {
      const events = await readEvents(analyticsService, req);
      return res.json({ success: true, ...build(events) });
    } catch (err) {
      return res.status(500).json({
        error: { code: errorCode, message: err.message || 'analytics query failed' }
      });
    }
  }

  router.get('/summary', (req, res) => withEvents(req, res, events => ({
    summary: buildSummary(events)
  }), 'ANALYTICS_SUMMARY_FAILED'));

  router.get('/sources', (req, res) => withEvents(req, res, events => {
    const summary = buildSummary(events);
    return {
      sources: {
        channels: summary.channels,
        sources: summary.sources,
        devices: summary.devices,
        referrers: summary.referrers
      }
    };
  }, 'ANALYTICS_SOURCES_FAILED'));

  router.get('/behavior', (req, res) => withEvents(req, res, events => ({
    behavior: buildBehavior(events)
  }), 'ANALYTICS_BEHAVIOR_FAILED'));

  router.get('/funnel', (req, res) => withEvents(req, res, events => ({
    funnel: buildFunnel(events)
  }), 'ANALYTICS_FUNNEL_FAILED'));

  router.get('/quality', (req, res) => withEvents(req, res, events => ({
    quality: buildQuality(events)
  }), 'ANALYTICS_QUALITY_FAILED'));

  return router;
}

module.exports = createRouter();
module.exports.createRouter = createRouter;
module.exports._test = {
  buildBehavior,
  buildFunnel,
  buildQuality,
  buildSummary,
  isAdminEvent,
  readEvents
};
