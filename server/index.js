const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
// 触发重启
require('dotenv').config();

const weatherRoutes = require('./routes/weather');
const firecloudRoutes = require('./routes/firecloud');
const predictionRoutes = require('./routes/prediction');
const visitorRoutes = require('./routes/visitor');
const { requestLogger, errorLogger } = require('./middleware/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// 支持逗号分隔的多个 CORS 来源（如 "http://localhost:9002,http://localhost:8080"）
const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:9002')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

// Middleware
app.use(cors({
  origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins
}));
app.use(express.json());
app.use(morgan('combined')); // HTTP request logging
app.use(requestLogger()); // Custom request logging

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

app.use('/api/weather', weatherRoutes);
app.use('/api/firecloud', firecloudRoutes);
app.use('/api/prediction', predictionRoutes);
app.use('/api/visitor', visitorRoutes);

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
});

module.exports = app;
