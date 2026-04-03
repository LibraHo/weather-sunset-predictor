'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT_DIR = path.join(os.homedir(), '.xiake');
const STATS_PATH = path.join(ROOT_DIR, 'api-daily-stats.json');
const EVENTS_DIR = path.join(ROOT_DIR, 'api-events');
const MAX_DAYS = 30;

const TYPES = ['grid', 'weather', 'gaode', 'gaode_tile'];

function _safeMkdir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function _todayKey(iso = new Date().toISOString()) {
  return String(iso).slice(0, 10);
}

function _clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function _newDay() {
  const calls = {};
  TYPES.forEach((t) => {
    calls[t] = { total: 0, ok: 0, fail: 0 };
  });
  return {
    calls,
    retries: {
      attempts: 0,
      requestsWithRetry: 0,
      recovered: 0,
      failedAfterRetry: 0,
      lastAt: null
    },
    updatedAt: null
  };
}

class ApiDailyStats {
  constructor() {
    this._state = { days: {}, updatedAt: null };
    this._loaded = false;
    this._requestsWithRetry = new Set();
  }

  _ensureLoaded() {
    if (this._loaded) return;
    this._loaded = true;

    try {
      _safeMkdir(ROOT_DIR);
      _safeMkdir(EVENTS_DIR);
      if (!fs.existsSync(STATS_PATH)) {
        this._save();
        return;
      }
      const raw = fs.readFileSync(STATS_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && parsed.days && typeof parsed.days === 'object') {
        this._state = parsed;
      }
    } catch (err) {
      console.warn('[ApiDailyStats] 读取失败，使用空状态:', err.message);
      this._state = { days: {}, updatedAt: null };
    }
  }

  _save() {
    _safeMkdir(ROOT_DIR);
    this._state.updatedAt = new Date().toISOString();
    this._pruneOldDays();
    fs.writeFileSync(STATS_PATH, JSON.stringify(this._state, null, 2), 'utf8');
  }

  _pruneOldDays() {
    const keys = Object.keys(this._state.days || {}).sort();
    if (keys.length <= MAX_DAYS) return;
    const remove = keys.slice(0, keys.length - MAX_DAYS);
    remove.forEach((k) => {
      delete this._state.days[k];
    });
  }

  _ensureDay(dayKey) {
    if (!this._state.days[dayKey]) {
      this._state.days[dayKey] = _newDay();
    }
    return this._state.days[dayKey];
  }

  _appendEvent(dayKey, event) {
    try {
      _safeMkdir(EVENTS_DIR);
      const fp = path.join(EVENTS_DIR, `api-events-${dayKey}.jsonl`);
      fs.appendFileSync(fp, JSON.stringify(event) + '\n', 'utf8');
    } catch (err) {
      console.warn('[ApiDailyStats] 事件写入失败:', err.message);
    }
  }

  recordCall(entry) {
    this._ensureLoaded();
    const dayKey = _todayKey(entry?.time || new Date().toISOString());
    const day = this._ensureDay(dayKey);
    const type = TYPES.includes(entry?.type) ? entry.type : 'grid';

    if (!day.calls[type]) {
      day.calls[type] = { total: 0, ok: 0, fail: 0 };
    }

    day.calls[type].total += 1;
    if (entry?.status >= 200 && entry?.status < 400) {
      day.calls[type].ok += 1;
    } else {
      day.calls[type].fail += 1;
    }
    day.updatedAt = new Date().toISOString();

    this._appendEvent(dayKey, {
      kind: 'call',
      time: entry?.time || new Date().toISOString(),
      type,
      endpoint: entry?.endpoint,
      status: entry?.status,
      durationMs: entry?.durationMs,
      requestId: entry?.requestId || null
    });

    this._save();
  }

  recordRetry(evt) {
    this._ensureLoaded();
    const dayKey = _todayKey(evt?.time || new Date().toISOString());
    const day = this._ensureDay(dayKey);

    day.retries.attempts += 1;
    day.retries.lastAt = evt?.time || new Date().toISOString();

    const reqKey = evt?.requestId || `${evt?.type || 'grid'}:${evt?.endpoint || ''}`;
    if (!this._requestsWithRetry.has(reqKey)) {
      this._requestsWithRetry.add(reqKey);
      day.retries.requestsWithRetry += 1;
    }

    this._appendEvent(dayKey, {
      kind: 'retry',
      time: evt?.time || new Date().toISOString(),
      type: evt?.type || 'grid',
      endpoint: evt?.endpoint || null,
      status: evt?.status || 0,
      waitMs: evt?.waitMs || 0,
      attempt: evt?.attempt || 0,
      requestId: evt?.requestId || null
    });

    this._save();
  }

  recordRetryOutcome(evt) {
    this._ensureLoaded();
    const dayKey = _todayKey(evt?.time || new Date().toISOString());
    const day = this._ensureDay(dayKey);

    if (evt?.outcome === 'recovered') {
      day.retries.recovered += 1;
    } else if (evt?.outcome === 'failed') {
      day.retries.failedAfterRetry += 1;
    }

    this._appendEvent(dayKey, {
      kind: 'retry_outcome',
      time: evt?.time || new Date().toISOString(),
      type: evt?.type || 'grid',
      endpoint: evt?.endpoint || null,
      outcome: evt?.outcome || null,
      attempts: evt?.attempts || 0,
      requestId: evt?.requestId || null
    });

    this._save();
  }

  getToday() {
    this._ensureLoaded();
    const key = _todayKey();
    const day = this._state.days[key] || _newDay();
    return { day: key, ..._clone(day) };
  }

  getDaily(days = 7) {
    this._ensureLoaded();
    const limit = Math.min(Math.max(Number(days) || 7, 1), 30);
    const keys = Object.keys(this._state.days || {}).sort().reverse().slice(0, limit);
    const list = keys.map((k) => ({ day: k, ..._clone(this._state.days[k]) }));
    return {
      days: list,
      updatedAt: this._state.updatedAt || null
    };
  }
}

module.exports = new ApiDailyStats();
