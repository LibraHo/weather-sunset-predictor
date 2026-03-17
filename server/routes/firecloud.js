/**
 * FireCloud API路由
 *
 * 提供火烧云地图覆盖层API端点
 * Phase 6 重构：使用 FireCloudService 封装 Python 调用逻辑
 *
 * 需求：20.11, 22 (Phase 6)
 */

const express = require('express');
const FireCloudService = require('../services/FireCloudService.js');
const FireCloudTileService = require('../services/FireCloudTileService.js');

const router = express.Router();

// 创建 FireCloudService 实例
const fireCloudService = new FireCloudService();
const fireCloudTileService = new FireCloudTileService();

/**
 * GET /api/firecloud/overlay
 *
 * 获取火烧云地图覆盖层
 *
 * 查询参数：
 * - lat: 纬度（必需）
 * - lon: 经度（必需）
 * - radius: 半径，单位km（可选，默认200）
 * - type: 预测类型（可选，默认sunset，可选sunrise）
 *
 * 返回：
 * {
 *   image: "data:image/png;base64,...",
 *   bounds: {
 *     north: number,
 *     south: number,
 *     east: number,
 *     west: number
 *   },
 *   timestamp: number
 * }
 */
router.get('/overlay', async (req, res) => {
  const { lat, lon, radius = 200, type = 'sunset' } = req.query;

  // 参数验证
  if (!lat || !lon) {
    return res.status(400).json({
      error: '缺少必需参数',
      message: 'lat和lon参数是必需的'
    });
  }

  const latNum = parseFloat(lat);
  const lonNum = parseFloat(lon);
  const radiusNum = parseInt(radius);

  // 验证坐标范围
  if (isNaN(latNum) || latNum < -90 || latNum > 90) {
    return res.status(400).json({
      error: '无效的纬度',
      message: '纬度必须在-90到90之间'
    });
  }

  if (isNaN(lonNum) || lonNum < -180 || lonNum > 180) {
    return res.status(400).json({
      error: '无效的经度',
      message: '经度必须在-180到180之间'
    });
  }

  // 验证半径
  if (isNaN(radiusNum) || radiusNum < 50 || radiusNum > 500) {
    return res.status(400).json({
      error: '无效的半径',
      message: '半径必须在50到500公里之间'
    });
  }

  // 验证预测类型
  if (type !== 'sunrise' && type !== 'sunset') {
    return res.status(400).json({
      error: '无效的预测类型',
      message: 'type必须是sunrise或sunset'
    });
  }

  console.log(`[FireCloud API] 处理请求: lat=${latNum}, lon=${lonNum}, radius=${radiusNum}km, type=${type}`);

  try {
    const result = await fireCloudService.generateOverlay(latNum, lonNum, radiusNum, type);
    res.json(result);
    console.log('[FireCloud API] 请求处理完成');
  } catch (error) {
    console.error('[FireCloud API] 错误:', error);

    const statusCode = error.code === 'SCRIPT_NOT_FOUND' ? 500
      : error.code === 'TIMEOUT' ? 504
      : 500;

    res.status(statusCode).json({
      error: error.code || '数据处理失败',
      message: error.message,
      details: error.details
    });
  }
});

/**
 * GET /api/firecloud/health
 *
 * 健康检查端点
 */
router.get('/health', async (req, res) => {
  const health = await fireCloudService.healthCheck();
  res.json(health);
});

/**
 * POST /api/firecloud/cache/clear
 *
 * 清除覆盖层缓存
 */
router.post('/cache/clear', async (req, res) => {
  await fireCloudService.clearCache();
  res.json({ success: true, message: '缓存已清除' });
});

/**
 * GET /api/firecloud/grid
 *
 * 火烧云网格数据 PoC（中国→全球统一接口）
 * 查询参数：
 * - bbox: west,south,east,north（必需）
 * - zoom: 缩放等级（可选，默认6）
 * - time: 时间戳（可选，默认当前时间）
 */
router.get('/grid', async (req, res) => {
  const { bbox, zoom = 6, time = Date.now(), type = 'sunset' } = req.query;

  if (!bbox) {
    return res.status(400).json({
      error: '缺少必需参数',
      message: 'bbox 参数是必需的（格式：west,south,east,north）'
    });
  }

  const parts = bbox.split(',').map(Number);
  if (parts.length !== 4 || parts.some(Number.isNaN)) {
    return res.status(400).json({
      error: '无效的 bbox',
      message: 'bbox 必须是 west,south,east,north 的数字格式'
    });
  }

  const grid = await fireCloudTileService.getGrid({ bbox, zoom: Number(zoom), time: Number(time), type });
  return res.json(grid);
});

/**
 * GET /api/firecloud/tiles/:z/:x/:y.png
 *
 * 火烧云专题瓦片接口（Phase 11 PoC）
 */
router.get('/tiles/:z/:x/:y.png', async (req, res) => {
  const { z, x, y } = req.params;
  const { time = Date.now(), type = 'sunset' } = req.query;

  const tileBuffer = await fireCloudTileService.getTilePng({
    z: Number(z),
    x: Number(x),
    y: Number(y),
    time: Number(time),
    type
  });

  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=600');
  return res.send(tileBuffer);
});

module.exports = router;
