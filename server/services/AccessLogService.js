/**
 * server/services/AccessLogService.js - 轻量访问统计服务
 *
 * 记录访问日志，提供 PV/UV/IP 统计
 * 数据持久化到 ~/.xiake/access-stats.json
 */

'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(require('os').homedir(), '.xiake');
const DATA_FILE = path.join(DATA_DIR, 'access-stats.json');
const MAX_MEMORY_RECORDS = 500; // 内存中最多保留多少条原始记录
const MAX_PERSIST_DAYS = 30;    // 持久化保留多少天

class AccessLogService {
  constructor() {
    this._records = [];
    this._daily = {}; // { '2026-04-14': { pv: 0, uv: Set, ips: {} } }
    this._lastPersist = 0;
    this._loaded = false;
    this._ensureDir();
    this._load();
    // 定时持久化
    setInterval(() => this._persist(), 30000);
  }

  _ensureDir() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  _load() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        if (Array.isArray(raw.records)) {
          // 只加载最近 MAX_PERSIST_DAYS 天的记录
          const cutoff = Date.now() - MAX_PERSIST_DAYS * 24 * 60 * 60 * 1000;
          this._records = raw.records.filter(r => r.t >= cutoff).slice(-MAX_MEMORY_RECORDS);
        }
        if (raw.daily && typeof raw.daily === 'object') {
          // 恢复 daily 统计（uv 从数组恢复为 Set）
          const cutoffDate = this._fmtDate(Date.now() - MAX_PERSIST_DAYS * 24 * 60 * 60 * 1000);
          for (const [day, d] of Object.entries(raw.daily)) {
            if (day < cutoffDate) continue;
            this._daily[day] = {
              pv: d.pv || 0,
              uv: new Set(Array.isArray(d.uv) ? d.uv : []),
              ips: d.ips || {}
            };
          }
        }
      }
    } catch (e) {
      console.error('[AccessLogService] load failed:', e.message);
    }
    this._loaded = true;
  }

  _persist() {
    if (!this._loaded) return;
    try {
      const dailyOut = {};
      for (const [day, d] of Object.entries(this._daily)) {
        dailyOut[day] = {
          pv: d.pv,
          uv: Array.from(d.uv),
          ips: d.ips
        };
      }
      const payload = {
        updatedAt: Date.now(),
        records: this._records.slice(-MAX_MEMORY_RECORDS),
        daily: dailyOut
      };
      fs.writeFileSync(DATA_FILE, JSON.stringify(payload), 'utf8');
      this._lastPersist = Date.now();
    } catch (e) {
      console.error('[AccessLogService] persist failed:', e.message);
    }
  }

  _fmtDate(ts) {
    const d = new Date(ts);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  _fmtHour(ts) {
    const d = new Date(ts);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:00`;
  }

  /**
   * 记录一次访问
   */
  log(req) {
    const ip = this._getClientIP(req);
    const path = req.path || req.url || '/';
    const method = req.method || 'GET';
    const ua = (req.headers && req.headers['user-agent']) || '';
    const now = Date.now();
    const day = this._fmtDate(now);

    const record = { t: now, ip, path, method, ua: ua.slice(0, 200) };
    this._records.push(record);
    if (this._records.length > MAX_MEMORY_RECORDS * 2) {
      this._records = this._records.slice(-MAX_MEMORY_RECORDS);
    }

    // 更新 daily
    if (!this._daily[day]) {
      this._daily[day] = { pv: 0, uv: new Set(), ips: {} };
    }
    const d = this._daily[day];
    d.pv += 1;
    d.uv.add(ip);
    d.ips[ip] = (d.ips[ip] || 0) + 1;

    // 首次启动后或超过10秒未持久化，则写入磁盘
    if (now - this._lastPersist > 10000) {
      this._persist();
    }
  }

  _getClientIP(req) {
    const forwarded = req.headers && (req.headers['x-forwarded-for'] || req.headers['x-real-ip']);
    if (forwarded) {
      return String(forwarded).split(',')[0].trim();
    }
    return req.ip || req.connection?.remoteAddress || 'unknown';
  }

  /**
   * 获取访问统计
   */
  getStats() {
    const now = Date.now();
    const today = this._fmtDate(now);
    const yesterday = this._fmtDate(now - 86400000);

    const todayData = this._daily[today] || { pv: 0, uv: new Set(), ips: {} };
    const yestData = this._daily[yesterday] || { pv: 0, uv: new Set(), ips: {} };

    // 最近24小时每小时 PV
    const hourMap = {};
    for (let i = 0; i < 24; i++) {
      const h = this._fmtHour(now - i * 3600000);
      hourMap[h] = 0;
    }
    for (const r of this._records) {
      if (r.t >= now - 24 * 3600000) {
        const h = this._fmtHour(r.t);
        if (hourMap.hasOwnProperty(h)) hourMap[h] += 1;
      }
    }
    const hourly = Object.entries(hourMap).sort((a, b) => a[0].localeCompare(b[0])).map(([h, v]) => ({ hour: h, pv: v }));

    // Top IP（今日）
    const topIps = Object.entries(todayData.ips || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([ip, count]) => ({ ip, count }));

    // Top Path（今日，基于内存记录）
    const pathMap = {};
    for (const r of this._records) {
      if (this._fmtDate(r.t) === today) {
        pathMap[r.path] = (pathMap[r.path] || 0) + 1;
      }
    }
    const topPaths = Object.entries(pathMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([p, c]) => ({ path: p, count: c }));

    // 最近7天日报
    const dailyTrend = [];
    for (let i = 6; i >= 0; i--) {
      const d = this._fmtDate(now - i * 86400000);
      const dd = this._daily[d] || { pv: 0, uv: new Set(), ips: {} };
      dailyTrend.push({
        day: d,
        pv: dd.pv,
        uv: dd.uv.size || 0,
        ips: Object.keys(dd.ips).length
      });
    }

    return {
      today: {
        pv: todayData.pv,
        uv: todayData.uv.size || 0,
        ips: Object.keys(todayData.ips).length
      },
      yesterday: {
        pv: yestData.pv,
        uv: yestData.uv.size || 0,
        ips: Object.keys(yestData.ips).length
      },
      hourly,
      topIps,
      topPaths,
      dailyTrend
    };
  }
}

module.exports = new AccessLogService();
