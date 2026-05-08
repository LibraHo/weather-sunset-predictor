const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const compression = require('compression');
// 触发重启
require('dotenv').config();

const weatherRoutes = require('./routes/weather');
const firecloudRoutes = require('./routes/firecloud');
const agentForecastRoutes = require('./routes/agent-forecast');
const predictionRoutes = require('./routes/prediction');
const visitorRoutes = require('./routes/visitor');
const geocodingRoutes = require('./routes/geocoding');
const heatmapRoutes = require('./routes/heatmap');
const spotsRoutes = require('./routes/spots');
const tilesRoutes = require('./routes/tiles');
const photosRoutes = require('./routes/photos');
const adminRoutes = require('./routes/admin');
const { requireAdminAuth } = require('./utils/adminAuth');
const apiLogsRoutes = require('./routes/api-logs');
const agentRoutes = require('./routes/agent');
const applicationsRoutes = require('./routes/applications');
const shareRoutes = require('./routes/share');
const shareStatsRoutes = require('./routes/share-stats');
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

// 地图瓦片单独限速：每分钟500张（地图渲染一次可能需要几十张瓦片）
const tilesLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'TILE_RATE_LIMIT', message: '瓦片请求过于频繁' } }
});

// 地理搜索单独限速：搜索框输入会触发多次请求，不能和天气/预测 API 共用 15 分钟全局额度
const geocodingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.GEOCODING_RATE_LIMIT_MAX_REQUESTS) || 240,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'GEOCODING_RATE_LIMIT', message: '地名搜索过于频繁，请稍后再试' } }
});

// Middleware
app.use(compression()); // gzip 压缩所有响应
app.use(cors({
  origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins
}));
app.use(express.json());
app.use(morgan('combined')); // HTTP request logging
app.use(requestLogger()); // Custom request logging

// 访问统计中间件（排除 health、静态资源、瓦片）
const accessLogService = require('./services/AccessLogService');
app.use((req, res, next) => {
  const skipPaths = ['/health', '/api/tiles', '/data/', '/styles/', '/src/', '/public/'];
  const shouldSkip = skipPaths.some(p => req.path.startsWith(p));
  if (!shouldSkip && req.path !== '/favicon.ico') {
    accessLogService.log(req);
  }
  next();
});

// 瓦片/地理搜索路由优先挂载（绕过全局 apiLimiter，使用各自限速）
app.use('/api/tiles', tilesLimiter, tilesRoutes);
app.use('/api/geocoding', geocodingLimiter, geocodingRoutes);

// 对其余 /api/* 路由启用速率限制
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

app.use('/api/agent', agentRoutes);
app.use('/api/applications', applicationsRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/agent', agentForecastRoutes);
app.use('/api/firecloud', firecloudRoutes);
app.use('/api/prediction', predictionRoutes);
app.use('/api/visitor', visitorRoutes);
app.use('/api/share', shareStatsRoutes);
app.use('/api/heatmap', heatmapRoutes);
app.use('/api/spots', spotsRoutes);
app.use('/api/photos', photosRoutes);
app.use('/', adminRoutes);

// Admin API routes (protected by Basic Auth)
app.use('/api/admin', requireAdminAuth, apiLogsRoutes);
app.use('/api/admin/share', requireAdminAuth, shareStatsRoutes);
app.use('/share', shareRoutes);

// 静态文件服务（公开分享页面）
// /data/ 目录下的 GeoJSON 文件缓存 7 天，其余静态文件缓存 1 小时
app.use('/data', express.static(path.join(__dirname, '../public/data'), {
  maxAge: '7d',
  immutable: false
}));
app.use(express.static(path.join(__dirname, '../public'), {
  maxAge: '1h'
}))
app.use('/styles', express.static(path.join(__dirname, '../styles'), { maxAge: '1h' }))
app.use('/src', express.static(path.join(__dirname, '../src'), { maxAge: '1h' }))
// 根目录下的独立 JS 配置文件（被 ES module 引用）
app.get('/config.api.js', (req, res) => {
  res.sendFile(path.join(__dirname, '../config.api.js'));
});

// Serve index.html from project root (not inside public/)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../index.html'));
});

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
  // 每天 2 次（UTC 2/14 = CST 10:00/22:00）
  _scheduleGridRefresh();
});

/**
 * Phase16 任务64.3：定时刷新网格评分
 * 支持从 schedule-config.json 读取自定义配置
 */
function _scheduleGridRefresh() {
  const gridService = require('./services/GridScoreService');
  const fs = require('fs');
  const os = require('os');
  const path = require('path');

  const CONFIG_PATH = path.join(os.homedir(), '.xiake', 'schedule-config.json');

  // 启动时检查并刷新一次
  gridService.refreshIfStale().catch(err =>
    console.error('[GridRefresh] 启动刷新失败:', err.message)
  );

  // 读取配置获取刷新时间
  function _loadScheduleHours() {
    const DEFAULT_HOURS_CST = [10, 22]; // 默认 CST 10:00 / 22:00
    try {
      if (!fs.existsSync(CONFIG_PATH)) return DEFAULT_HOURS_CST;
      const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
      if (!config.enabled || !Array.isArray(config.jobs)) return DEFAULT_HOURS_CST;
      const hours = [];
      for (const job of config.jobs) {
        const m = job.time && job.time.match(/^(\d{1,2}):(\d{2})$/);
        if (m) hours.push(parseInt(m[1]));
      }
      return hours.length > 0 ? [...new Set(hours)] : DEFAULT_HOURS_CST;
    } catch (e) {
      return DEFAULT_HOURS_CST;
    }
  }

  let scheduleHoursCST = _loadScheduleHours();
  console.log(`[GridRefresh] 初始定时刷新时间(CST): ${scheduleHoursCST.map(h => `${String(h).padStart(2,'0')}:00`).join(', ')}`);

  // 记录已触发的小时，防止同一小时重复触发
  const triggeredHours = new Set();

  // 支持配置热重载
  global.__scheduleReload = () => {
    scheduleHoursCST = _loadScheduleHours();
    console.log(`[GridRefresh] 配置已重载，定时刷新时间(CST): ${scheduleHoursCST.map(h => `${String(h).padStart(2,'0')}:00`).join(', ')}`);
  };

  setInterval(() => {
    const now = new Date();
    // CST = UTC+8
    const hourCST = (now.getUTCHours() + 8) % 24;
    const minCST = now.getUTCMinutes();
    const dateKey = `${now.toISOString().slice(0, 10)}_${hourCST}`; // 格式: 2024-01-15_10

    // 检查是否在配置的时间点（小时匹配且分钟在0-5之间）且当天该小时未触发过
    if (scheduleHoursCST.includes(hourCST) && minCST < 5 && !triggeredHours.has(dateKey)) {
      triggeredHours.add(dateKey);
      console.log(`[GridRefresh] 定时触发刷新（CST ${hourCST}:${String(minCST).padStart(2,'0')}）`);
      gridService.refreshIfStale(0).catch(err =>
        console.error('[GridRefresh] 定时刷新失败:', err.message)
      );
    }

    // 清理过期的触发记录（保留最近48小时）
    const cutoffDate = new Date(now);
    cutoffDate.setHours(cutoffDate.getHours() - 48);
    const cutoffKey = `${cutoffDate.toISOString().slice(0, 10)}_${cutoffDate.getHours()}`;
    for (const key of triggeredHours) {
      if (key < cutoffKey) {
        triggeredHours.delete(key);
      }
    }
  }, 5 * 60 * 1000); // 每 5 分钟检查一次
}

module.exports = app;
