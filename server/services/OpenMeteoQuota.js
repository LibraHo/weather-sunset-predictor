/**
 * OpenMeteoQuota.js - Open-Meteo API 调用次数统计与限流保护
 *
 * 功能：
 * 1. 统计每日 API 调用次数（按 UTC 日期重置）
 * 2. 达到软上限时暂停格点抓取（保留基础天气额度）
 * 3. 持久化到磁盘，重启不丢失
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const QUOTA_FILE = path.join(os.homedir(), '.xiake', 'openmeteo-quota.json');
const DAILY_LIMIT = 10000;         // Open-Meteo 免费版每日上限
const SOFT_LIMIT = 9000;           // 软上限：达到后暂停格点抓取
const RESERVE_FOR_WEATHER = 1000;  // 为基础天气保留的额度

class OpenMeteoQuota {
  constructor() {
    this._date = null;   // 当前 UTC 日期字符串
    this._count = 0;     // 今日已用次数
    this._load();
  }

  _todayUTC() {
    return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  }

  _load() {
    try {
      if (fs.existsSync(QUOTA_FILE)) {
        const data = JSON.parse(fs.readFileSync(QUOTA_FILE, 'utf-8'));
        if (data.date === this._todayUTC()) {
          this._date = data.date;
          this._count = data.count || 0;
          console.log(`[OpenMeteoQuota] 加载今日用量: ${this._count}/${DAILY_LIMIT}`);
          return;
        }
      }
    } catch (_) {}
    this._reset();
  }

  _reset() {
    this._date = this._todayUTC();
    this._count = 0;
    this._save();
  }

  _save() {
    try {
      const dir = path.dirname(QUOTA_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(QUOTA_FILE, JSON.stringify({ date: this._date, count: this._count }), 'utf-8');
    } catch (e) {
      console.warn('[OpenMeteoQuota] 保存失败:', e.message);
    }
  }

  // 检查日期是否已跨天，自动重置
  _checkReset() {
    if (this._date !== this._todayUTC()) {
      console.log('[OpenMeteoQuota] 新的一天，重置计数');
      this._reset();
    }
  }

  /**
   * 记录一次 API 调用（n 个请求）
   * @param {number} n - 请求数量（默认 1）
   */
  record(n = 1) {
    this._checkReset();
    this._count += n;
    if (this._count % 100 === 0 || this._count > SOFT_LIMIT) {
      console.log(`[OpenMeteoQuota] 今日用量: ${this._count}/${DAILY_LIMIT}`);
    }
    this._save();
  }

  /**
   * 是否允许格点抓取（未到软上限）
   * @returns {boolean}
   */
  canFetchGrid() {
    this._checkReset();
    return this._count < SOFT_LIMIT;
  }

  /**
   * 是否允许基础天气查询（保留 RESERVE_FOR_WEATHER 额度）
   * @returns {boolean}
   */
  canFetchWeather() {
    this._checkReset();
    return this._count < DAILY_LIMIT - 100; // 留 100 次缓冲
  }

  /**
   * 获取当前统计信息
   */
  getStats() {
    this._checkReset();
    return {
      date: this._date,
      count: this._count,
      limit: DAILY_LIMIT,
      softLimit: SOFT_LIMIT,
      remaining: Math.max(0, DAILY_LIMIT - this._count),
      gridAllowed: this.canFetchGrid(),
      weatherAllowed: this.canFetchWeather(),
      usagePercent: ((this._count / DAILY_LIMIT) * 100).toFixed(1) + '%'
    };
  }
}

// 单例
const quota = new OpenMeteoQuota();
module.exports = quota;
