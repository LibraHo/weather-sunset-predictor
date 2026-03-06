const express = require('express');
const router = express.Router();
const orchestrator = require('../services/ProviderOrchestrator');

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
    const { lat, lon, hours } = req.query;

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

    // 任务53.1：不再读取/透传 X-Windy-API-Key（已切换到 Open-Meteo 主链路）
    const result = await orchestrator.fetchWeatherData(latNum, lonNum, hoursNum);

    // 返回成功响应
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
    // 传递错误给错误处理中间件
    next(error);
  }
});

module.exports = router;
