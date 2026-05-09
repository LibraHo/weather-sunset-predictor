const express = require('express');
const router = express.Router();
const orchestrator = require('../services/ProviderOrchestrator');
const openMeteoProvider = require('../services/providers/OpenMeteoProvider');
const apiLog = require('../services/ApiCallLog');

function round2(n) {
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}


function normalizeWeatherProviderError(error) {
  if (error?.status && error?.code) {
    return { status: error.status, code: error.code, message: error.message || 'Weather provider unavailable' };
  }
  const message = String(error?.message || 'Weather provider unavailable');
  const lower = message.toLowerCase();
  if (lower.includes('429') || lower.includes('rate') || lower.includes('频繁')) {
    return { status: 429, code: 'WEATHER_RATE_LIMITED', message };
  }
  if (lower.includes('quota') || lower.includes('daily limit') || lower.includes('配额')) {
    return { status: 429, code: 'WEATHER_QUOTA_EXCEEDED', message };
  }
  if (lower.includes('timeout') || lower.includes('超时') || lower.includes('econnaborted')) {
    return { status: 504, code: 'WEATHER_UPSTREAM_TIMEOUT', message };
  }
  if (lower.includes('open-meteo') || lower.includes('weather') || lower.includes('provider')) {
    return { status: 503, code: 'WEATHER_PROVIDER_UNAVAILABLE', message };
  }
  return null;
}

function isManualTestCoordinates(lat, lon) {
  return Math.abs(lat) < 0.0001 && Math.abs(lon) < 0.0001;
}

function generateManualTestForecast(hours = 168) {
  const start = Date.now() - (Date.now() % 3600000);
  return Array.from({ length: hours }, (_, i) => {
    const timestamp = start + i * 3600000;
    const hour = new Date(timestamp).getUTCHours();
    const daylight = Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI));
    const highClouds = Math.round(25 + Math.random() * 60);
    const midClouds = Math.round(15 + Math.random() * 55);
    const lowClouds = Math.round(Math.random() * 45);
    const cloudCover = Math.max(highClouds, midClouds, lowClouds);
    return {
      timestamp,
      temp: round2(18 + daylight * 10 + Math.sin(i / 5) * 3 + Math.random() * 2),
      humidity: Math.round(45 + Math.random() * 40),
      cloudCover,
      windSpeed: Math.round(4 + Math.random() * 18),
      pressure: Math.round(1002 + Math.random() * 16),
      visibility: round2(12 + Math.random() * 28),
      lowClouds,
      midClouds,
      highClouds,
      precipitation: round2(Math.random() < 0.12 ? Math.random() * 2 : 0),
      windDirection: Math.round(Math.random() * 360),
      shortwaveRadiation: Math.round(daylight * (350 + Math.random() * 450)),
      aerosolOpticalDepth: round2(0.08 + Math.random() * 0.18),
      weatherCode: cloudCover > 70 ? 3 : (cloudCover > 35 ? 2 : 1),
      timezone: 'Asia/Shanghai'
    };
  });
}

function buildCompareSummary(primaryData = [], baselineData = []) {
  const map = new Map(baselineData.map(item => [item.timestamp, item]));

  const fields = ['temp', 'humidity', 'cloudCover', 'lowClouds', 'midClouds', 'highClouds', 'cape', 'convPrecip', 'cloudBaseHeight'];
  const stats = Object.fromEntries(fields.map(f => [f, { sumAbs: 0, count: 0, maxAbs: 0 }]));

  let matched = 0;
  for (const p of primaryData) {
    const b = map.get(p.timestamp);
    if (!b) continue;
    matched += 1;

    for (const f of fields) {
      const pv = p[f];
      const bv = b[f];
      if (!Number.isFinite(pv) || !Number.isFinite(bv)) continue;
      const d = Math.abs(pv - bv);
      stats[f].sumAbs += d;
      stats[f].count += 1;
      if (d > stats[f].maxAbs) stats[f].maxAbs = d;
    }
  }

  const mae = {};
  const maxAbs = {};
  for (const f of fields) {
    mae[f] = stats[f].count > 0 ? round2(stats[f].sumAbs / stats[f].count) : null;
    maxAbs[f] = stats[f].count > 0 ? round2(stats[f].maxAbs) : null;
  }

  return { matchedHours: matched, mae, maxAbs };
}

/**
 * GET /api/weather/forecast
 * 获取天气数据代理端点
 *
 * 查询参数:
 * - lat: 纬度 (必填)
 * - lon: 经度 (必填)
 * - hours: 预测小时数 (可选，默认168)
 */
router.get('/forecast', async (req, res, next) => {
  const tracker = apiLog.track('weather', 'forecast', { lat: req.query.lat, lon: req.query.lon });
  try {
    const { lat, lon, hours, model } = req.query;

    // 验证必填参数
    if (!lat || !lon) {
      return res.status(400).json({
        error: {
          code: 'INVALID_PARAMS',
          message: '缺少必填参数: lat 和 lon'
        }
      });
    }

    // 转换参数为数字
    const latNum = parseFloat(lat);
    const lonNum = parseFloat(lon);
    const hoursNum = hours ? parseInt(hours) : 168;
    const modelName = typeof model === 'string' && model.trim() ? model.trim() : 'ecmwf_ifs025';

    if (isManualTestCoordinates(latNum, lonNum)) {
      const data = generateManualTestForecast(hoursNum);
      tracker.ok(200);
      return res.json({
        success: true,
        location: { lat: latNum, lon: lonNum },
        hours: data.length,
        data,
        providerMeta: {
          name: 'manual-test',
          weatherModel: 'random-ui-test',
          timezone: 'Asia/Shanghai',
          dataQuality: 'mock'
        }
      });
    }

    // Phase15 任务63.2：仅当 ENABLE_WINDY=true 时读取并透传 X-Windy-API-Key
    const userApiKey = orchestrator.windyEnabled
      ? req.headers['x-windy-api-key'] || null
      : null;
    const result = await orchestrator.fetchWeatherData(latNum, lonNum, hoursNum, modelName);

    // 返回成功响应
    tracker.ok(200);
    res.json({
      success: true,
      location: {
        lat: latNum,
        lon: lonNum
      },
      hours: result.hours,
      data: result.data,
      providerMeta: result.providerMeta
    });

  } catch (error) {
    const providerError = normalizeWeatherProviderError(error);
    tracker.fail(error, providerError?.status || 500);
    if (providerError) {
      return res.status(providerError.status).json({
        success: false,
        error: { code: providerError.code, message: providerError.message }
      });
    }
    // 传递错误给错误处理中间件
    next(error);
  }
});



module.exports = router;
