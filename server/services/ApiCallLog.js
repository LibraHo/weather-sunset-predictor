/**
 * ApiCallLog - 记录所有外部 API 调用日志
 *
 * 类型：
 * - grid: 火烧云地图网格抓取（GridScoreService 调用 Open-Meteo）
 * - weather: 用户天气查询（前端 /api/weather/forecast）
 * - gaode: 高德地理编码
 * - gaode_tile: 高德瓦片代理
 *
 * 内存保留最近 500 条，不持久化（重启清空）
 */

const MAX_LOGS = 500;
const dailyStats = require('./ApiDailyStats');

class ApiCallLog {
  constructor() {
    this._logs = []; // { id, time, type, endpoint, params, status, durationMs, error? }
    this._counter = 0;
  }

  /**
   * 记录一次 API 调用
   * @param {'grid'|'weather'|'gaode'|'gaode_tile'} type
   * @param {string} endpoint
   * @param {object} params
   * @param {number} status - HTTP status code 或 0 表示网络错误
   * @param {number} durationMs
   * @param {string} [error]
   */
  add(type, endpoint, params, status, durationMs, error, extra = {}) {
    this._counter++;
    const entry = {
      id: this._counter,
      time: new Date().toISOString(),
      type,
      endpoint,
      params: _summarizeParams(params),
      status,
      durationMs: Math.round(durationMs),
      error: error || null,
      requestId: extra.requestId || null,
      retryCount: Number(extra.retryCount) || 0,
      reconnected: Boolean(extra.reconnected)
    };
    this._logs.push(entry);
    if (this._logs.length > MAX_LOGS) {
      this._logs = this._logs.slice(-MAX_LOGS);
    }

    dailyStats.recordCall(entry);
    return entry;
  }

  /**
   * 获取日志列表
   * @param {object} opts
   * @param {'grid'|'weather'|'gaode'|'gaode_tile'|'grid,weather'|string} [opts.type] - 按类型过滤（逗号分隔支持多类型）
   * @param {number} [opts.limit=100] - 最近 N 条
   * @param {number} [opts.offset=0]
   */
  getLogs({ type, limit = 100, offset = 0 } = {}) {
    let filtered = this._logs;
    if (type) {
      const types = type.split(',').map(t => t.trim()).filter(Boolean);
      if (types.length > 0) {
        filtered = filtered.filter(l => types.includes(l.type));
      }
    }
    // 最新的在前
    const reversed = filtered.slice().reverse();
    return reversed.slice(offset, offset + limit);
  }

  /**
   * 获取统计摘要
   */
  getSummary() {
    const now = Date.now();
    const oneHour = 3600 * 1000;
    const oneDay = 24 * oneHour;

    const byType = (t) => this._logs.filter(l => l.type === t);
    const grid = byType('grid');
    const weather = byType('weather');
    const gaode = byType('gaode');
    const gaodeTile = byType('gaode_tile');

    const countLast = (arr, ms) => arr.filter(l => now - new Date(l.time).getTime() < ms).length;
    const avgDuration = (arr, ms) => {
      const recent = arr.filter(l => now - new Date(l.time).getTime() < ms && l.status >= 200 && l.status < 400);
      if (recent.length === 0) return null;
      return Math.round(recent.reduce((s, l) => s + l.durationMs, 0) / recent.length);
    };
    const errorCount = (arr, ms) => arr.filter(l => now - new Date(l.time).getTime() < ms && (l.status === 0 || l.status >= 400)).length;

    return {
      grid: {
        total: grid.length,
        lastHour: countLast(grid, oneHour),
        lastDay: countLast(grid, oneDay),
        avgDurationLastHour: avgDuration(grid, oneHour),
        errorsLastHour: errorCount(grid, oneHour)
      },
      weather: {
        total: weather.length,
        lastHour: countLast(weather, oneHour),
        lastDay: countLast(weather, oneDay),
        avgDurationLastHour: avgDuration(weather, oneHour),
        errorsLastHour: errorCount(weather, oneHour)
      },
      gaode: {
        total: gaode.length,
        lastHour: countLast(gaode, oneHour),
        lastDay: countLast(gaode, oneDay),
        avgDurationLastHour: avgDuration(gaode, oneHour),
        errorsLastHour: errorCount(gaode, oneHour)
      },
      gaodeTile: {
        total: gaodeTile.length,
        lastHour: countLast(gaodeTile, oneHour),
        lastDay: countLast(gaodeTile, oneDay),
        avgDurationLastHour: avgDuration(gaodeTile, oneHour),
        errorsLastHour: errorCount(gaodeTile, oneHour)
      },
      lastHourTotal: countLast(this._logs, oneHour)
    };
  }

  /**
   * 创建一个计时器，用于包装 API 调用
   * @param {'grid'|'weather'|'gaode'|'gaode_tile'} type
   * @param {string} endpoint
   * @param {object} params
   * @returns {{ ok: function(status), fail: function(error, status?) }}
   */
  track(type, endpoint, params) {
    const start = Date.now();
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    let retryCount = 0;

    return {
      requestId,
      retry: ({ status = 0, waitMs = 0, attempt = retryCount + 1 } = {}) => {
        retryCount += 1;
        dailyStats.recordRetry({
          time: new Date().toISOString(),
          type,
          endpoint,
          status,
          waitMs,
          attempt,
          requestId
        });
      },
      ok: (status) => {
        if (retryCount > 0) {
          dailyStats.recordRetryOutcome({
            time: new Date().toISOString(),
            type,
            endpoint,
            outcome: 'recovered',
            attempts: retryCount,
            requestId
          });
        }
        this.add(type, endpoint, params, status, Date.now() - start, null, {
          requestId,
          retryCount,
          reconnected: retryCount > 0
        });
      },
      fail: (error, status = 0) => {
        if (retryCount > 0) {
          dailyStats.recordRetryOutcome({
            time: new Date().toISOString(),
            type,
            endpoint,
            outcome: 'failed',
            attempts: retryCount,
            requestId
          });
        }
        this.add(type, endpoint, params, status, Date.now() - start, typeof error === 'string' ? error : error?.message || 'unknown', {
          requestId,
          retryCount,
          reconnected: false
        });
      }
    };
  }

  /**
   * 获取今日每小时统计
   * @returns {Array<{hour: number, grid: number, weather: number, gaode: number, gaodeTile: number, total: number}>}
   */
  getHourlyStats() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const hours = [];

    for (let h = 0; h < 24; h++) {
      const hourStart = todayStart + h * 3600 * 1000;
      const hourEnd = hourStart + 3600 * 1000;

      const inHour = (log) => {
        const t = new Date(log.time).getTime();
        return t >= hourStart && t < hourEnd;
      };

      const grid = this._logs.filter(l => l.type === 'grid' && inHour(l)).length;
      const weather = this._logs.filter(l => l.type === 'weather' && inHour(l)).length;
      const gaode = this._logs.filter(l => l.type === 'gaode' && inHour(l)).length;
      const gaodeTile = this._logs.filter(l => l.type === 'gaode_tile' && inHour(l)).length;

      hours.push({
        hour: h,
        grid,
        weather,
        gaode,
        gaodeTile,
        total: grid + weather + gaode + gaodeTile
      });
    }

    return hours;
  }
}

function _summarizeParams(params) {
  if (!params || typeof params !== 'object') return params;
  const s = {};
  if (params.latitude != null) s.lat = _truncate(String(params.latitude), 60);
  if (params.longitude != null) s.lon = _truncate(String(params.longitude), 60);
  if (params.hours) s.hours = params.hours;
  if (params.forecast_days) s.forecastDays = params.forecast_days;
  if (params.models) s.model = params.models;
  if (params.address) s.address = _truncate(String(params.address), 80);
  if (params.z != null) s.z = params.z;
  if (params.x != null) s.x = params.x;
  if (params.y != null) s.y = params.y;
  if (params.lat != null) s.lat = _truncate(String(params.lat), 60);
  if (params.lon != null) s.lon = _truncate(String(params.lon), 60);
  return s;
}

function _truncate(str, max) {
  return str.length > max ? str.slice(0, max) + '...' : str;
}

const log = new ApiCallLog();
module.exports = log;
