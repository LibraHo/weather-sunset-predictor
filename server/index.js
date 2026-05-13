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
const apiLogsRoutes = require('./routes/api-logs');
const agentRoutes = require('./routes/agent');
const applicationsRoutes = require('./routes/applications');
const shareRoutes = require('./routes/share');
const shareStatsRoutes = require('./routes/share-stats');
const wechatRouteModule = require('./routes/wechat');
const userRouteModule = require('./routes/user');
const UserService = require('./services/UserService');
const basicAuth = require('basic-auth');
const { requestLogger, errorLogger } = require('./middleware/logger');

const app = express();
const PORT = process.env.PORT || 3000;
const userService = new UserService();

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
app.use('/api/wechat', wechatRouteModule.createRouter({ userService }));
app.use('/api/user', userRouteModule.createRouter({ userService }));
app.use('/api/heatmap', heatmapRoutes);
app.use('/api/spots', spotsRoutes);
app.use('/api/photos', photosRoutes.createRouter({ userService }));
app.use('/', adminRoutes);

// Admin API routes (protected by Basic Auth)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'xiake2024';
const adminApiAuth = (req, res, next) => {
  const credentials = basicAuth(req);
  if (!credentials || credentials.pass !== ADMIN_PASSWORD) {
    res.set('WWW-Authenticate', 'Basic realm="Xiake Photo Admin"');
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: '认证失败' } });
  }
  next();
};
app.use('/api/admin', adminApiAuth, apiLogsRoutes);
app.use('/api/admin/share', adminApiAuth, shareStatsRoutes);
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
  const {
    readScheduleConfig,
    getDueScheduleJobs,
    describeSchedule
  } = require('./services/GridRefreshSchedule');

  const startRefresh = (period, reason) => {
    gridService.refreshIfStale(0, period, { force: true }).catch(err =>
      console.error(`[GridRefresh] ${reason}刷新失败 (${period}):`, err.message)
    );
  };

  // 启动时两个时段都检查一次，避免重启后只有晚霞缓存被维护。
  for (const period of ['sunrise', 'sunset']) {
    gridService.refreshIfStale(undefined, period).catch(err =>
      console.error(`[GridRefresh] 启动刷新失败 (${period}):`, err.message)
    );
  }

  let scheduleConfig = readScheduleConfig();
  console.log(`[GridRefresh] 初始定时刷新时间(CST): ${describeSchedule(scheduleConfig)}`);

  // 记录已触发的具体 job，防止同一分钟重复触发
  const triggeredKeys = new Set();

  // 支持配置热重载
  global.__scheduleReload = () => {
    scheduleConfig = readScheduleConfig();
    console.log(`[GridRefresh] 配置已重载，定时刷新时间(CST): ${describeSchedule(scheduleConfig)}`);
  };

  setInterval(() => {
    const now = new Date();
    const dueJobs = getDueScheduleJobs(scheduleConfig, now, triggeredKeys);

    for (const job of dueJobs) {
      triggeredKeys.add(job.triggerKey);
      console.log(`[GridRefresh] 定时触发刷新（CST ${job.time}, type=${job.type}, label=${job.label || '-'})`);
      for (const period of job.periods) {
        startRefresh(period, '定时');
      }
    }

    // 清理过期的触发记录（保留最近48小时）
    const cutoff = Date.now() - (48 * 60 * 60 * 1000);
    for (const key of triggeredKeys) {
      const day = key.slice(0, 10);
      const time = key.slice(11, 16);
      const keyTime = new Date(`${day}T${time}:00+08:00`).getTime();
      if (Number.isFinite(keyTime) && keyTime < cutoff) triggeredKeys.delete(key);
    }
  }, 60 * 1000); // 每分钟检查一次，支持后台配置的具体分钟
}

module.exports = app;
