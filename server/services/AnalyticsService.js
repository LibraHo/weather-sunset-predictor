'use strict';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const RAW_EVENT_RETENTION_DAYS = 30;
const DAILY_RETENTION_DAYS = 365;

const DEFAULT_DATA_DIR = process.env.XIAKE_DATA_DIR || process.env.XIAKE_DIR || path.join(os.homedir(), '.xiake');
const DEFAULT_FILE = process.env.ANALYTICS_EVENTS_FILE || path.join(DEFAULT_DATA_DIR, 'analytics-events.json');

const CHANNELS = new Set(['web', 'miniprogram', 'server', 'admin', 'api', 'unknown']);
const EVENT_NAMES = new Set([
  'api_application_entry',
  'api_application_submit',
  'api_call',
  'api_request',
  'api_token_anomaly',
  'page_view',
  'prediction_request',
  'weather_query',
  'share',
  'share_click',
  'login',
  'logout',
  'auth_callback',
  'error',
  'click',
  'geocoding_failed',
  'map_layer_failure',
  'map_view',
  'miniprogram_error',
  'photo_upload',
  'upload_entry',
  'map_interaction',
  'session_start',
  'unknown'
]);
const REFERRER_TYPES = new Set(['direct', 'internal', 'external', 'search', 'social', 'unknown']);
const DEVICE_TYPES = new Set(['desktop', 'mobile', 'tablet', 'miniprogram', 'bot', 'server', 'unknown']);
const TARGET_TYPES = new Set(['page', 'api', 'api_application', 'button', 'link', 'feature', 'photo', 'prediction', 'weather', 'map', 'auth', 'unknown']);
const STATUSES = new Set(['success', 'error', 'pending', 'cancelled', 'unknown']);

const SENSITIVE_QUERY_KEYS = new Set([
  'access_token',
  'auth',
  'authorization',
  'code',
  'id_token',
  'lat',
  'latitude',
  'lng',
  'lon',
  'longitude',
  'openid',
  'refresh_token',
  'session_key',
  'state',
  'token',
  'unionid'
]);

function nowDate(nowFn) {
  const value = typeof nowFn === 'function' ? nowFn() : new Date();
  return value instanceof Date ? value : new Date(value);
}

function dayKey(date) {
  return date.toISOString().slice(0, 10);
}

function clampString(value, max = 120) {
  return String(value || '').trim().slice(0, max);
}

function enumValue(value, allowed, fallback = 'unknown') {
  const normalized = clampString(value, 80).toLowerCase();
  return allowed.has(normalized) ? normalized : fallback;
}

function cleanRegion(value) {
  const text = clampString(value, 40);
  return /^[a-zA-Z0-9_.:-]{1,40}$/.test(text) ? text : 'unknown';
}

function cleanErrorCode(value) {
  if (value === null || value === undefined || value === '') return '';
  const text = clampString(value, 80).toUpperCase();
  return /^[A-Z0-9_:-]{1,80}$/.test(text) ? text : 'UNKNOWN';
}

function cleanIdentity(value, max = 128) {
  const text = clampString(value, max);
  return /^[a-zA-Z0-9_.:@-]{0,128}$/.test(text) ? text : '';
}

function normalizeIp(ip = '') {
  return String(ip || '').replace(/^::ffff:/, '').split(',')[0].trim();
}

function hashIp(ip = '', secret = '') {
  const normalized = normalizeIp(ip);
  if (!normalized) return '';
  return `ip_${crypto.createHash('sha256').update(`${secret}:${normalized}`).digest('hex').slice(0, 32)}`;
}

function cleanPath(value = '/') {
  const raw = clampString(value || '/', 2048) || '/';
  try {
    const url = new URL(raw, 'https://xiake.local');
    const params = new URLSearchParams();
    for (const [key, val] of url.searchParams.entries()) {
      if (SENSITIVE_QUERY_KEYS.has(String(key).toLowerCase())) continue;
      params.append(key, val.slice(0, 160));
    }
    const query = params.toString();
    return `${url.pathname || '/'}${query ? `?${query}` : ''}`.slice(0, 2048);
  } catch (error) {
    return raw.split('?')[0].slice(0, 512) || '/';
  }
}

function isBotUserAgent(userAgent = '') {
  return /bot|spider|crawler|crawl|headless|censys|mj12|semrush|ahrefs|bytespider|petalbot|bingpreview|facebookexternalhit|python|curl|wget|go-http|scrapy|httpclient|zgrab|nmap|scan/i.test(String(userAgent || ''));
}

function isHealthPath(pathname = '') {
  const p = cleanPath(pathname).split('?')[0].toLowerCase();
  return p === '/health' || p === '/api/health' || p === '/readyz' || p === '/livez' || p === '/status';
}

function isAdminPath(pathname = '') {
  const p = cleanPath(pathname).split('?')[0].toLowerCase();
  return p === '/admin' || p.startsWith('/admin/') || p === '/api/admin' || p.startsWith('/api/admin/');
}

function emptyDaily(day) {
  return {
    day,
    pv: 0,
    uv: new Set(),
    events: {},
    channels: {},
    referrerTypes: {},
    deviceTypes: {},
    regions: {},
    targets: {},
    statuses: {},
    errors: {},
    filtered: { bot: 0, health: 0 },
    admin: { pv: 0, uv: new Set() },
    elapsedMs: { count: 0, total: 0, max: 0 },
    updatedAt: null
  };
}

function bump(map, key, by = 1) {
  const safeKey = key || 'unknown';
  map[safeKey] = (map[safeKey] || 0) + by;
}

function serializeDaily(day) {
  return {
    ...day,
    uv: Array.from(day.uv || []).sort(),
    admin: {
      ...day.admin,
      uv: Array.from(day.admin?.uv || []).sort()
    }
  };
}

function hydrateDaily(day, key) {
  const base = emptyDaily(key);
  return {
    ...base,
    ...(day || {}),
    day: key,
    uv: new Set(Array.isArray(day?.uv) ? day.uv : []),
    events: { ...(day?.events || {}) },
    channels: { ...(day?.channels || {}) },
    referrerTypes: { ...(day?.referrerTypes || {}) },
    deviceTypes: { ...(day?.deviceTypes || {}) },
    regions: { ...(day?.regions || {}) },
    targets: { ...(day?.targets || {}) },
    statuses: { ...(day?.statuses || {}) },
    errors: { ...(day?.errors || {}) },
    filtered: { bot: 0, health: 0, ...(day?.filtered || {}) },
    admin: {
      pv: day?.admin?.pv || 0,
      uv: new Set(Array.isArray(day?.admin?.uv) ? day.admin.uv : [])
    },
    elapsedMs: { count: 0, total: 0, max: 0, ...(day?.elapsedMs || {}) }
  };
}

function publicDaily(day) {
  const serialized = serializeDaily(day);
  return {
    ...serialized,
    uv: serialized.uv.length,
    admin: {
      ...serialized.admin,
      uv: serialized.admin.uv.length
    }
  };
}

class AnalyticsService {
  constructor(options = {}) {
    const env = options.env || process.env;
    const dataDir = env.XIAKE_DATA_DIR || env.XIAKE_DIR || DEFAULT_DATA_DIR;
    this.filePath = options.filePath || env.ANALYTICS_EVENTS_FILE || path.join(dataDir, 'analytics-events.json');
    this.ipHashSecret = options.ipHashSecret || env.ANALYTICS_IP_HASH_SECRET || env.SESSION_SECRET || 'xiake-analytics';
    this.now = options.now || (() => new Date());
    this.state = { rawEvents: [], daily: {}, updatedAt: null };
    this._load();
  }

  hashIp(ip) {
    return hashIp(ip, this.ipHashSecret);
  }

  _ensureDir() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
  }

  _load() {
    try {
      if (!fs.existsSync(this.filePath)) return;
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      if (!parsed || typeof parsed !== 'object') return;
      this.state.rawEvents = Array.isArray(parsed.rawEvents) ? parsed.rawEvents : [];
      this.state.daily = {};
      for (const [key, value] of Object.entries(parsed.daily || {})) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(key)) {
          this.state.daily[key] = hydrateDaily(value, key);
        }
      }
      this.state.updatedAt = parsed.updatedAt || null;
    } catch (error) {
      console.warn('[AnalyticsService] load failed:', error.message);
    }
  }

  _save() {
    try {
      this._ensureDir();
      const out = {
        updatedAt: this.state.updatedAt,
        rawEvents: this.state.rawEvents,
        daily: {}
      };
      for (const [key, value] of Object.entries(this.state.daily)) {
        out.daily[key] = serializeDaily(value);
      }
      const tmpFile = `${this.filePath}.tmp`;
      fs.writeFileSync(tmpFile, JSON.stringify(out, null, 2), 'utf8');
      fs.renameSync(tmpFile, this.filePath);
    } catch (error) {
      console.warn('[AnalyticsService] save failed:', error.message);
    }
  }

  _ensureDay(day) {
    if (!this.state.daily[day]) this.state.daily[day] = emptyDaily(day);
    return this.state.daily[day];
  }

  _prune(now = nowDate(this.now)) {
    const rawCutoff = now.getTime() - RAW_EVENT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    this.state.rawEvents = (this.state.rawEvents || []).filter((event) => {
      const ts = Date.parse(event.t);
      return Number.isFinite(ts) && ts >= rawCutoff;
    });

    const dailyCutoff = dayKey(new Date(now.getTime() - DAILY_RETENTION_DAYS * 24 * 60 * 60 * 1000));
    for (const key of Object.keys(this.state.daily || {})) {
      if (key < dailyCutoff) delete this.state.daily[key];
    }
  }

  _sanitize(input = {}, now = nowDate(this.now)) {
    const pathValue = cleanPath(input.path || '/');
    const ipHash = input.ipHash || this.hashIp(input.ip);
    const visitorHash = cleanIdentity(input.visitorHash) || ipHash || cleanIdentity(input.userId);
    const elapsedMs = Math.max(0, Math.min(24 * 60 * 60 * 1000, Math.floor(Number(input.elapsedMs) || 0)));
    const isBot = Boolean(input.isBot) || isBotUserAgent(input.userAgent);
    const isHealthCheck = Boolean(input.isHealthCheck) || isHealthPath(pathValue);
    const isAdmin = Boolean(input.isAdmin) || isAdminPath(pathValue);
    const eventName = enumValue(input.eventName, EVENT_NAMES);

    return {
      id: input.id || `evt_${now.getTime()}_${crypto.randomBytes(6).toString('hex')}`,
      t: now.toISOString(),
      day: dayKey(now),
      channel: enumValue(input.channel, CHANNELS),
      eventName,
      visitorHash,
      userId: cleanIdentity(input.userId),
      ipHash,
      path: pathValue,
      referrerType: enumValue(input.referrerType, REFERRER_TYPES),
      deviceType: enumValue(input.deviceType, DEVICE_TYPES),
      region: cleanRegion(input.region),
      targetType: enumValue(input.targetType, TARGET_TYPES),
      status: enumValue(input.status, STATUSES),
      elapsedMs,
      errorCode: cleanErrorCode(input.errorCode),
      isBot,
      isHealthCheck,
      isAdmin,
      isCounted: !isBot && !isHealthCheck && !isAdmin
    };
  }

  _aggregate(event) {
    const daily = this._ensureDay(event.day);
    daily.updatedAt = event.t;

    bump(daily.events, event.eventName);
    bump(daily.channels, event.channel);
    bump(daily.referrerTypes, event.referrerType);
    bump(daily.deviceTypes, event.deviceType);
    bump(daily.regions, event.region);
    bump(daily.targets, event.targetType);
    bump(daily.statuses, event.status);

    if (event.isBot) daily.filtered.bot += 1;
    if (event.isHealthCheck) daily.filtered.health += 1;
    if (event.status === 'error' || event.errorCode) bump(daily.errors, event.errorCode || 'UNKNOWN');

    if (event.isAdmin && event.eventName === 'page_view') {
      daily.admin.pv += 1;
      if (event.visitorHash) daily.admin.uv.add(event.visitorHash);
    }

    if (event.isCounted && event.eventName === 'page_view') {
      daily.pv += 1;
      if (event.visitorHash) daily.uv.add(event.visitorHash);
      daily.elapsedMs.count += 1;
      daily.elapsedMs.total += event.elapsedMs;
      daily.elapsedMs.max = Math.max(daily.elapsedMs.max, event.elapsedMs);
    }
  }

  recordEvent(input = {}) {
    const now = nowDate(this.now);
    const event = this._sanitize(input, now);
    this.state.rawEvents.push(event);
    this._aggregate(event);
    this.state.updatedAt = now.toISOString();
    this._prune(now);
    this._save();
    return {
      success: true,
      accepted: true,
      eventId: event.id,
      ignored: !event.isCounted,
      reason: event.isBot ? 'bot' : event.isHealthCheck ? 'health_check' : event.isAdmin ? 'admin' : null
    };
  }

  getSummary({ days = 7 } = {}) {
    const limit = Math.min(Math.max(Number(days) || 7, 1), 365);
    const keys = Object.keys(this.state.daily || {}).sort().reverse().slice(0, limit);
    return {
      success: true,
      days: keys.map((key) => publicDaily(this.state.daily[key])),
      rawEventCount: this.state.rawEvents.length,
      updatedAt: this.state.updatedAt
    };
  }

  listEvents({ days = 7, startDate, endDate } = {}) {
    const now = nowDate(this.now);
    const limit = Math.min(Math.max(Number(days) || 7, 1), RAW_EVENT_RETENTION_DAYS);
    const start = startDate ? Date.parse(startDate) : now.getTime() - limit * 24 * 60 * 60 * 1000;
    const end = endDate ? Date.parse(endDate) + 24 * 60 * 60 * 1000 : now.getTime() + 1;
    return (this.state.rawEvents || [])
      .filter((event) => {
        const ts = Date.parse(event.t);
        return Number.isFinite(ts) && ts >= start && ts < end;
      })
      .map((event) => ({
        ...event,
        type: event.eventName,
        visitorId: event.visitorHash,
        durationMs: event.elapsedMs,
        device: event.deviceType,
        referrer: event.referrerType,
        location: event.region
      }));
  }

  getDailyAggregates(options = {}) {
    return this.getSummary(options).days;
  }

  deleteByUserId(userId) {
    const id = cleanIdentity(userId);
    if (!id) return { deletedEvents: 0 };
    const before = this.state.rawEvents.length;
    this.state.rawEvents = this.state.rawEvents.filter((event) => event.userId !== id);
    this.state.daily = {};
    for (const event of this.state.rawEvents) {
      this._aggregate(event);
    }
    this.state.updatedAt = nowDate(this.now).toISOString();
    this._save();
    return { deletedEvents: before - this.state.rawEvents.length };
  }
}

module.exports = new AnalyticsService();
module.exports.AnalyticsService = AnalyticsService;
module.exports._test = {
  cleanPath,
  hashIp,
  isAdminPath,
  isBotUserAgent,
  isHealthPath,
  normalizeIp
};
