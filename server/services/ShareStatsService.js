'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const DATA_DIR = process.env.XIAKE_DATA_DIR || path.join(os.homedir(), '.xiake');
const STATS_FILE = process.env.SHARE_STATS_FILE || path.join(DATA_DIR, 'share-stats.json');
const MAX_DAYS = 30;
const VALID_ACTIONS = new Set(['save', 'copy', 'native']);
const VALID_PERIODS = new Set(['sunrise', 'sunset', 'unknown']);

function todayKey(iso = new Date().toISOString()) {
  return String(iso).slice(0, 10);
}

function emptyActionStats() {
  return { total: 0, save: 0, copy: 0, native: 0 };
}

function emptyDay() {
  return { ...emptyActionStats(), updatedAt: null };
}

function sanitizeAction(action) {
  return VALID_ACTIONS.has(action) ? action : 'copy';
}

function sanitizePeriod(period) {
  return VALID_PERIODS.has(period) ? period : 'unknown';
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

class ShareStatsService {
  constructor(filePath = STATS_FILE) {
    this.filePath = filePath;
    this.state = { total: emptyActionStats(), days: {}, recent: [], updatedAt: null };
    this._load();
  }

  _ensureDir() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
  }

  _load() {
    try {
      if (!fs.existsSync(this.filePath)) return;
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      if (parsed && typeof parsed === 'object') {
        this.state = {
          total: { ...emptyActionStats(), ...(parsed.total || {}) },
          days: parsed.days && typeof parsed.days === 'object' ? parsed.days : {},
          recent: Array.isArray(parsed.recent) ? parsed.recent.slice(0, 100) : [],
          updatedAt: parsed.updatedAt || null
        };
      }
    } catch (err) {
      console.warn('[ShareStatsService] 读取分享统计失败，使用空状态:', err.message);
    }
  }

  _save() {
    try {
      this._ensureDir();
      this._pruneDays();
      this.state.updatedAt = new Date().toISOString();
      const tmpFile = `${this.filePath}.tmp`;
      fs.writeFileSync(tmpFile, JSON.stringify(this.state, null, 2), 'utf8');
      fs.renameSync(tmpFile, this.filePath);
    } catch (err) {
      console.warn('[ShareStatsService] 写入分享统计失败:', err.message);
    }
  }

  _pruneDays() {
    const keys = Object.keys(this.state.days || {}).sort();
    if (keys.length <= MAX_DAYS) return;
    keys.slice(0, keys.length - MAX_DAYS).forEach((key) => delete this.state.days[key]);
  }

  _ensureDay(dayKey) {
    if (!this.state.days[dayKey]) this.state.days[dayKey] = emptyDay();
    return this.state.days[dayKey];
  }

  record({ action = 'copy', period = 'unknown', source = 'prediction', userAgent = '', ip = '' } = {}) {
    const safeAction = sanitizeAction(action);
    const safePeriod = sanitizePeriod(period);
    const now = new Date().toISOString();
    const dayKey = todayKey(now);
    const day = this._ensureDay(dayKey);

    this.state.total.total += 1;
    this.state.total[safeAction] += 1;
    day.total += 1;
    day[safeAction] += 1;
    day.updatedAt = now;

    this.state.recent.unshift({
      time: now,
      action: safeAction,
      period: safePeriod,
      source: String(source || 'prediction').slice(0, 40),
      userAgent: String(userAgent || '').slice(0, 140),
      ip: String(ip || '').slice(0, 64)
    });
    this.state.recent = this.state.recent.slice(0, 100);

    this._save();
    return this.getSummary();
  }

  getSummary({ days = 7 } = {}) {
    const limit = Math.min(Math.max(Number(days) || 7, 1), MAX_DAYS);
    const today = todayKey();
    const dayKeys = Object.keys(this.state.days || {}).sort().reverse().slice(0, limit);
    return {
      success: true,
      today: { day: today, ...emptyDay(), ...(this.state.days[today] || {}) },
      total: clone(this.state.total),
      days: dayKeys.map((key) => ({ day: key, ...emptyDay(), ...clone(this.state.days[key]) })),
      recent: clone(this.state.recent || []),
      updatedAt: this.state.updatedAt || null
    };
  }
}

module.exports = new ShareStatsService();
module.exports.ShareStatsService = ShareStatsService;
module.exports._test = { todayKey, sanitizeAction, sanitizePeriod, emptyActionStats, emptyDay };
