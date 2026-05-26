# Weather Sunset Predictor — 后端服务器

后端代理服务器，用于提供天气数据接口与预测算法服务。

> Phase 11 起，天气数据源默认 **Open‑Meteo first**。Windy 保留为回退与地图能力，不再作为默认主数据源。

## 功能特性

- 代理 Windy Point Forecast API 请求（保护 API 密钥）
- 预测算法后端化（单点、周边聚合、增强版、批量）
- 火烧云叠加层生成（调用 Python GFS 处理器）
- 地图 API 密钥安全下发
- CORS 配置、速率限制、请求日志

## 技术栈

- **运行时**: Node.js (CommonJS)
- **框架**: Express
- **依赖**: cors, dotenv, morgan, axios, nodemon(dev)

---

## 快速开始

### 1. 安装依赖

```bash
cd server
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件（Open‑Meteo 模式可不填 Windy Key）：

```env
# Windy Point Forecast API 密钥（必填）
# 获取方式: https://api.windy.com/
WINDY_API_KEY=your_point_forecast_api_key_here

# 主/备天气数据源（Phase 12 默认）
PRIMARY_WEATHER_PROVIDER=openmeteo
ENABLE_WINDY_EMERGENCY_FALLBACK=false
FALLBACK_WEATHER_PROVIDER=windy

# Windy 特有子评分开关（默认关闭）
ENABLE_CAPE_SCORE=false
ENABLE_CONVECTIVE_PRECIP_SCORE=false

# Windy Map API 密钥（可选，用于前端地图叠加层）
# 获取方式: https://api.windy.com/
WINDY_MAP_API_KEY=your_map_api_key_here

# 服务器端口，默认 3000
PORT=3000

# 运行环境（development / production）
NODE_ENV=development

# CORS 允许的前端地址（多地址用逗号分隔）
CORS_ORIGIN=http://localhost:9002

# 速率限制：时间窗口（毫秒）
RATE_LIMIT_WINDOW_MS=900000

# 速率限制：时间窗口内最大请求次数
RATE_LIMIT_MAX_REQUESTS=100
```

### 3. 启动服务器

```bash
# 开发模式（nodemon 自动重启，推荐）
npm run dev

# 生产模式
npm start
```

服务器将在 `http://localhost:3000` 启动。验证：

```bash
curl http://localhost:3000/health
# {"status":"ok","timestamp":"2026-02-13T10:00:00.000Z"}
```

---

## 环境变量说明

| 变量名 | 必填 | 默认值 | 说明 |
|--------|------|--------|------|
| `WINDY_API_KEY` | 条件必填 | — | 仅在启用 Windy 回退/联调时需要 |
| `PRIMARY_WEATHER_PROVIDER` | 否 | `openmeteo` | 主天气数据源（Phase 11 默认 Open‑Meteo） |
| `ENABLE_WINDY_EMERGENCY_FALLBACK` | 否 | `false` | 是否启用 Windy 紧急回退 |
| `FALLBACK_WEATHER_PROVIDER` | 否 | `windy` | 回退天气数据源（仅 emergency fallback 启用时生效） |
| `ENABLE_CAPE_SCORE` | 否 | `false` | 是否启用 `cape` 子评分 |
| `ENABLE_CONVECTIVE_PRECIP_SCORE` | 否 | `false` | 是否启用 `convPrecip` 子评分 |
| `WINDY_MAP_API_KEY` | 否 | — | Windy 地图 API 密钥 |
| `PORT` | 否 | `3000` | 服务器监听端口 |
| `NODE_ENV` | 否 | `development` | 运行环境 |
| `CORS_ORIGIN` | 否 | `http://localhost:9002` | 允许跨域的前端地址（逗号分隔多地址） |
| `RATE_LIMIT_WINDOW_MS` | 否 | `900000` | 速率限制时间窗口（毫秒），默认 15 分钟 |
| `RATE_LIMIT_MAX_REQUESTS` | 否 | `100` | 时间窗口内最大请求次数 |

---

## API 端点

### 基础端点

#### GET /health

健康检查。

```bash
curl http://localhost:3000/health
```

响应：
```json
{
  "status": "ok",
  "timestamp": "2026-02-13T10:00:00.000Z"
}
```

#### GET /api/config/map-key

获取 Windy 地图 API 密钥，供前端地图组件使用（避免密钥在代码中硬编码）。

```bash
curl http://localhost:3000/api/config/map-key
```

响应：
```json
{
  "mapApiKey": "your_map_api_key"
}
```

---

#### GET /api/visitor/count

读取共享访问人数计数。网页端和微信小程序共用同一个持久化文件 `~/.xiake/visitor-count.json`，不会因部署或重启清空。

**响应示例：**
```json
{
  "count": 12345,
  "byClient": {
    "web": 10000,
    "miniprogram": 2345
  }
}
```

#### POST /api/visitor/count

累计一次可计数访问。请求可以通过 `X-Xiake-Client` header 或 JSON body 的 `client` 字段标记来源，支持值：

- `web`
- `miniprogram`

旧数据只有总数时会按总数兼容读取；新增来源统计只从上线后的新请求开始累加。

**请求示例：**
```bash
curl -X POST "http://localhost:3000/api/visitor/count" \
  -H "Content-Type: application/json" \
  -H "X-Xiake-Client: miniprogram" \
  -d '{"client":"miniprogram"}'
```

---

### 天气数据

#### GET /api/weather/forecast

代理 Windy Point Forecast API，获取指定位置的天气预测数据。

**查询参数：**

| 参数 | 必填 | 范围 | 说明 |
|------|------|------|------|
| `lat` | 是 | -90 ~ 90 | 纬度 |
| `lon` | 是 | -180 ~ 180 | 经度 |
| `hours` | 否 | 1 ~ 168，默认 168 | 预测小时数 |

**请求示例：**
```bash
curl "http://localhost:3000/api/weather/forecast?lat=39.9042&lon=116.4074&hours=24"
```

**响应示例：**
```json
{
  "success": true,
  "location": { "lat": 39.9042, "lon": 116.4074 },
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

---

### 火烧云叠加层

#### GET /api/firecloud/overlay

生成火烧云热图叠加层图像（PNG），通过调用 Python GFS 处理器实现。

**查询参数：**

| 参数 | 必填 | 说明 |
|------|------|------|
| `lat` | 是 | 中心点纬度 |
| `lon` | 是 | 中心点经度 |
| `radius` | 否 | 采样半径（km），可选值：50 / 100 / 150 |
| `type` | 否 | 叠加层类型（`sunset` / `sunrise`） |

**请求示例：**
```bash
curl "http://localhost:3000/api/firecloud/overlay?lat=39.9042&lon=116.4074&radius=100&type=sunset"
```

**响应**：PNG 图像（`Content-Type: image/png`）

#### GET /api/firecloud/grid

获取火烧云网格数据（中国范围 PoC + 全球统一接口）。

**查询参数：**

| 参数 | 必填 | 说明 |
|------|------|------|
| `bbox` | 是 | `west,south,east,north` |
| `zoom` | 否 | 缩放等级，默认 `6` |
| `time` | 否 | Unix 毫秒时间戳 |

#### GET /api/firecloud/tiles/:z/:x/:y.png

火烧云专题瓦片接口（Phase 11，服务端缓存）。

---

### 预测算法 API

前后端分离架构（需求 22）将预测算法迁移至后端，支持缓存和多平台复用。

#### POST /api/prediction/calculate

单点基础火烧云预测。缓存 TTL：30 分钟。

**请求体：**
```json
{
  "weatherData": {
    "timestamp": 1640000000,
    "cloudCover": 45,
    "humidity": 60,
    "visibility": 10,
    "lowClouds": 20,
    "midClouds": 30,
    "highClouds": 15,
    "temp": 15.2,
    "windSpeed": 12.5
  },
  "location": { "lat": 39.9042, "lon": 116.4074 },
  "targetTime": "sunset"
}
```

**响应示例：**
```json
{
  "success": true,
  "prediction": {
    "score": 72,
    "quality": "excellent",
    "label": "极佳",
    "factors": {
      "cloudCover": 0.85,
      "humidity": 0.78,
      "visibility": 0.90,
      "lowClouds": 0.70
    }
  }
}
```

质量等级：`excellent`（>70）、`good`（40~70）、`fair`（<40）。

---

#### POST /api/prediction/surrounding

周边 8 方向（N/NE/E/SE/S/SW/W/NW）聚合预测。缓存 TTL：1 小时。

**请求体：**
```json
{
  "location": { "lat": 39.9042, "lon": 116.4074 },
  "radius": 100,
  "weatherDataList": [ /* 8 方向的天气数据数组 */ ]
}
```

**响应示例：**
```json
{
  "success": true,
  "surrounding": {
    "average": 65,
    "max": 82,
    "directions": {
      "N":  { "score": 70, "quality": "good" },
      "NE": { "score": 82, "quality": "excellent" },
      "E":  { "score": 60, "quality": "good" },
      "SE": { "score": 55, "quality": "good" },
      "S":  { "score": 48, "quality": "good" },
      "SW": { "score": 65, "quality": "good" },
      "W":  { "score": 72, "quality": "excellent" },
      "NW": { "score": 58, "quality": "good" }
    }
  }
}
```

---

#### POST /api/prediction/enhanced

增强版单点预测，包含云层分析、黄金时段/蓝调时段计算。缓存 TTL：30 分钟。

**请求体：**
```json
{
  "weatherData": { /* 同 /calculate */ },
  "location": { "lat": 39.9042, "lon": 116.4074 },
  "date": "2026-02-13"
}
```

**响应示例：**
```json
{
  "success": true,
  "enhanced": {
    "score": 75,
    "quality": "excellent",
    "goldenHour": { "start": "17:42", "end": "18:10" },
    "blueHour":   { "start": "18:10", "end": "18:35" },
    "cloudLayers": {
      "high": { "cover": 15, "impact": "positive" },
      "mid":  { "cover": 30, "impact": "positive" },
      "low":  { "cover": 20, "impact": "neutral" }
    }
  }
}
```

---

#### POST /api/prediction/enhanced/batch

多天批量预测（最多 10 天）。缓存 TTL：30 分钟。

**请求体：**
```json
{
  "location": { "lat": 39.9042, "lon": 116.4074 },
  "weatherDataByDay": [
    { "date": "2026-02-13", "data": [ /* 24 小时天气数据 */ ] },
    { "date": "2026-02-14", "data": [ /* ... */ ] }
  ]
}
```

---

#### GET /api/prediction/home

首页统一聚合接口。网页端和微信小程序首页查分都应优先调用该接口，保证同一地点、同一天、同一朝霞/晚霞类型使用同一份后端天气输入和评分结果。

**查询参数：**

| 参数 | 必填 | 说明 |
|------|------|------|
| `lat` | 是 | 纬度 |
| `lon` | 是 | 经度 |
| `date` | 否 | 本地日期，格式 `YYYY-MM-DD`；默认今天 |
| `period` / `type` | 否 | 当前主预测类型：`sunrise` / `sunset`；默认 `sunset` |
| `days` | 否 | 返回天数，范围 1~4；默认 4 |
| `hours` | 否 | 天气窗口小时数，默认 168 |
| `includeRemoteCloudData` | 否 | 是否包含远端光路采样，默认 `true` |

**请求示例：**
```bash
curl "http://localhost:3000/api/prediction/home?lat=39.9042&lon=116.4074&date=2026-05-26&period=sunset&days=4"
```

**响应结构：**
```json
{
  "success": true,
  "request": {
    "location": { "lat": 39.9042, "lon": 116.4074 },
    "date": "2026-05-26",
    "period": "sunset",
    "days": 4
  },
  "weather": {
    "current": { "temp": 22.6, "cloudCover": 16, "windSpeed": 2 },
    "hourly": [ /* 168h weather data */ ],
    "daily": [ /* daily summary */ ]
  },
  "predictions": {
    "current": { "type": "sunset", "score": 72 },
    "sunrise": { "type": "sunrise", "score": 58 },
    "sunset": { "type": "sunset", "score": 72 },
    "list": [ /* sunrise/sunset items for each day */ ],
    "byDate": {
      "2026-05-26": {
        "sunrise": { "score": 58 },
        "sunset": { "score": 72 }
      }
    }
  },
  "source": {
    "api": "prediction-home-gateway",
    "weather": "closed-loop"
  },
  "profile": {
    "weatherFetchMs": 781.2,
    "calculateMs": 1.5,
    "totalMs": 6262.1
  }
}
```

---

#### POST /api/prediction/canvas

云况画布评分——评估当前云型对火烧云的视觉呈现潜力。缓存 TTL：30 分钟。

**请求体：**
```json
{
  "cloudData": {
    "lowClouds": 20,
    "midClouds": 30,
    "highClouds": 15,
    "cloudCover": 45
  }
}
```

---

#### POST /api/prediction/rendering

渲染因子评分——综合大气散射、尘埃、湿度等渲染条件评分。缓存 TTL：30 分钟。

**请求体：**
```json
{
  "weatherData": {
    "humidity": 60,
    "visibility": 10,
    "aod": 0.15
  }
}
```

---

## 错误响应格式

所有端点在出错时返回统一格式：

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "描述信息"
  }
}
```

常见错误码：

| HTTP 状态 | code | 说明 |
|-----------|------|------|
| 400 | `INVALID_PARAMS` | 缺少必填参数或参数格式错误 |
| 401 | `INVALID_API_KEY` | Windy API 密钥无效或已过期 |
| 429 | `RATE_LIMIT_EXCEEDED` | 请求过于频繁，超出速率限制 |
| 500 | `INTERNAL_SERVER_ERROR` | 服务器内部错误 |

---

## 项目结构

```
server/
├── index.js                        # Express 服务器入口
├── package.json                    # 后端依赖（CommonJS）
├── .env.example                    # 环境变量模板
├── .env                            # 实际环境变量（不提交到 git）
├── middleware/
│   └── logger.js                   # HTTP 请求日志中间件
├── routes/
│   ├── weather.js                  # GET /api/weather/forecast
│   ├── firecloud.js                # GET /api/firecloud/overlay
│   └── prediction.js               # POST /api/prediction/*
├── services/
│   ├── WindyAPIService.js          # Windy API 代理封装
│   ├── EnhancedPredictionService.js # 增强预测服务（含缓存）
│   └── FireCloudService.js         # 火烧云叠加层服务（含 Python 调用）
├── utils/
│   ├── SunCalculator.js            # 日出/日落/黄金时段计算（NOAA 算法）
│   └── GaussianScore.js            # 高斯评分函数（云覆盖、湿度、能见度）
└── scripts/
    ├── gfs_processor.py            # Python：GFS GRIB2 数据处理 + PNG 生成
    └── requirements.txt            # Python 依赖（xarray、cfgrib、numpy、Pillow）
```

---

## 日志

服务器使用 `morgan` 记录 HTTP 请求，并通过自定义中间件输出：

```
[2026-02-13T10:00:00.000Z] GET /api/weather/forecast
查询参数: {"lat":"39.9042","lon":"116.4074"}
[2026-02-13T10:00:01.234Z] GET /api/weather/forecast - 状态: 200 - 耗时: 1234ms
```

日志中**不记录** API 密钥等敏感信息。

---

## 缓存策略

| API 类型 | TTL |
|----------|-----|
| 单点基础预测 | 30 分钟 |
| 周边聚合预测 | 1 小时 |
| 增强预测 / 批量 / 画布 / 渲染 | 30 分钟 |
| 天气数据（Windy） | 15 分钟 |
| 火烧云叠加层 | 30 分钟 |

---

## 安全考虑

1. **API 密钥保护**：密钥存储于环境变量，不在前端代码中暴露
2. **CORS 限制**：仅允许 `CORS_ORIGIN` 指定的来源跨域访问
3. **参数验证**：严格校验所有输入参数（范围、类型）
4. **速率限制**：防止 Windy API 被过度调用
5. **日志安全**：日志中过滤敏感字段
6. **HTTPS**：生产环境应通过 Nginx/反向代理启用 HTTPS

---

## 生产部署

### PM2 进程管理

```bash
npm install -g pm2
pm2 start index.js --name weather-api
pm2 save
pm2 startup
```

### Nginx 反向代理

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /health {
        proxy_pass http://localhost:3000;
    }
}
```

> 推荐仅让 Nginx 对外提供 80/443，Node.js 后端端口（如 3000）保持内网/本机可访问即可。

生产环境变量：

```env
NODE_ENV=production
PORT=3000
WINDY_API_KEY=your_production_api_key
WINDY_MAP_API_KEY=your_production_map_key
CORS_ORIGIN=https://your-domain.com
```

---

## 故障排查

### 无法连接到 Windy API

1. 确认 `.env` 中 `WINDY_API_KEY` 正确（无多余空格或引号）
2. 检查网络是否能访问 `api.windy.com`
3. 确认密钥在 [api.windy.com](https://api.windy.com/) 控制台处于激活状态
4. 重启服务器使新密钥生效

### CORS 错误

1. 检查 `.env` 中 `CORS_ORIGIN` 是否与前端实际地址完全匹配（含协议、主机名、端口）
2. 若同时使用多个前端端口，用逗号分隔：`CORS_ORIGIN=http://localhost:9002,http://localhost:8080`
3. 若为域名部署，请确保前端通过同源地址访问 `/api/*`（由 Nginx 反代），避免浏览器直接请求 `localhost:3000`

### 请求超时

1. 调整 `services/WindyAPIService.js` 中的 `timeout` 配置
2. 检查到 Windy API 的网络延迟

### Python GFS 脚本失败（火烧云叠加层）

1. 确认已安装 Python 依赖：`pip install -r scripts/requirements.txt`
2. 查看 Node.js 进程日志中的 `child_process` 错误输出

---

## 开发

### 运行测试

后端单元测试集成在根目录的 Jest 配置中：

```bash
# 在项目根目录运行
npm test

# 仅运行后端相关测试
npm test -- --testPathPattern=server
```

---

## 许可证

MIT
