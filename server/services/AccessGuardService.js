/**
 * server/services/AccessGuardService.js - 访问防护与自动拦截
 *
 * 在应用层识别高频访问和敏感路径扫描，并提供后台查看/手动封禁。
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const ipLocationService = require('./IpLocationService');

const DATA_DIR = path.join(os.homedir(), '.xiake');
const DATA_FILE = path.join(DATA_DIR, 'access-guard.json');

const MINUTE_MS = 60 * 1000;
const WINDOW_MS = 10 * MINUTE_MS;
const DEFAULT_BLOCK_MS = 6 * 60 * 60 * 1000;

const DEFAULT_CONFIG = {
  enabled: process.env.ACCESS_GUARD_ENABLED !== 'false',
  perMinuteLimit: Number(process.env.ACCESS_GUARD_PER_MINUTE_LIMIT) || 300,
  rollingLimit: Number(process.env.ACCESS_GUARD_ROLLING_LIMIT) || 1800,
  suspiciousPathLimit: Number(process.env.ACCESS_GUARD_SUSPICIOUS_PATH_LIMIT) || 20,
  blockMs: Number(process.env.ACCESS_GUARD_BLOCK_MS) || DEFAULT_BLOCK_MS,
};

const SUSPICIOUS_PATH_RE = /(^|\/)(\.env|\.git|id_rsa|config\.php|wp-config\.php|database\.yml)(\.|\/|$)|^\/(deploy|backup|backups|dump|data)\/.*\.(zip|tar|tgz|gz|bz2|xz|zst|7z|rar|sql|bak|old|backup)$/i;

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function normalizeIp(value = '') {
  return String(value || '')
    .replace(/^::ffff:/, '')
    .trim() || 'unknown';
}

function getClientIp(req) {
  const forwarded = req.headers && (req.headers['x-forwarded-for'] || req.headers['x-real-ip']);
  if (forwarded) return normalizeIp(String(forwarded).split(',')[0]);
  return normalizeIp(req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || '');
}

function fmtDateTime(ts) {
  return new Date(ts).toISOString();
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}

class AccessGuardService {
  constructor() {
    this._config = { ...DEFAULT_CONFIG };
    this._hits = new Map();
    this._blocked = {};
    this._events = [];
    this._lastPersist = 0;
    ensureDir();
    this._load();
    setInterval(() => this._cleanup(Date.now()), 60 * 1000);
  }

  _load() {
    try {
      if (!fs.existsSync(DATA_FILE)) return;
      const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      if (raw.config && typeof raw.config === 'object') {
        this._config = this._normalizeConfig({ ...this._config, ...raw.config });
      }
      if (raw.blocked && typeof raw.blocked === 'object') this._blocked = raw.blocked;
      if (Array.isArray(raw.events)) this._events = raw.events.slice(-100);
    } catch (err) {
      console.error('[AccessGuardService] load failed:', err.message);
    }
  }

  _persist() {
    try {
      ensureDir();
      fs.writeFileSync(DATA_FILE, JSON.stringify({
        updatedAt: Date.now(),
        config: this._config,
        blocked: this._blocked,
        events: this._events.slice(-100),
      }), 'utf8');
      this._lastPersist = Date.now();
    } catch (err) {
      console.error('[AccessGuardService] persist failed:', err.message);
    }
  }

  _recordEvent(type, payload) {
    this._events.push({ type, at: Date.now(), ...payload });
    this._events = this._events.slice(-100);
    this._persist();
  }

  _normalizeConfig(config = {}) {
    const enabled = typeof config.enabled === 'boolean'
      ? config.enabled
      : String(config.enabled) !== 'false';

    return {
      enabled,
      perMinuteLimit: clampNumber(config.perMinuteLimit, 30, 10000, DEFAULT_CONFIG.perMinuteLimit),
      rollingLimit: clampNumber(config.rollingLimit, 100, 100000, DEFAULT_CONFIG.rollingLimit),
      suspiciousPathLimit: clampNumber(config.suspiciousPathLimit, 3, 1000, DEFAULT_CONFIG.suspiciousPathLimit),
      blockMs: clampNumber(config.blockMs, 5 * MINUTE_MS, 7 * 24 * 60 * MINUTE_MS, DEFAULT_CONFIG.blockMs),
    };
  }

  _cleanup(now) {
    let changed = false;
    for (const [ip, entry] of Object.entries(this._blocked)) {
      if (!entry.manual && entry.expiresAt && entry.expiresAt <= now) {
        delete this._blocked[ip];
        changed = true;
      }
    }

    for (const [ip, state] of this._hits.entries()) {
      state.timestamps = state.timestamps.filter(t => t >= now - WINDOW_MS);
      state.suspicious = state.suspicious.filter(t => t >= now - WINDOW_MS);
      if (!state.timestamps.length && !state.suspicious.length) this._hits.delete(ip);
    }

    if (changed) this._persist();
  }

  _getState(ip) {
    if (!this._hits.has(ip)) {
      this._hits.set(ip, { timestamps: [], suspicious: [], lastPath: '/', lastUa: '' });
    }
    return this._hits.get(ip);
  }

  _block(ip, reason, meta = {}) {
    const now = Date.now();
    this._blocked[ip] = {
      ip,
      reason,
      blockedAt: now,
      expiresAt: meta.manual ? null : now + this._config.blockMs,
      manual: !!meta.manual,
      count: meta.count || 0,
      path: meta.path || '',
      ua: meta.ua || '',
    };
    this._recordEvent(meta.manual ? 'manual_block' : 'auto_block', { ip, reason, count: meta.count || 0, path: meta.path || '' });
  }

  check(req) {
    if (!this._config.enabled) return { blocked: false };
    const now = Date.now();
    this._cleanup(now);

    const ip = getClientIp(req);
    const blocked = this._blocked[ip];
    if (blocked) {
      return { blocked: true, ip, reason: blocked.reason, status: 429 };
    }

    const state = this._getState(ip);
    const reqPath = req.path || req.url || '/';
    const ua = (req.headers && req.headers['user-agent']) || '';
    state.timestamps.push(now);
    state.timestamps = state.timestamps.filter(t => t >= now - WINDOW_MS);
    state.lastPath = reqPath;
    state.lastUa = String(ua).slice(0, 200);

    if (SUSPICIOUS_PATH_RE.test(reqPath)) {
      state.suspicious.push(now);
      state.suspicious = state.suspicious.filter(t => t >= now - WINDOW_MS);
    }

    const minuteCount = state.timestamps.filter(t => t >= now - MINUTE_MS).length;
    const rollingCount = state.timestamps.length;
    const suspiciousCount = state.suspicious.length;

    if (suspiciousCount >= this._config.suspiciousPathLimit) {
      this._block(ip, 'suspicious_path_scan', { count: suspiciousCount, path: reqPath, ua: state.lastUa });
      return { blocked: true, ip, reason: 'suspicious_path_scan', status: 429 };
    }
    if (minuteCount >= this._config.perMinuteLimit) {
      this._block(ip, 'per_minute_limit', { count: minuteCount, path: reqPath, ua: state.lastUa });
      return { blocked: true, ip, reason: 'per_minute_limit', status: 429 };
    }
    if (rollingCount >= this._config.rollingLimit) {
      this._block(ip, 'rolling_limit', { count: rollingCount, path: reqPath, ua: state.lastUa });
      return { blocked: true, ip, reason: 'rolling_limit', status: 429 };
    }

    if (now - this._lastPersist > 30000) this._persist();
    return { blocked: false, ip };
  }

  manualBlock(ip, reason = 'manual_block') {
    const normalizedIp = normalizeIp(ip);
    if (!normalizedIp || normalizedIp === 'unknown') {
      const err = new Error('无效 IP');
      err.code = 'INVALID_IP';
      throw err;
    }
    this._block(normalizedIp, reason, { manual: true });
    return this._blocked[normalizedIp];
  }

  unblock(ip) {
    const normalizedIp = normalizeIp(ip);
    const existed = !!this._blocked[normalizedIp];
    delete this._blocked[normalizedIp];
    if (existed) this._recordEvent('unblock', { ip: normalizedIp, reason: 'manual_unblock' });
    return existed;
  }

  updateConfig(input = {}) {
    const next = this._normalizeConfig({
      ...this._config,
      enabled: input.enabled,
      perMinuteLimit: input.perMinuteLimit,
      rollingLimit: input.rollingLimit,
      suspiciousPathLimit: input.suspiciousPathLimit,
      blockMs: input.blockMinutes !== undefined ? Number(input.blockMinutes) * MINUTE_MS : input.blockMs,
    });
    if (next.rollingLimit < next.perMinuteLimit) {
      const err = new Error('10分钟阈值不能小于1分钟阈值');
      err.code = 'INVALID_ACCESS_GUARD_CONFIG';
      throw err;
    }
    this._config = next;
    this._recordEvent('config_update', {
      reason: 'manual_config_update',
      config: {
        enabled: next.enabled,
        perMinuteLimit: next.perMinuteLimit,
        rollingLimit: next.rollingLimit,
        suspiciousPathLimit: next.suspiciousPathLimit,
        blockMinutes: Math.round(next.blockMs / MINUTE_MS),
      }
    });
    return this.getStatus().config;
  }

  getStatus() {
    const now = Date.now();
    this._cleanup(now);
    const recentIps = Array.from(this._hits.entries())
      .map(([ip, state]) => ({
        ip,
        location: ipLocationService.getDisplayLocation(ip),
        lastMinute: state.timestamps.filter(t => t >= now - MINUTE_MS).length,
        rolling: state.timestamps.filter(t => t >= now - WINDOW_MS).length,
        suspicious: state.suspicious.filter(t => t >= now - WINDOW_MS).length,
        lastPath: state.lastPath,
      }))
      .filter(item => item.rolling > 0)
      .sort((a, b) => b.rolling - a.rolling)
      .slice(0, 20);

    return {
      enabled: this._config.enabled,
      config: {
        perMinuteLimit: this._config.perMinuteLimit,
        rollingLimit: this._config.rollingLimit,
        suspiciousPathLimit: this._config.suspiciousPathLimit,
        blockMinutes: Math.round(this._config.blockMs / MINUTE_MS),
      },
      blocked: Object.values(this._blocked)
        .sort((a, b) => (b.blockedAt || 0) - (a.blockedAt || 0))
        .map(entry => ({
          ...entry,
          location: ipLocationService.getDisplayLocation(entry.ip),
          blockedAtText: entry.blockedAt ? fmtDateTime(entry.blockedAt) : '',
          expiresAtText: entry.expiresAt ? fmtDateTime(entry.expiresAt) : '手动封禁',
        })),
      recentIps,
      events: this._events.slice(-20).reverse().map(event => ({
        ...event,
        atText: event.at ? fmtDateTime(event.at) : '',
      })),
    };
  }
}

module.exports = new AccessGuardService();
