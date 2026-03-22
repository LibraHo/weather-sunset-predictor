const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
// 触发重启
require('dotenv').config();

const weatherRoutes = require('./routes/weather');
const firecloudRoutes = require('./routes/firecloud');
const predictionRoutes = require('./routes/prediction');
const visitorRoutes = require('./routes/visitor');
const geocodingRoutes = require('./routes/geocoding');
const heatmapRoutes = require('./routes/heatmap');
const spotsRoutes = require('./routes/spots');
const tilesRoutes = require('./routes/tiles');
const photosRoutes = require('./routes/photos');
const adminRoutes = require('./routes/admin');
const { requestLogger, errorLogger } = require('./middleware/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// 支持逗号分隔的多个 CORS 来源（如 "http://localhost:9002,http://localhost:8080"）
const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:9002')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

// 速率限制：读取 .env 配置，未设置时使用合理默认值
const rateLimitWindowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000; // 15 分钟
const rateLimitMax = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100;

const apiLimiter = rateLimit({
  windowMs: rateLimitWindowMs,
  max: rateLimitMax,
  standardHeaders: true,  // 在响应头返回 RateLimit-* 字段
  legacyHeaders: false,

  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: '请求过于频繁，请稍后再试'
    }
  }
});

// Middleware
app.use(cors({
  origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins
}));
app.use(express.json());
app.use(morgan('combined')); // HTTP request logging
app.use(requestLogger()); // Custom request logging

// 对所有 /api/* 路由启用速率限制
app.use('/api/', apiLimiter);

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 获取地图API Key配置
app.get('/api/config/map-key', (req, res) => {
  const mapKey = process.env.WINDY_MAP_API_KEY;
  if (!mapKey || mapKey === 'your_map_api_key_here') {
    return res.status(500).json({
      error: {
        code: 'MAP_KEY_NOT_CONFIGURED',
        message: '地图API密钥未配置'
      }
    });
  }
  res.json({ mapKey });
});

// Phase15 任务63.3：暴露 feature flags 给前端
app.get('/api/config/features', (req, res) => {
  const orchestrator = require('./services/ProviderOrchestrator');
  res.json({
    windyEnabled: orchestrator.windyEnabled,
    capeScoreEnabled: orchestrator.featureFlags.capeScoreEnabled,
    convectivePrecipScoreEnabled: orchestrator.featureFlags.convectivePrecipScoreEnabled
  });
});

app.use('/api/weather', weatherRoutes);
app.use('/api/firecloud', firecloudRoutes);
app.use('/api/prediction', predictionRoutes);
app.use('/api/visitor', visitorRoutes);
app.use('/api/geocoding', geocodingRoutes);
app.use('/api/heatmap', heatmapRoutes);
app.use('/api/spots', spotsRoutes);
app.use('/api/tiles', tilesRoutes);
app.use('/api/photos', photosRoutes);
app.use('/', adminRoutes);

// 静态文件服务（公开分享页面）
app.use(express.static(path.join(__dirname, '../public')));

// Error logging middleware
app.use(errorLogger());

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: err.message || '服务器内部错误'
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: '请求的资源不存在'
    }
  });
});

app.listen(PORT, () => {
  console.log(`🚀 后端服务器运行在 http://localhost:${PORT}`);
  console.log(`📝 环境: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 CORS 允许源: ${corsOrigins.join(', ')}`);

  // Phase16 任务64.3：定时刷新晚霞评分网格
  // 每天 4 次：UTC 0/4/7/9 = CST 08/12/15/17
  _scheduleGridRefresh();
});

/**
 * Phase16 任务64.3：定时刷新网格评分
 */
function _scheduleGridRefresh() {
  const gridService = require('./services/GridScoreService');

  // 启动时检查并刷新一次
  gridService.refreshIfStale().catch(err =>
    console.error('[GridRefresh] 启动刷新失败:', err.message)
  );

  // 定时任务：每天 UTC 2/14 点（= CST 10:00/22:00），每天 2 次，节省免费 API 配额
  const REFRESH_HOURS_UTC = [2, 14];

  setInterval(() => {
    const now = new Date();
    const hourUTC = now.getUTCHours();
    const minUTC = now.getUTCMinutes();
    if (REFRESH_HOURS_UTC.includes(hourUTC) && minUTC < 5) {
      console.log(`[GridRefresh] 定时触发刷新（UTC ${hourUTC}:${String(minUTC).padStart(2,'0')}）`);
      gridService.refreshIfStale(0).catch(err =>
        console.error('[GridRefresh] 定时刷新失败:', err.message)
      );
    }
  }, 5 * 60 * 1000); // 每 5 分钟检查一次
}

module.exports = app;
