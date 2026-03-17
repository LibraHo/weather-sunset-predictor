/**
 * FireCloudTileService - 火烧云瓦片服务
 *
 * 提供两个核心能力：
 * 1. getGrid()     - 基于真实 Open-Meteo 数据的网格评分
 * 2. getTilePng()  - 服务端将网格评分渲染为 RGBA PNG 瓦片
 *
 * Phase 12：接入真实预测数据，替换 PoC 占位数据
 */

const CacheService = require('./CacheService');
const cacheConfig = require('../config/cacheConfig');
const orchestrator = require('./ProviderOrchestrator');
const { calculateEnhancedPrediction } = require('./EnhancedPredictionService');
const PngEncoder = require('../utils/PngEncoder');

// 瓦片大小（像素）
const TILE_SIZE = 256;

// 色谱：score 0-100 → RGBA
// 低分(<35): 透明 / 灰
// 中分(35-60): 金黄
// 高分(60-80): 橙红
// 极高(80-100): 深红火焰
function scoreToRGBA(score, alpha = 0.75) {
  const a = Math.round(alpha * 255);
  if (score < 20) return [80, 80, 80, Math.round(a * 0.15)];     // 几乎透明灰
  if (score < 35) return [150, 120, 80, Math.round(a * 0.3)];    // 浅褐
  if (score < 50) return [255, 200, 50, Math.round(a * 0.55)];   // 金黄
  if (score < 65) return [255, 140, 20, Math.round(a * 0.7)];    // 橙
  if (score < 80) return [230, 60, 10, Math.round(a * 0.85)];    // 橙红
  return [180, 10, 10, a];                                         // 深红爆发
}

/**
 * 将 XYZ 瓦片坐标转换为经纬度 bbox
 * 返回 { west, south, east, north }
 */
function tileToBbox(z, x, y) {
  const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z);
  const north = (Math.atan(Math.sinh(n)) * 180) / Math.PI;

  const n2 = Math.PI - (2 * Math.PI * (y + 1)) / Math.pow(2, z);
  const south = (Math.atan(Math.sinh(n2)) * 180) / Math.PI;

  const west = (x / Math.pow(2, z)) * 360 - 180;
  const east = ((x + 1) / Math.pow(2, z)) * 360 - 180;

  return { west, south, east, north };
}

class FireCloudTileService {
  constructor() {
    this.cacheService = new CacheService({ defaultTTL: cacheConfig.ttl.FIRECLOUD_OVERLAY });
  }

  /**
   * 获取指定 bbox 区域的火烧云评分网格
   * 使用真实 Open-Meteo 数据 + EnhancedPredictionService 评分
   *
   * @param {Object} params
   * @param {string} params.bbox   - "west,south,east,north"
   * @param {number} params.zoom   - 地图缩放等级（影响采样密度）
   * @param {number} params.time   - 时间戳（毫秒）
   * @param {string} params.type   - 'sunset' | 'sunrise'
   */
  async getGrid({ bbox, zoom = 6, time = Date.now(), type = 'sunset' }) {
    const key = cacheConfig.buildKey('FIRECLOUD_GRID', `${bbox}_${zoom}_${time}_${type}`);
    const cached = await this.cacheService.get(key);
    if (cached) return cached;

    const [west, south, east, north] = bbox.split(',').map(Number);

    // 根据 zoom 确定采样密度，zoom 越高越细但单次最多 32x32
    const cols = Math.min(32, Math.max(8, Math.round(zoom * 3)));
    const rows = cols;

    const cellWidth = (east - west) / cols;
    const cellHeight = (north - south) / rows;

    const date = new Date(time);

    // 并发限制：Open-Meteo 并发较宽松，但网格点可能很多，分批请求
    const BATCH = 4;
    const points = [];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const lat = south + (y + 0.5) * cellHeight;
        const lon = west + (x + 0.5) * cellWidth;
        points.push({ x, y, lat, lon });
      }
    }

    // 创建评分矩阵，初始化为 null
    const values = Array.from({ length: rows }, () => new Array(cols).fill(0));

    // 分批串行请求天气数据（Open-Meteo 限制并发，每批 4 个，批次间延迟 300ms）
    const DELAY_MS = 300;
    for (let i = 0; i < points.length; i += BATCH) {
      const batch = points.slice(i, i + BATCH);
      await Promise.all(batch.map(async ({ x, y, lat, lon }) => {
        try {
          // 只取最近 12 小时数据即可
          const weatherResult = await orchestrator.fetchWeatherData(lat, lon, 12);
          // 取最近时刻的天气数据
          const weatherData = weatherResult.data[0];
          if (!weatherData) {
            values[y][x] = 0;
            return;
          }
          const result = calculateEnhancedPrediction(weatherData, date, lat, lon, type);
          values[y][x] = Math.round(result.score);
        } catch (err) {
          // 单点失败不影响整体，静默填 0
          values[y][x] = 0;
        }
      }));
      // 批次间等待，避免 429
      if (i + BATCH < points.length) {
        await new Promise(r => setTimeout(r, DELAY_MS));
      }
    }

    const payload = {
      type: 'FeatureCollection',
      meta: {
        source: 'openmeteo-realtime',
        zoom,
        time: Number(time),
        predictionType: type,
        bbox: { west, south, east, north },
        resolution: { rows, cols, cellWidth, cellHeight }
      },
      values
    };

    await this.cacheService.set(key, payload);
    return payload;
  }

  /**
   * 生成指定 XYZ 瓦片的 PNG 图片
   * 从 getGrid 获取评分数据，然后渲染为 RGBA PNG
   *
   * @param {Object} params
   * @param {number} params.z, x, y - 瓦片坐标
   * @param {number} params.time     - 时间戳
   * @param {string} params.type     - 预测类型
   */
  async getTilePng({ z, x, y, time = Date.now(), type = 'sunset' }) {
    const key = cacheConfig.buildKey('FIRECLOUD_TILE', `${z}_${x}_${y}_${time}_${type}`);
    const cached = await this.cacheService.get(key);
    if (cached) return Buffer.from(cached, 'base64');

    // 获取瓦片对应的 bbox
    const { west, south, east, north } = tileToBbox(z, x, y);
    const bbox = `${west},${south},${east},${north}`;

    // 获取评分网格（zoom 影响分辨率）
    const grid = await this.getGrid({ bbox, zoom: z, time, type });
    const { rows, cols } = grid.meta.resolution;
    const { values } = grid;

    // 渲染为 TILE_SIZE x TILE_SIZE 的 RGBA 图像
    const rgba = new Uint8Array(TILE_SIZE * TILE_SIZE * 4);

    for (let py = 0; py < TILE_SIZE; py++) {
      for (let px = 0; px < TILE_SIZE; px++) {
        // 把像素坐标映射到网格格子
        const gx = Math.min(cols - 1, Math.floor((px / TILE_SIZE) * cols));
        const gy = Math.min(rows - 1, Math.floor((py / TILE_SIZE) * rows));
        const score = values[gy]?.[gx] ?? 0;
        const [r, g, b, a] = scoreToRGBA(score);
        const idx = (py * TILE_SIZE + px) * 4;
        rgba[idx]   = r;
        rgba[idx+1] = g;
        rgba[idx+2] = b;
        rgba[idx+3] = a;
      }
    }

    const pngBuffer = PngEncoder.encode(rgba, TILE_SIZE, TILE_SIZE);

    await this.cacheService.set(key, pngBuffer.toString('base64'));
    return pngBuffer;
  }
}

module.exports = FireCloudTileService;
