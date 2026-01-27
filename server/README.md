# Weather Sunset Predictor - Backend Server

后端代理服务器，用于保护 Windy API 密钥并提供天气数据接口。

## 功能特性

- ✅ 代理 Windy Point Forecast API 请求
- ✅ 保护 API 密钥不在前端暴露
- ✅ 请求日志记录（不包含敏感信息）
- ✅ 错误处理和用户友好的错误消息
- ✅ CORS 配置
- ✅ 参数验证

## 快速开始

### 1. 安装依赖

```bash
cd server
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
# Windy API Configuration
WINDY_API_KEY=your_actual_api_key_here

# Server Configuration
PORT=3000
NODE_ENV=development

# CORS Configuration
CORS_ORIGIN=http://localhost:9002

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 3. 启动服务器

开发模式（自动重启）：
```bash
npm run dev
```

生产模式：
```bash
npm start
```

服务器将在 `http://localhost:3000` 启动。

## API 端点

### GET /health

健康检查端点。

**响应示例：**
```json
{
  "status": "ok",
  "timestamp": "2026-01-27T10:00:00.000Z"
}
```

### GET /api/weather/forecast

获取天气数据。

**查询参数：**
- `lat` (必填): 纬度，范围 -90 到 90
- `lon` (必填): 经度，范围 -180 到 180
- `hours` (可选): 预测小时数，范围 1 到 168，默认 168

**请求示例：**
```bash
curl "http://localhost:3000/api/weather/forecast?lat=39.9042&lon=116.4074&hours=24"
```

**响应示例：**
```json
{
  "success": true,
  "location": {
    "lat": 39.9042,
    "lon": 116.4074
  },
  "hours": 24,
  "data": [
    {
      "timestamp": 1640000000,
      "temp": 15.2,
      "humidity": 65,
      "cloudCover": 45,
      "windSpeed": 12.5,
      "windDirection": 180,
      "pressure": 1013,
      "visibility": 10,
      "precipitation": 0,
      "lowClouds": 20,
      "midClouds": 30,
      "highClouds": 15
    }
  ]
}
```

## 错误响应

### 400 Bad Request

无效的参数：

```json
{
  "error": {
    "code": "INVALID_PARAMS",
    "message": "缺少必填参数: lat 和 lon"
  }
}
```

### 401 Unauthorized

API 密钥无效：

```json
{
  "error": {
    "code": "INVALID_API_KEY",
    "message": "Windy API 密钥无效或已过期"
  }
}
```

### 429 Too Many Requests

请求过于频繁：

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Windy API 请求过于频繁，请稍后再试"
  }
}
```

### 500 Internal Server Error

服务器内部错误：

```json
{
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "服务器内部错误"
  }
}
```

## 日志

服务器使用 `morgan` 中间件记录 HTTP 请求，并使用自定义日志中间件记录：

- 请求时间戳
- 请求方法和路径
- 查询参数（不包含敏感信息）
- 响应状态码
- 请求耗时

示例日志输出：

```
[2026-01-27T10:00:00.000Z] GET /api/weather/forecast
查询参数: {"lat":"39.9042","lon":"116.4074"}
[2026-01-27T10:00:01.234Z] GET /api/weather/forecast - 状态: 200 - 耗时: 1234ms
```

## 项目结构

```
server/
├── index.js           # 主服务器文件
├── package.json       # 依赖和脚本
├── .env.example       # 环境变量示例
├── .env               # 实际环境变量（不提交到git）
├── middleware/
│   └── logger.js      # 日志中间件
├── routes/
│   └── weather.js     # 天气路由
└── services/
    └── windyService.js # Windy API 服务
```

## 安全考虑

1. **API 密钥保护**: API 密钥存储在服务器环境变量中，不在前端代码暴露
2. **CORS 配置**: 限制允许的跨域来源
3. **参数验证**: 严格验证所有输入参数
4. **日志安全**: 日志中不记录敏感信息（API 密钥等）
5. **HTTPS**: 生产环境应使用 HTTPS
6. **速率限制**: 防止 API 被滥用（待实施）

## 生产部署

### 环境变量

确保在生产环境中设置以下环境变量：

- `NODE_ENV=production`
- `WINDY_API_KEY=your_production_api_key`
- `PORT=3000`（或使用反向代理）
- `CORS_ORIGIN=https://your-domain.com`

### 使用 PM2

推荐使用 PM2 进行进程管理：

```bash
npm install -g pm2
pm2 start index.js --name weather-api
pm2 save
pm2 startup
```

### 反向代理

使用 Nginx 作为反向代理：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 故障排查

### 问题：无法连接到 Windy API

**解决方案：**
1. 检查 API 密钥是否正确
2. 检查网络连接
3. 查看 Windy API 状态页面

### 问题：CORS 错误

**解决方案：**
1. 检查 `.env` 文件中的 `CORS_ORIGIN` 设置
2. 确保前端地址正确

### 问题：请求超时

**解决方案：**
1. 增加 `windyService.js` 中的超时时间
2. 检查网络连接速度

## 开发

### 运行测试

```bash
npm test
```

### 代码格式化

```bash
npm run format
```

## 许可证

MIT
