/**
 * Prediction Routes - 预测 API 路由
 *
 * 需求：22 (前后端分离)
 *
 * 端点：
 * - POST /api/prediction/calculate - 基础单点预测 (Phase 1)
 * - POST /api/prediction/enhanced - 增强版单点预测 (Phase 3)
 * - POST /api/prediction/enhanced/batch - 增强版批量预测 (Phase 3)
 *
 * 错误响应格式统一为：{ error: { code: 'CODE', message: '...' } }
 */

const express = require('express');
const router = express.Router();
const PredictionService = require('../services/PredictionService.js');
const EnhancedPredictionService = require('../services/EnhancedPredictionService.js');
const SurroundingService = require('../services/SurroundingService.js');
const CacheService = require('../services/CacheService.js');
const cacheConfig = require('../config/cacheConfig.js');

// 创建服务实例（使用统一TTL配置）
const predictionService = new PredictionService();
const cacheService = new CacheService({ defaultTTL: cacheConfig.ttl.DEFAULT });
const surroundingService = new SurroundingService({ cacheService });

// 服务器退出时释放定时器，避免 Node.js 进程无法正常退出
process.once('exit', () => cacheService.destroy());
process.once('SIGINT', () => { cacheService.destroy(); process.exit(0); });
process.once('SIGTERM', () => { cacheService.destroy(); process.exit(0); });

// ========== 统一错误响应辅助函数 ==========

/**
 * 返回标准化错误响应
 * @param {import('express').Response} res
 * @param {number} status - HTTP 状态码
 * @param {string} code - 错误代码
 * @param {string} message - 错误信息
 */
function errorResponse(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

// ========== 请求验证中间件 ==========

/**
 * 验证基础预测请求参数
 */
function validatePredictionRequest(req, res, next) {
  const { weatherData, date, lat, lon, type } = req.body;

  if (!weatherData || typeof weatherData !== 'object') {
    return errorResponse(res, 400, 'INVALID_WEATHER_DATA', 'weatherData is required and must be an object');
  }

  if (!date) {
    return errorResponse(res, 400, 'MISSING_DATE', 'date is required');
  }

  if (typeof lat !== 'number' || lat < -90 || lat > 90) {
    return errorResponse(res, 400, 'INVALID_LATITUDE', 'lat must be a number between -90 and 90');
  }

  if (typeof lon !== 'number' || lon < -180 || lon > 180) {
    return errorResponse(res, 400, 'INVALID_LONGITUDE', 'lon must be a number between -180 and 180');
  }

  if (!type || !['sunrise', 'sunset'].includes(type)) {
    return errorResponse(res, 400, 'INVALID_TYPE', 'type must be "sunrise" or "sunset"');
  }

  next();
}

/**
 * 验证周边预测请求参数
 */
function validateSurroundingRequest(req, res, next) {
  const { lat, lon, radius, type } = req.body;

  if (typeof lat !== 'number' || lat < -90 || lat > 90) {
    return errorResponse(res, 400, 'INVALID_LATITUDE', 'lat must be a number between -90 and 90');
  }

  if (typeof lon !== 'number' || lon < -180 || lon > 180) {
    return errorResponse(res, 400, 'INVALID_LONGITUDE', 'lon must be a number between -180 and 180');
  }

  if (radius !== undefined && ![50, 100, 150].includes(radius)) {
    return errorResponse(res, 400, 'INVALID_RADIUS', 'radius must be 50, 100, or 150 kilometers');
  }

  if (type !== undefined && !['sunrise', 'sunset'].includes(type)) {
    return errorResponse(res, 400, 'INVALID_TYPE', 'type must be "sunrise" or "sunset"');
  }

  next();
}

/**
 * 验证批量预测请求参数
 */
function validateBatchRequest(req, res, next) {
  const { weatherDataArray, lat, lon, type } = req.body;

  if (!Array.isArray(weatherDataArray) || weatherDataArray.length === 0) {
    return errorResponse(res, 400, 'INVALID_WEATHER_DATA_ARRAY', 'weatherDataArray must be a non-empty array');
  }

  if (weatherDataArray.length > 30) {
    return errorResponse(res, 400, 'TOO_MANY_ITEMS', 'Maximum 30 items allowed per batch request');
  }

  for (let i = 0; i < weatherDataArray.length; i++) {
    const item = weatherDataArray[i];
    if (!item.weather || typeof item.weather !== 'object') {
      return errorResponse(res, 400, 'INVALID_WEATHER_DATA',
        `weatherDataArray[${i}].weather is required and must be an object`);
    }
    if (!item.date) {
      return errorResponse(res, 400, 'MISSING_DATE', `weatherDataArray[${i}].date is required`);
    }
  }

  if (typeof lat !== 'number' || lat < -90 || lat > 90) {
    return errorResponse(res, 400, 'INVALID_LATITUDE', 'lat must be a number between -90 and 90');
  }

  if (typeof lon !== 'number' || lon < -180 || lon > 180) {
    return errorResponse(res, 400, 'INVALID_LONGITUDE', 'lon must be a number between -180 and 180');
  }

  if (!type || !['sunrise', 'sunset'].includes(type)) {
    return errorResponse(res, 400, 'INVALID_TYPE', 'type must be "sunrise" or "sunset"');
  }

  next();
}

// ========== API 端点 ==========

/**
 * POST /api/prediction/calculate
 * 基础单点火烧云预测 (Phase 1)
 *
 * 需求：22.1 - 核心预测算法后端化
 *
 * Request Body:
 * {
 *   weatherData: { cloudCover, humidity, visibility, lowCloudCover, highClouds, midClouds, lowClouds },
 *   date: "2024-06-21T18:00:00Z",
 *   lat: 40.0,
 *   lon: 116.0,
 *   type: "sunset" | "sunrise"
 * }
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     date: "...",
 *     score: 75,
 *     quality: "excellent",
 *     factors: { cloudCover: {...}, humidity: {...}, visibility: {...}, lowClouds: {...} },
 *     sunsetTime: "...",
 *     sunriseTime: "...",
 *     type: "sunset",
 *     goldenHour: { start: "...", end: "..." },
 *     blueHour: { start: "...", end: "..." },
 *     sunAzimuth: 280,
 *     cloudLayers: { high: 30, mid: 50, low: 10, description: "..." }
 *   }
 * }
 */
router.post('/calculate', validatePredictionRequest, (req, res) => {
  try {
    const { weatherData, date, lat, lon, type } = req.body;

    console.log(`[PredictionRoute] Basic prediction request: lat=${lat}, lon=${lon}, type=${type}`);

    const result = predictionService.calculatePrediction(weatherData, date, lat, lon, type);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('[PredictionRoute] Basic prediction error:', error);
    errorResponse(res, 500, 'PREDICTION_ERROR', error.message);
  }
});

/**
 * POST /api/prediction/enhanced
 * 增强版单点火烧云预测 (Phase 3)
 *
 * Request Body:
 * {
 *   weatherData: { lowClouds, midClouds, highClouds, visibility, humidity, aqi },
 *   date: "2024-06-21T18:00:00Z",
 *   lat: 40.0,
 *   lon: 116.0,
 *   type: "sunset" | "sunrise",
 *   options: {
 *     remoteCloudData: { near: { totalCloud }, far: { totalCloud } },
 *     rainedRecently: false
 *   }
 * }
 *
 * Response:
 * {
 *   success: true,
 *   data: { score, quality, status, icon, ... }
 * }
 */
router.post('/enhanced', validatePredictionRequest, (req, res) => {
  try {
    const { weatherData, date, lat, lon, type, options = {} } = req.body;

    console.log(`[PredictionRoute] Enhanced prediction request: lat=${lat}, lon=${lon}, type=${type}`);

    const result = EnhancedPredictionService.calculateEnhancedPrediction(
      weatherData,
      date,
      lat,
      lon,
      type,
      options
    );

    // 任务 56.2：旧字段兼容窗口（deprecated 标注，保留兼容字段供旧客户端使用）
    const compatResult = {
      ...result,
      // @deprecated - 使用 lightPathAnalysis.score 替代
      lightPathScore: result.lightPathAnalysis?.score ?? null,
      // @deprecated - 使用 canvasAnalysis.score 替代
      canvasScore: result.canvasAnalysis?.score ?? null,
      // @deprecated - 使用 breakdown.baseScore 替代
      baseScore: result.breakdown?.baseScore ?? null,
    };

    res.json({
      success: true,
      data: compatResult
    });

  } catch (error) {
    console.error('[PredictionRoute] Enhanced prediction error:', error);
    errorResponse(res, 500, 'PREDICTION_ERROR', error.message);
  }
});

/**
 * POST /api/prediction/enhanced/batch
 * 增强版批量火烧云预测（多天）
 *
 * Request Body:
 * {
 *   weatherDataArray: [
 *     { weather: {...}, date: "...", rainedRecently: false },
 *     ...
 *   ],
 *   lat: 40.0,
 *   lon: 116.0,
 *   type: "sunset" | "sunrise"
 * }
 *
 * Response:
 * {
 *   success: true,
 *   data: [ { score, quality, ... }, ... ]
 * }
 */
router.post('/enhanced/batch', validateBatchRequest, (req, res) => {
  try {
    const { weatherDataArray, lat, lon, type } = req.body;

    console.log(`[PredictionRoute] Batch prediction request: ${weatherDataArray.length} items, type=${type}`);

    const results = EnhancedPredictionService.calculateBatchEnhancedPredictions(
      weatherDataArray,
      lat,
      lon,
      type
    );

    res.json({
      success: true,
      data: results,
      count: results.length
    });

  } catch (error) {
    console.error('[PredictionRoute] Batch prediction error:', error);
    errorResponse(res, 500, 'BATCH_PREDICTION_ERROR', error.message);
  }
});

/**
 * POST /api/prediction/canvas
 * 单独的画布评分（本地云况）
 *
 * Request Body:
 * {
 *   weatherData: { lowClouds, midClouds, highClouds }
 * }
 */
router.post('/canvas', (req, res) => {
  try {
    const { weatherData } = req.body;

    if (!weatherData || typeof weatherData !== 'object') {
      return errorResponse(res, 400, 'INVALID_WEATHER_DATA', 'weatherData is required and must be an object');
    }

    const result = EnhancedPredictionService.scoreCloudCanvas(weatherData);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('[PredictionRoute] Canvas score error:', error);
    errorResponse(res, 500, 'CANVAS_SCORE_ERROR', error.message);
  }
});

/**
 * POST /api/prediction/rendering
 * 单独的渲染评分（画质修正）
 *
 * Request Body:
 * {
 *   weatherData: { visibility, humidity, aqi },
 *   rainedRecently: false
 * }
 */
router.post('/rendering', (req, res) => {
  try {
    const { weatherData, rainedRecently = false } = req.body;

    if (!weatherData || typeof weatherData !== 'object') {
      return errorResponse(res, 400, 'INVALID_WEATHER_DATA', 'weatherData is required and must be an object');
    }

    const result = EnhancedPredictionService.scoreRendering(weatherData, rainedRecently);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('[PredictionRoute] Rendering score error:', error);
    errorResponse(res, 500, 'RENDERING_SCORE_ERROR', error.message);
  }
});

/**
 * POST /api/prediction/surrounding
 * 周边8方向火烧云预测聚合 (Phase 2)
 *
 * 需求：22.6, 22.7 - 周边采样聚合 API
 *
 * Request Body:
 * {
 *   lat: 40.0,
 *   lon: 116.0,
 *   radius: 100,          // 可选，50/100/150，默认100
 *   type: "sunset" | "sunrise",  // 可选，默认"sunset"
 *   date: "2024-06-21"    // 可选，默认今天
 * }
 */
router.post('/surrounding', validateSurroundingRequest, async (req, res) => {
  try {
    const { lat, lon, radius = 100, type = 'sunset', date } = req.body;

    console.log(`[PredictionRoute] Surrounding prediction request: lat=${lat}, lon=${lon}, radius=${radius}, type=${type}`);

    const result = await surroundingService.getSurroundingPredictions({
      lat,
      lon,
      radius,
      type,
      date
    });

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('[PredictionRoute] Surrounding prediction error:', error);
    errorResponse(res, 500, 'SURROUNDING_PREDICTION_ERROR', error.message);
  }
});

module.exports = router;
