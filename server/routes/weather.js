const express = require('express');
const router = express.Router();
const orchestrator = require('../services/ProviderOrchestrator');
const openMeteoProvider = require('../services/providers/OpenMeteoProvider');

function round2(n) {
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
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

    // Phase15 任务63.2：仅当 ENABLE_WINDY=true 时读取并透传 X-Windy-API-Key
    const userApiKey = orchestrator.windyEnabled
      ? req.headers['x-windy-api-key'] || null
      : null;
    const result = await orchestrator.fetchWeatherData(latNum, lonNum, hoursNum, modelName);

    // 自动对比：当前站点输出 vs Open-Meteo基线（用于监控偏差）
    let compareMeta = null;
    try {
      const baseline = await openMeteoProvider.fetchWeatherData(latNum, lonNum, hoursNum, null, modelName);
      compareMeta = {
        baselineProvider: 'openmeteo',
        comparedProvider: result.providerMeta?.name || 'unknown',
        summary: buildCompareSummary(result.data, baseline.data)
      };
      console.log('[Weather Compare]', JSON.stringify({
        lat: latNum,
        lon: lonNum,
        hours: hoursNum,
        provider: compareMeta.comparedProvider,
        summary: compareMeta.summary
      }));
    } catch (compareError) {
      compareMeta = {
        baselineProvider: 'openmeteo',
        comparedProvider: result.providerMeta?.name || 'unknown',
        error: compareError.message
      };
      console.warn('[Weather Compare] baseline compare failed:', compareError.message);
    }

    // 返回成功响应
    res.json({
      success: true,
      location: {
        lat: latNum,
        lon: lonNum
      },
      hours: result.hours,
      data: result.data,
      providerMeta: result.providerMeta,
      compareMeta
    });

  } catch (error) {
    // 传递错误给错误处理中间件
    next(error);
  }
});



module.exports = router;
