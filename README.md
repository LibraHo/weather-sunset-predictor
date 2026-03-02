# 霞客 · Sunset Voyager

基于 Windy API 的火烧云（晚霞/朝霞）预测 Web 应用程序，支持实时天气数据、多因子预测算法、10 种语言、响应式设计。

---

## 快速开始

### 1. 安装依赖

```bash
# 前端依赖
npm install

# 后端依赖（含 SQLite）
cd server && npm install && cd ..
```

### 2. 配置环境变量

```bash
cd server
cp .env.example .env
```

编辑 `server/.env`，填入必要的 Key：

```env
# Windy API（天气数据，必填）
WINDY_API_KEY=your_windy_point_forecast_key

# Windy 地图 Key
WINDY_MAP_API_KEY=your_windy_map_key

# 高德地图地理编码（中国大陆部署必填）
GAODE_API_KEY=your_gaode_key

# 服务器配置
PORT=3000
NODE_ENV=development
CORS_ORIGIN=*
```

> **获取方式：**
> - Windy API：https://api.windy.com/
> - 高德地图：https://lbs.amap.com/（免费注册）

### 3. 启动服务

```bash
# 后端（终端 A）
cd server && npm run dev

# 前端（终端 B）
python3 server.py
```

默认访问地址：
- 前端：`http://localhost:9002`
- 后端健康检查：`http://localhost:3000/health`

---

## 生产部署（腾讯云 / Linux 服务器）

```bash
# 1. 下载代码
git clone https://github.com/LibraHo/weather-sunset-predictor.git
cd weather-sunset-predictor

# 2. 安装依赖
npm install
cd server && npm install && cd ..

# 3. 配置 .env
cd server && cp .env.example .env
# 编辑 .env 填入生产 Key

# 4. 启动后端
cd server && nohup node index.js > /tmp/weather-backend.log 2>&1 &

# 5. 启动前端
nohup python3 server.py > /tmp/weather-frontend.log 2>&1 &
```

> **访客数据库** 自动创建于 `~/.xiake/visitor.db`，与代码目录隔离，重新部署不丢失数据。

### nginx 配置参考

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 后端 API
    location /api/ {
        proxy_pass http://localhost:3000;
    }

    location /health {
        proxy_pass http://localhost:3000;
    }

    # 前端
    location / {
        proxy_pass http://localhost:9002;
        proxy_set_header Cache-Control "no-cache";
    }
}
```

---

## 项目结构

```
weather-sunset-predictor/
├── src/                        # 前端源代码（ES6 模块）
│   ├── app.js                  # 应用入口
│   ├── i18n.js                 # 国际化单例
│   ├── components/             # UI 组件（LanguageSelector、SettingsPanel）
│   ├── controllers/            # 控制层（App、Weather、Prediction）
│   ├── models/                 # 数据模型（Location、WeatherData、SunsetPrediction）
│   ├── services/               # 服务层（18 个服务，含 Mock 变体）
│   ├── locales/                # 翻译文件（10 种语言）
│   └── utils/                  # 工具函数（ErrorHandler、UnitConverter）
├── server/                     # 后端 Node.js 服务器（CommonJS）
│   ├── index.js                # Express 服务器入口
│   ├── routes/                 # API 路由（weather、firecloud、prediction）
│   ├── services/               # 后端服务（WindyAPI、增强预测、火烧云）
│   ├── utils/                  # 工具函数（SunCalculator、GaussianScore）
│   ├── middleware/             # HTTP 日志中间件
│   ├── scripts/                # Python 脚本（GFS 数据处理）
│   ├── package.json            # 后端依赖
│   └── .env.example            # 环境变量模板
├── tests/                      # 测试目录
│   ├── unit/                   # Jest 单元测试（含 server/ 后端测试）
│   ├── integration/            # Jest 集成测试
│   ├── property/               # fast-check 属性测试
│   └── e2e/                    # Playwright E2E 测试
├── styles/                     # CSS 样式（main.css、rtl.css、settings-panel.css）
├── .kiro/specs/                # 规格文档（需求、设计、任务）
├── index.html                  # 主 HTML 页面
├── config.api.js               # 前端 API 模式配置
├── server.py                   # Python 开发服务器（端口 9002）
├── package.json                # 前端 + 测试依赖
├── jest.config.js              # Jest 配置
└── playwright.config.js        # Playwright E2E 配置
```

## 功能特性

- 位置选择（手动输入或 GPS 定位）
- 实时天气数据展示（7 天总览、24 小时图表）
- 火烧云预测算法（多因子加权评分）
- 未来预测时间线、黄金时段/蓝调时段
- 周边 8 方向采样可视化（雷达图）
- 火烧云热图叠加层（Leaflet + OSM）
- 本地收藏夹与搜索历史
- 多语言支持（10 种语言，含阿拉伯语 RTL）
- 响应式设计（PC 和移动端）
- 毛玻璃 UI 效果（Glassmorphism）
- 深色 / 浅色 / 跟随系统主题

## 技术栈

- **前端**: 原生 JavaScript (ES6+), HTML5, CSS3，无打包工具
- **后端**: Node.js + Express（API 代理、预测算法）
- **地图**: Leaflet + OpenStreetMap
- **天气 API**: Windy Point Forecast API（通过后端代理）
- **测试**: Jest + fast-check + Playwright + Supertest
- **存储**: LocalStorage API

---

## 快速开始

项目采用**前后端分离**架构，需分别启动前端静态服务器和后端代理服务器。

### 第一步：安装依赖

```bash
# 安装前端 / 测试依赖（根目录）
npm install

# 安装后端依赖
cd server && npm install && cd ..
```

### 第二步：配置后端环境变量

```bash
cd server
cp .env.example .env
```

编辑 `server/.env`，填入真实密钥：

```env
# Windy Point Forecast API 密钥（必填，用于天气数据代理）
# 获取方式: https://api.windy.com/
WINDY_API_KEY=your_point_forecast_api_key_here

# Windy Map API 密钥（可选，用于地图叠加层）
# 获取方式: https://api.windy.com/
WINDY_MAP_API_KEY=your_map_api_key_here

# 服务器端口（默认 3000）
PORT=3000

# 运行环境
NODE_ENV=development

# CORS 允许的前端地址（需与前端服务器地址匹配）
CORS_ORIGIN=http://localhost:9002

# 速率限制：15 分钟内最多 100 次请求
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 第三步：启动后端服务器

```bash
# 开发模式（nodemon 自动重启，推荐）
cd server && npm run dev

# 生产模式
cd server && npm start
```

后端服务器将在 `http://localhost:3000` 启动。

### 第四步：启动前端服务器

新开一个终端，在项目根目录运行：

```bash
# 推荐：使用项目内置的 Python 服务器（端口 9002）
python server.py

# 或使用 Node.js http-server（端口 8080，供 E2E 测试使用）
npx http-server . -p 8080 -c-1
```

然后访问 `http://localhost:9002`（或 `http://localhost:8080`）。

---

## 配置说明

### 前端 API 配置（config.api.js）

前端 API 访问模式固定为**后端代理模式**（`proxy`）。

```javascript
// config.api.js
const API_CONFIG = {
  mode: 'proxy',          // 固定使用后端代理（不可改为 direct）

  proxy: {
    url: 'http://localhost:3000',  // 后端服务器地址
  },

  features: {
    USE_BACKEND_PREDICTION: true,   // 基础预测使用后端 API
    USE_BACKEND_SURROUNDING: true,  // 周边聚合使用后端 API
    USE_BACKEND_ENHANCED: true      // 增强预测使用后端 API
  }
};
```

**修改后端地址**（如后端部署在非本地或非 3000 端口）：

方式一：直接编辑 `config.api.js` 中的 `proxy.url`。

方式二：通过浏览器控制台动态修改（会持久化到 localStorage）：

```javascript
// 在浏览器控制台运行
import { saveConfig } from './config.api.js';
saveConfig({ proxyUrl: 'http://your-backend-host:3000' });
location.reload();
```

**功能开关说明**：

| 开关 | 说明 | 默认值 |
|------|------|--------|
| `USE_BACKEND_PREDICTION` | 单点基础预测走后端 API | `true` |
| `USE_BACKEND_SURROUNDING` | 周边 8 方向聚合预测走后端 API | `true` |
| `USE_BACKEND_ENHANCED` | 增强版预测（云层分析、黄金时段）走后端 API | `true` |

设为 `false` 时自动回退到前端计算（备用机制）。

---

### 地理编码服务配置

在 `src/app.js` 中切换地理编码模式：

```javascript
// 模式 1：模拟服务（默认，离线可用，内置 50+ 城市）
const geocodingService = new MockGeocodingService();

// 模式 2：真实服务（需网络，使用 OpenStreetMap Nominatim）
// const geocodingService = new GeocodingService();
```

内置城市包括：北京、上海、广州、深圳、成都、杭州、西安、南京、武汉、重庆、东京、伦敦、纽约、巴黎、悉尼等 50+ 座城市。

---

### 天气 API 服务配置

在 `src/app.js` 中切换天气 API 模式：

```javascript
// 模式 1：模拟服务（默认，离线可用，生成 168 小时模拟数据）
const weatherController = new WeatherController(storageService, savedAPIKey, true);

// 模式 2：真实服务（需 Windy API 密钥 + 网络）
// const weatherController = new WeatherController(storageService, savedAPIKey, false);
```

使用真实服务需：
1. 从 [api.windy.com](https://api.windy.com/) 获取 Point Forecast API 密钥
2. 将密钥写入 `server/.env` 的 `WINDY_API_KEY`
3. 确保后端服务器已启动

---

### 后端环境变量详细说明

| 变量名 | 必填 | 默认值 | 说明 |
|--------|------|--------|------|
| `WINDY_API_KEY` | 是 | — | Windy Point Forecast API 密钥 |
| `WINDY_MAP_API_KEY` | 否 | — | Windy 地图 API 密钥（火烧云叠加层） |
| `PORT` | 否 | `3000` | 后端服务器监听端口 |
| `NODE_ENV` | 否 | `development` | 运行环境（`development` / `production`） |
| `CORS_ORIGIN` | 否 | `http://localhost:9002` | 允许跨域的前端地址 |
| `RATE_LIMIT_WINDOW_MS` | 否 | `900000` | 速率限制时间窗口（毫秒），默认 15 分钟 |
| `RATE_LIMIT_MAX_REQUESTS` | 否 | `100` | 时间窗口内最大请求次数 |

**多前端地址 CORS 配置**（如需同时支持多个端口）：

```env
# 多地址用逗号分隔
CORS_ORIGIN=http://localhost:9002,http://localhost:8080
```

---

## 后端 API 端点

后端运行于 `http://localhost:3000`，提供以下端点：

### 基础端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/health` | GET | 健康检查 |
| `/api/config/map-key` | GET | 获取地图 API 密钥（供前端使用） |

### 天气数据

| 端点 | 方法 | 参数 | 说明 |
|------|------|------|------|
| `/api/weather/forecast` | GET | `lat`, `lon`, `hours`(可选,默认168) | 代理 Windy 天气预测数据 |

### 火烧云叠加层

| 端点 | 方法 | 参数 | 说明 |
|------|------|------|------|
| `/api/firecloud/overlay` | GET | `lat`, `lon`, `radius`, `type` | 生成火烧云热图叠加层（调用 Python GFS 处理器） |

### 预测算法（前后端分离 API）

| 端点 | 方法 | 说明 | 缓存 TTL |
|------|------|------|----------|
| `/api/prediction/calculate` | POST | 单点基础预测 | 30 分钟 |
| `/api/prediction/surrounding` | POST | 周边 8 方向聚合预测 | 1 小时 |
| `/api/prediction/enhanced` | POST | 增强版单点预测（云层分析） | 30 分钟 |
| `/api/prediction/enhanced/batch` | POST | 多天批量预测 | 30 分钟 |
| `/api/prediction/canvas` | POST | 云况画布评分 | 30 分钟 |
| `/api/prediction/rendering` | POST | 渲染因子评分 | 30 分钟 |

---

## 开发工作流建议

- 首次运行建议先使用 **Mock 模式**（无需 API Key），确认页面交互和预测流程正常。
- 接入真实数据时，只需在 `server/.env` 配置 `WINDY_API_KEY` 并重启后端。
- 本地调试建议固定端口：前端 `9002`、后端 `3000`，可避免 CORS 和配置漂移问题。

---

## 运行测试

### 单元测试 + 集成测试 + 属性测试（Jest）

```bash
# 运行所有 Jest 测试
npm test

# 监听模式（开发时推荐）
npm run test:watch

# 生成覆盖率报告
npm run test:coverage
```

覆盖率要求：语句 ≥80%，函数 ≥85%，分支 ≥75%，行 ≥80%。

### E2E 测试（Playwright）

E2E 测试会自动启动 `http://localhost:8080`，**无需手动启动服务器**。

```bash
# 运行所有 E2E 测试（Headless）
npm run test:e2e

# 有界面模式（调试推荐）
npm run test:e2e:headed

# 调试模式
npm run test:e2e:debug

# 交互式 UI 模式
npm run test:e2e:ui

# 查看上次测试报告
npm run test:e2e:report
```

支持浏览器：Chromium、Firefox、WebKit、Mobile Chrome (Pixel 5)、Mobile Safari (iPhone 12)。

---

## 端口说明

| 服务 | 端口 | 命令 |
|------|------|------|
| 前端开发服务器（推荐） | 9002 | `python server.py` |
| 前端静态服务器（E2E 用） | 8080 | `npx http-server . -p 8080` |
| 后端代理服务器 | 3000 | `cd server && npm run dev` |

---

## 生产部署

### 后端部署（Node.js）

推荐使用 PM2 进程管理：

```bash
npm install -g pm2
cd server
pm2 start index.js --name weather-api
pm2 save
pm2 startup
```

### Nginx 反向代理示例

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    location / {
        root /path/to/weather-sunset-predictor;
        index index.html;
    }

    # 后端 API 代理（后端仅监听本机端口，不对公网暴露）
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

> 部署建议：公网仅开放 80/443 给 Nginx，不需要直接暴露 Node.js 的 3000 端口。

生产环境下 `CORS_ORIGIN` 需改为实际域名：

```env
NODE_ENV=production
CORS_ORIGIN=https://your-domain.com
WINDY_API_KEY=your_production_api_key
WINDY_MAP_API_KEY=your_production_map_key
```

---

## 故障排查

### CORS 错误

检查 `server/.env` 中 `CORS_ORIGIN` 是否与前端实际地址一致（含协议和端口）。

### 后端连接失败（ERR_CONNECTION_REFUSED）

确认后端已启动：

```bash
curl http://localhost:3000/health
# 预期返回: {"status":"ok","timestamp":"..."}
```

同时检查 Nginx 反向代理是否指向正确后端端口（`proxy_pass http://localhost:3000`）。

> 前端在域名环境下默认请求同源地址（`window.location.origin`），通常无需修改 `config.api.js`；
> 仅本地开发（localhost）默认使用 `http://localhost:3000`。

### Windy API 密钥无效（401）

- 确认 `server/.env` 中 `WINDY_API_KEY` 已正确填写（无多余空格）
- 前往 [api.windy.com](https://api.windy.com/) 确认密钥有效
- 重启后端服务器使新密钥生效

### 请求被限流（429）

调整 `server/.env` 中的速率限制参数：

```env
RATE_LIMIT_WINDOW_MS=900000   # 时间窗口（毫秒）
RATE_LIMIT_MAX_REQUESTS=200   # 增大限制次数
```

---

## 浏览器支持

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

---

## 许可证

MIT License

## 相关文档

- [需求文档](.kiro/specs/weather-sunset-predictor/requirements.md)
- [设计文档](.kiro/specs/weather-sunset-predictor/design.md)
- [任务列表](.kiro/specs/weather-sunset-predictor/tasks.md)
- [后端 API 文档](server/README.md)
