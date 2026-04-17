/**
 * GridScoreService - 晚霞评分热力地图网格服务（Phase 16）
 *
 * 职责：
 * 1. 生成中国区域网格坐标（步长来自配置）
 * 2. 批量获取天气数据并运行晚霞预测算法
 * 3. 维护缓存（内存 + 文件持久化）
 * 4. 频控保护，避免重复调用
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const orchestrator = require('./ProviderOrchestrator');
const quota = require('./OpenMeteoQuota');
const { calculateEnhancedPrediction } = require('./EnhancedPredictionService');
const SunCalculator = require('../utils/SunCalculator');

const config = require('../config/gridscore.config.js');

// 中国区域范围
const CHINA_BOUNDS = config.grid.bounds;

// 并发限制
const CONCURRENCY_LIMIT = config.concurrency.limit;

// 批量抓取大小
const BATCH_SIZE = config.batch?.batchSize || 100;
// 批次间隔（毫秒）
const BATCH_DELAY_MS = config.batch?.delayMs || 0;

// 预测时长（小时）
const FORECAST_HOURS = config.api?.forecastHours || 24;

// 缓存最大年龄
const DEFAULT_MAX_AGE_MS = config.cache.maxAgeMs;

// 频控：手动刷新冷却时间
const MANUAL_REFRESH_COOLDOWN_MS = config.cache.manualRefreshCooldownMs;

// 持久化路径
const CACHE_DIR = config.cache.cacheDir;
const CACHE_FILE = path.join(CACHE_DIR, config.cache.cacheFile);
const JOB_STATE_FILE = path.join(CACHE_DIR, config.cache.jobStateFile || 'grid-job-state.json');

// 支持的时段
const SUPPORTED_PERIODS = ['sunrise', 'sunset'];
const DEFAULT_PERIOD = 'sunset';

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
    this._jobStatus = {
      sunrise: this._createIdleStatus('sunrise'),
      sunset: this._createIdleStatus('sunset')
    };
    this._loadFromDisk();
  }

  normalizePeriod(period = DEFAULT_PERIOD) {
    const safe = typeof period === 'string' ? period.toLowerCase() : DEFAULT_PERIOD;
    return SUPPORTED_PERIODS.includes(safe) ? safe : DEFAULT_PERIOD;
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  _createIdleStatus(period) {
    return {
      period,
      running: false,
      startedAt: null,
      finishedAt: null,
      totalPoints: 0,
      completedPoints: 0,
      successPoints: 0,
      errorPoints: 0,
      totalBatches: 0,
      completedBatches: 0,
      currentBatch: 0,
      batchSize: BATCH_SIZE,
      concurrency: CONCURRENCY_LIMIT,
      gridStep: CHINA_BOUNDS.step,
      etaSeconds: null,
      lastError: null,
      updatedAt: new Date().toISOString(),
      batches: [] // 每个批次的状态详情
    };
  }

  getJobStatus(period = DEFAULT_PERIOD) {
    const safePeriod = this.normalizePeriod(period);
    return {
      ...(this._jobStatus?.[safePeriod] || this._createIdleStatus(safePeriod))
    };
  }

  _setJobStatus(period, patch = {}) {
    const safePeriod = this.normalizePeriod(period);
    const prev = this._jobStatus?.[safePeriod] || this._createIdleStatus(safePeriod);
    this._jobStatus[safePeriod] = {
      ...prev,
      ...patch,
      period: safePeriod,
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * 生成中国区域网格坐标列表
   * @returns {{ lat: number, lon: number }[]}
   */
  generateGrid() {
    const step = CHINA_BOUNDS.step;
    const regions = Array.isArray(config.grid?.regions) && config.grid.regions.length > 0
      ? config.grid.regions
      : [CHINA_BOUNDS];
    const points = [];
    const seen = new Set();

    for (const region of regions) {
      for (let lat = region.latMin; lat <= region.latMax; lat += step) {
        for (let lon = region.lonMin; lon <= region.lonMax; lon += step) {
          const p = { lat: parseFloat(lat.toFixed(1)), lon: parseFloat(lon.toFixed(1)) };
          const key = `${p.lat},${p.lon}`;
          if (!seen.has(key)) {
            seen.add(key);
            points.push(p);
          }
        }
      }
    }
    return points;
  }

  _loadJobState() {
    try {
      if (!fs.existsSync(JOB_STATE_FILE)) return {};
      const raw = fs.readFileSync(JOB_STATE_FILE, 'utf-8');
      return JSON.parse(raw) || {};
    } catch (err) {
      console.warn('[GridScoreService] 读取断点状态失败:', err.message);
      return {};
    }
  }

  _saveJobState(state = {}) {
    try {
      if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
      }
      fs.writeFileSync(JOB_STATE_FILE, JSON.stringify(state), 'utf-8');
    } catch (err) {
      console.warn('[GridScoreService] 写入断点状态失败:', err.message);
    }
  }

  _clearJobState(period = DEFAULT_PERIOD) {
    const safePeriod = this.normalizePeriod(period);
    const state = this._loadJobState();
    if (state?.[safePeriod]) {
      delete state[safePeriod];
      this._saveJobState(state);
    }
  }

  /**
   * 并发批量获取天气数据并评分
   * @param {{ lat, lon }[]} gridPoints
   * @param {Date} date
   * @param {'sunrise'|'sunset'} period
   * @returns {Promise<{ lat, lon, score, quality, breakdown }[]>}
   */
  async fetchAndScore(gridPoints, date = new Date(), period = DEFAULT_PERIOD) {
    const safePeriod = this.normalizePeriod(period);
    const dateKey = new Date().toISOString().slice(0, 10);
    const batches = [];

    for (let i = 0; i < gridPoints.length; i += BATCH_SIZE) {
      batches.push(gridPoints.slice(i, i + BATCH_SIZE));
    }

    // 尝试断点恢复（同日期 + 同网格规模）
    const jobState = this._loadJobState();
    const checkpoint = jobState?.[safePeriod];
    const canResume = checkpoint
      && checkpoint.dateKey === dateKey
      && checkpoint.totalPoints === gridPoints.length
      && Array.isArray(checkpoint.results)
      && Array.isArray(checkpoint.completedBatchIndexes);

    const resumedBatchIndexes = new Set(canResume ? checkpoint.completedBatchIndexes : []);
    const resumedResults = canResume ? checkpoint.results : [];

    // 初始化批次状态
    const batchStatuses = batches.map((batch, idx) => ({
      index: idx + 1,
      status: resumedBatchIndexes.has(idx) ? 'success' : 'pending', // pending/running/retrying/success/failed
      pointsCount: batch.length,
      successCount: resumedBatchIndexes.has(idx)
        ? resumedResults.filter(r => r.__batchIndex === idx && Number.isFinite(r.score)).length
        : 0,
      errorCount: resumedBatchIndexes.has(idx)
        ? resumedResults.filter(r => r.__batchIndex === idx && !Number.isFinite(r.score)).length
        : 0,
      startedAt: resumedBatchIndexes.has(idx) ? checkpoint.updatedAt : null,
      finishedAt: resumedBatchIndexes.has(idx) ? checkpoint.updatedAt : null,
      errorMessage: null
    }));

    const resumedCompletedPoints = resumedResults.length;
    const resumedSuccessPoints = resumedResults.filter(item => Number.isFinite(item.score)).length;
    const resumedErrorPoints = resumedCompletedPoints - resumedSuccessPoints;

    this._setJobStatus(safePeriod, {
      running: true,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      totalPoints: gridPoints.length,
      completedPoints: resumedCompletedPoints,
      successPoints: resumedSuccessPoints,
      errorPoints: resumedErrorPoints,
      totalBatches: batches.length,
      completedBatches: resumedBatchIndexes.size,
      currentBatch: 0,
      batchSize: BATCH_SIZE,
      concurrency: CONCURRENCY_LIMIT,
      gridStep: CHINA_BOUNDS.step,
      etaSeconds: null,
      lastError: null,
      batches: batchStatuses
    });

    const allResults = resumedResults.map(({ __batchIndex, ...rest }) => rest);

    const processBatch = async (batch, batchIndex) => {
      const points = batch.map(point => ({ lat: point.lat, lon: point.lon }));
      const scoredBatch = [];

      // 更新批次状态为 running
      const updateBatchStatus = (patch) => {
        const status = this.getJobStatus(safePeriod);
        const updatedBatches = [...(status.batches || [])];
        if (updatedBatches[batchIndex]) {
          updatedBatches[batchIndex] = { ...updatedBatches[batchIndex], ...patch };
          this._setJobStatus(safePeriod, { batches: updatedBatches });
        }
      };

      updateBatchStatus({ status: 'running', startedAt: new Date().toISOString() });

      let retryCount = 0;
      const maxRetries = 3;

      while (retryCount <= maxRetries) {
        try {
          const weatherMap = await orchestrator.fetchWeatherDataBatch(points, FORECAST_HOURS);
          console.log(`[GridScoreService] 批量请求完成: batch=${batchIndex + 1}/${batches.length}, points=${points.length}, hours=${FORECAST_HOURS}`);

          for (const point of batch) {
            try {
              const key = `${point.lat},${point.lon}`;
              const weatherRaw = weatherMap?.[key];

              // 使用该点的日落/日出时间作为预测目标时间，避免当前时刻几何不可行误判
              // 如果已经过了今天的日出/日落，就预测明天的
              let predictionDate = date;
              try {
                const now = new Date();
                if (safePeriod === 'sunset') {
                  const todaySunset = SunCalculator.getSunsetTime(date, point.lat, point.lon);
                  if (now > todaySunset) {
                    const tomorrow = new Date(date);
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    predictionDate = SunCalculator.getSunsetTime(tomorrow, point.lat, point.lon);
                  } else {
                    predictionDate = todaySunset;
                  }
                } else {
                  const todaySunrise = SunCalculator.getSunriseTime(date, point.lat, point.lon);
                  if (now > todaySunrise) {
                    const tomorrow = new Date(date);
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    predictionDate = SunCalculator.getSunriseTime(tomorrow, point.lat, point.lon);
                  } else {
                    predictionDate = todaySunrise;
                  }
                }
              } catch (sunErr) {
                console.warn(`[GridScoreService] 无法计算 ${point.lat},${point.lon} 日出落时间:`, sunErr.message);
              }

              const hourly = Array.isArray(weatherRaw?.data)
                ? weatherRaw.data
                : (Array.isArray(weatherRaw) ? weatherRaw : []);
              if (hourly.length === 0) {
                throw new Error('no weather data');
              }

              const toTs = (v) => {
                if (Number.isFinite(v)) return v;
                const t = new Date(v).getTime();
                return Number.isFinite(t) ? t : null;
              };

              let weatherData = hourly[0];
              const refTs = predictionDate instanceof Date ? predictionDate.getTime() : null;
              if (Number.isFinite(refTs)) {
                weatherData = hourly.reduce((closest, current) => {
                  const cTs = toTs(closest?.timestamp ?? closest?.time);
                  const nTs = toTs(current?.timestamp ?? current?.time);
                  const cDiff = Number.isFinite(cTs) ? Math.abs(cTs - refTs) : Number.POSITIVE_INFINITY;
                  const nDiff = Number.isFinite(nTs) ? Math.abs(nTs - refTs) : Number.POSITIVE_INFINITY;
                  return nDiff < cDiff ? current : closest;
                }, hourly[0]);
              }

              const prediction = calculateEnhancedPrediction(weatherData, predictionDate, point.lat, point.lon, safePeriod);
              scoredBatch.push({
                lat: point.lat,
                lon: point.lon,
                score: prediction.score,
                quality: prediction.quality,
                breakdown: prediction.breakdown || null
              });
            } catch (err) {
              scoredBatch.push({
                lat: point.lat,
                lon: point.lon,
                score: null,
                quality: 'error',
                error: err.message,
                breakdown: null
              });
            }
          }

          // 成功完成批次
          const successCount = scoredBatch.filter(item => Number.isFinite(item.score)).length;
          const errorCount = scoredBatch.length - successCount;
          updateBatchStatus({
            status: 'success',
            finishedAt: new Date().toISOString(),
            successCount,
            errorCount
          });

          // 跳出重试循环
          break;
        } catch (err) {
          retryCount++;
          const is429 = err?.response?.status === 429 || err?.message?.includes('429');

          if (is429 && retryCount <= maxRetries) {
            // 429 错误，进入 retrying 状态
            const retryAfterMs = err?.response?.headers?.['retry-after']
              ? parseInt(err.response.headers['retry-after'], 10) * 1000
              : 60 * 1000;
            console.warn(`[GridScoreService] batch=${batchIndex + 1} 遇到 429，${retryCount}/${maxRetries} 次重试，等待 ${retryAfterMs}ms`);
            updateBatchStatus({ status: 'retrying', errorMessage: `429 retry ${retryCount}/${maxRetries}` });
            await this._sleep(retryAfterMs);
            continue;
          }

          // 其他错误或重试耗尽
          console.error(`[GridScoreService] 批量请求失败: batch=${batchIndex + 1}/${batches.length}, points=${points.length}`, err.message);
          this._setJobStatus(safePeriod, { lastError: err.message, currentBatch: batchIndex + 1 });

          // 标记批次失败
          updateBatchStatus({
            status: 'failed',
            finishedAt: new Date().toISOString(),
            errorMessage: err.message
          });

          // 填充错误结果
          for (const point of batch) {
            scoredBatch.push({
              lat: point.lat,
              lon: point.lon,
              score: null,
              quality: 'error',
              error: err.message,
              breakdown: null
            });
          }
          break;
        }
      }

      const successCount = scoredBatch.filter(item => Number.isFinite(item.score)).length;
      const errorCount = scoredBatch.length - successCount;
      const status = this.getJobStatus(safePeriod);
      const completedBatches = status.completedBatches + 1;
      const completedPoints = status.completedPoints + scoredBatch.length;
      const elapsedSec = status.startedAt ? Math.max(1, Math.floor((Date.now() - new Date(status.startedAt).getTime()) / 1000)) : null;
      const pointsPerSec = elapsedSec ? completedPoints / elapsedSec : null;
      const remainingPoints = Math.max(0, status.totalPoints - completedPoints);
      const etaSeconds = pointsPerSec ? Math.ceil(remainingPoints / pointsPerSec) : null;

      this._setJobStatus(safePeriod, {
        currentBatch: batchIndex + 1,
        completedBatches,
        completedPoints,
        successPoints: status.successPoints + successCount,
        errorPoints: status.errorPoints + errorCount,
        etaSeconds
      });

      // 写入断点状态（批次级）
      const latestState = this._loadJobState();
      const prev = latestState[safePeriod] || {
        dateKey,
        totalPoints: gridPoints.length,
        completedBatchIndexes: [],
        results: []
      };
      const completedBatchIndexes = Array.from(new Set([...(prev.completedBatchIndexes || []), batchIndex])).sort((a, b) => a - b);
      const tagged = scoredBatch.map(item => ({ ...item, __batchIndex: batchIndex }));
      const filteredPrevResults = (prev.results || []).filter(item => item.__batchIndex !== batchIndex);
      latestState[safePeriod] = {
        dateKey,
        totalPoints: gridPoints.length,
        completedBatchIndexes,
        results: [...filteredPrevResults, ...tagged],
        updatedAt: new Date().toISOString()
      };
      this._saveJobState(latestState);

      return scoredBatch;
    };

    for (let i = 0; i < batches.length; i += CONCURRENCY_LIMIT) {
      const chunk = batches.slice(i, i + CONCURRENCY_LIMIT)
        .map((batch, idx) => ({ batch, batchIndex: i + idx }))
        .filter(({ batchIndex }) => !resumedBatchIndexes.has(batchIndex));

      if (chunk.length === 0) {
        continue;
      }

      const chunkResults = await Promise.all(chunk.map(({ batch, batchIndex }) => processBatch(batch, batchIndex)));
      for (const result of chunkResults) {
        allResults.push(...result);
      }
      if (BATCH_DELAY_MS > 0 && i + CONCURRENCY_LIMIT < batches.length) {
        await this._sleep(BATCH_DELAY_MS);
      }
    }

    this._setJobStatus(safePeriod, {
      running: false,
      finishedAt: new Date().toISOString(),
      currentBatch: batches.length,
      completedBatches: batches.length,
      completedPoints: allResults.length,
      etaSeconds: 0
    });

    // 全量完成后清理断点
    this._clearJobState(safePeriod);

    return allResults;
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

      // 同一自然日内已有数据，不重复抓取（避免重启耗尽 API 额度）
      const cacheDate = new Date(cache.updatedAt).toDateString();
      const todayDate = new Date().toDateString();
      if (cacheDate === todayDate) {
        console.log(`[GridScoreService] ${safePeriod} 缓存是今天的数据，跳过刷新`);
        return;
      }
    }
    await this._doRefresh(safePeriod);
  }

  /**
   * 手动触发刷新（有频控保护）- 后台异步执行，立即返回
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
    // 后台异步执行，不等待完成
    this._doRefresh(safePeriod).catch(err => {
      console.error(`[GridScoreService] 后台刷新失败 (${safePeriod}):`, err.message);
    });
    return { ok: true, message: `${safePeriod} 刷新已启动，请通过 /api/heatmap/status 查看进度` };
  }

  /**
   * 内部执行刷新
   * @param {'sunrise'|'sunset'} period
   */
  async _doRefresh(period = DEFAULT_PERIOD) {
    const safePeriod = this.normalizePeriod(period);
    if (this._refreshingByPeriod[safePeriod]) return;

    // 检查 API 配额软上限，保护基础天气额度
    if (!quota.canFetchGrid()) {
      const stats = quota.getStats();
      console.warn(`[GridScoreService] API 用量已达软上限 (${stats.count}/${stats.limit})，跳过格点刷新，保留基础天气额度`);
      return;
    }

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
      this._setJobStatus(safePeriod, {
        running: false,
        finishedAt: new Date().toISOString(),
        lastError: err.message
      });
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
