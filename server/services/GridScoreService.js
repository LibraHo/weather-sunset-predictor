/**
 * GridScoreService - 晚霞评分热力地图网格服务（Phase 16）
 *
 * 职责：
 * 1. 生成中国区域 5° 间隔网格坐标
 * 2. 批量获取天气数据并运行晚霞预测算法
 * 3. 维护缓存（内存 + 文件持久化）
 * 4. 频控保护，避免重复调用
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const orchestrator = require('./ProviderOrchestrator');
const { calculateEnhancedPrediction } = require('./EnhancedPredictionService');

// 中国区域范围（5° 间隔）
const CHINA_BOUNDS = {
  lonMin: 73,
  lonMax: 135,
  latMin: 18,
  latMax: 53,
  step: 5
};

// 并发限制
const CONCURRENCY_LIMIT = 10;

// 缓存最大年龄（1小时）
const DEFAULT_MAX_AGE_MS = 60 * 60 * 1000;

const SUPPORTED_PERIODS = ['sunrise', 'sunset'];
const DEFAULT_PERIOD = 'sunset';

// 频控：60分钟内最多触发一次手动刷新
const MANUAL_REFRESH_COOLDOWN_MS = 60 * 60 * 1000;

// 持久化路径
const CACHE_DIR = path.join(os.homedir(), '.xiake');
const CACHE_FILE = path.join(CACHE_DIR, 'grid-cache.json');

class GridScoreService {
  constructor() {
    this._cache = {
      sunrise: null,
      sunset: null
    }; // { sunrise: { updatedAt, gridPoints }, sunset: { ... } }
    this._lastManualRefresh = {
      sunrise: 0,
      sunset: 0
    };
    this._refreshingByPeriod = {
      sunrise: false,
      sunset: false
    };
    this._loadFromDisk();
  }

  normalizePeriod(period = DEFAULT_PERIOD) {
    const safe = typeof period === 'string' ? period.toLowerCase() : DEFAULT_PERIOD;
    return SUPPORTED_PERIODS.includes(safe) ? safe : DEFAULT_PERIOD;
  }

  /**
   * 生成中国区域网格坐标列表
   * @returns {{ lat: number, lon: number }[]}
   */
  generateGrid() {
    const points = [];
    for (let lat = CHINA_BOUNDS.latMin; lat <= CHINA_BOUNDS.latMax; lat += CHINA_BOUNDS.step) {
      for (let lon = CHINA_BOUNDS.lonMin; lon <= CHINA_BOUNDS.lonMax; lon += CHINA_BOUNDS.step) {
        points.push({ lat: parseFloat(lat.toFixed(1)), lon: parseFloat(lon.toFixed(1)) });
      }
    }
    return points;
  }

  /**
   * 并发批量获取天气数据并评分
   * @param {{ lat, lon }[]} gridPoints
   * @param {Date} date
   * @param {'sunrise'|'sunset'} period
   * @returns {Promise<{ lat, lon, score, quality, breakdown }[]>}
   */
  async fetchAndScore(gridPoints, date = new Date(), period = DEFAULT_PERIOD) {
    const results = [];
    const queue = [...gridPoints];

    // 并发控制：每次最多 CONCURRENCY_LIMIT 个请求
    const worker = async () => {
      while (queue.length > 0) {
        const point = queue.shift();
        if (!point) break;
        try {
          const weatherRaw = await orchestrator.fetchWeatherData(point.lat, point.lon, 24);
          // 取最近时刻的天气数据
          const weatherData = Array.isArray(weatherRaw) ? weatherRaw[0] : (weatherRaw.data?.[0] || weatherRaw);
          if (!weatherData) throw new Error('no weather data');

          const prediction = calculateEnhancedPrediction(weatherData, date, point.lat, point.lon, this.normalizePeriod(period));
          results.push({
            lat: point.lat,
            lon: point.lon,
            score: prediction.score,
            quality: prediction.quality,
            breakdown: prediction.breakdown || null
          });
        } catch (err) {
          // 单点失败不影响其他点
          results.push({
            lat: point.lat,
            lon: point.lon,
            score: null,
            quality: 'error',
            error: err.message
          });
        }
      }
    };

    // 启动 CONCURRENCY_LIMIT 个并发 worker
    const workers = Array.from({ length: Math.min(CONCURRENCY_LIMIT, gridPoints.length) }, worker);
    await Promise.all(workers);

    return results;
  }

  /**
   * 获取缓存数据
   * @param {'sunrise'|'sunset'} period
   * @returns {{ updatedAt: string, gridPoints: [], stale: boolean } | null}
   */
  getCache(period = DEFAULT_PERIOD) {
    const safePeriod = this.normalizePeriod(period);
    const periodCache = this._cache?.[safePeriod] || null;
    if (!periodCache) return null;

    const age = Date.now() - new Date(periodCache.updatedAt).getTime();
    return {
      ...periodCache,
      stale: age > DEFAULT_MAX_AGE_MS,
      period: safePeriod
    };
  }

  /**
   * 如果缓存过期则刷新
   * @param {number} maxAgeMs
   * @param {'sunrise'|'sunset'} period
   * @returns {Promise<void>}
   */
  async refreshIfStale(maxAgeMs = DEFAULT_MAX_AGE_MS, period = DEFAULT_PERIOD) {
    const safePeriod = this.normalizePeriod(period);
    if (this._refreshingByPeriod[safePeriod]) return;
    const cache = this.getCache(safePeriod);
    if (cache) {
      const age = Date.now() - new Date(cache.updatedAt).getTime();
      if (age <= maxAgeMs) return;
    }
    await this._doRefresh(safePeriod);
  }

  /**
   * 手动触发刷新（有频控保护）
   * @param {'sunrise'|'sunset'} period
   * @returns {{ ok: boolean, message: string }}
   */
  async manualRefresh(period = DEFAULT_PERIOD) {
    const safePeriod = this.normalizePeriod(period);
    const now = Date.now();
    const lastRefresh = this._lastManualRefresh[safePeriod] || 0;
    if (now - lastRefresh < MANUAL_REFRESH_COOLDOWN_MS) {
      const remaining = Math.ceil((MANUAL_REFRESH_COOLDOWN_MS - (now - lastRefresh)) / 60000);
      return { ok: false, message: `频控保护：请 ${remaining} 分钟后再试` };
    }
    this._lastManualRefresh[safePeriod] = now;
    await this._doRefresh(safePeriod);
    return { ok: true, message: `${safePeriod} 刷新成功` };
  }

  /**
   * 内部执行刷新
   * @param {'sunrise'|'sunset'} period
   */
  async _doRefresh(period = DEFAULT_PERIOD) {
    const safePeriod = this.normalizePeriod(period);
    if (this._refreshingByPeriod[safePeriod]) return;
    this._refreshingByPeriod[safePeriod] = true;
    try {
      console.log(`[GridScoreService] 开始刷新网格评分 (${safePeriod})...`);
      const gridPoints = this.generateGrid();
      const scored = await this.fetchAndScore(gridPoints, new Date(), safePeriod);
      this._cache[safePeriod] = {
        updatedAt: new Date().toISOString(),
        gridPoints: scored
      };
      this._saveToDisk();
      console.log(`[GridScoreService] 刷新完成 (${safePeriod})，共 ${scored.length} 个网格点`);
    } catch (err) {
      console.error(`[GridScoreService] 刷新失败 (${safePeriod}):`, err.message);
    } finally {
      this._refreshingByPeriod[safePeriod] = false;
    }
  }

  /**
   * 从磁盘加载缓存
   */
  _loadFromDisk() {
    try {
      if (!fs.existsSync(CACHE_FILE)) {
        return;
      }

      const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
      const parsed = JSON.parse(raw);

      // 兼容旧格式：{ updatedAt, gridPoints }
      if (parsed && parsed.updatedAt && Array.isArray(parsed.gridPoints)) {
        this._cache = {
          sunrise: null,
          sunset: {
            updatedAt: parsed.updatedAt,
            gridPoints: parsed.gridPoints
          }
        };
        console.log(`[GridScoreService] 从磁盘加载旧版 sunset 缓存，更新于 ${parsed.updatedAt}`);
        return;
      }

      const sunriseCache = parsed?.sunrise;
      const sunsetCache = parsed?.sunset;
      this._cache = {
        sunrise: sunriseCache && sunriseCache.updatedAt ? sunriseCache : null,
        sunset: sunsetCache && sunsetCache.updatedAt ? sunsetCache : null
      };
      console.log('[GridScoreService] 从磁盘加载分时段缓存:', {
        sunrise: this._cache.sunrise?.updatedAt || null,
        sunset: this._cache.sunset?.updatedAt || null
      });
    } catch (err) {
      console.warn('[GridScoreService] 磁盘缓存读取失败:', err.message);
    }
  }

  /**
   * 持久化缓存到磁盘
   */
  _saveToDisk() {
    try {
      if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
      }
      fs.writeFileSync(CACHE_FILE, JSON.stringify(this._cache), 'utf-8');
    } catch (err) {
      console.warn('[GridScoreService] 磁盘缓存写入失败:', err.message);
    }
  }
}

module.exports = new GridScoreService();
module.exports.GridScoreService = GridScoreService;
module.exports.CHINA_BOUNDS = CHINA_BOUNDS;
module.exports.SUPPORTED_PERIODS = SUPPORTED_PERIODS;
module.exports.DEFAULT_PERIOD = DEFAULT_PERIOD;
