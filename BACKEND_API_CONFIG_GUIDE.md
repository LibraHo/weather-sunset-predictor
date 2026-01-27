# 后端 API 配置完整指南

本文档详细说明了天气晚霞预测器后端服务器的配置过程、架构和API使用方法。

---

## 📋 目录

1. [项目结构](#项目结构)
2. [依赖安装](#依赖安装)
3. [环境变量配置](#环境变量配置)
4. [API端点说明](#api端点说明)
5. [配置流程](#配置流程)
6. [常见问题](#常见问题)

---

## 项目结构

```
server/
├── package.json           # 项目配置和依赖
├── .env.example           # 环境变量示例模板
├── .env                  # 实际环境变量（不提交到git）
├── index.js              # Express 服务器主文件
├── middleware/
│   └── logger.js        # 请求日志中间件
├── routes/
│   └── weather.js       # 天气API路由
└── services/
    └── windyService.js  # Windy API服务封装
```

---

## 依赖安装

### 1. 初始化项目

```bash
cd server
npm install
```

### 2. package.json 依赖说明

**生产依赖**:
```json
{
  "express": "^4.18.2",      // Web 应用框架
  "cors": "^2.8.5",         // 跨域资源共享
  "dotenv": "^16.3.1",       // 环境变量加载
  "axios": "^1.6.0",         // HTTP 客户端
  "morgan": "^1.10.0"        // HTTP 请求日志
}
```

**开发依赖**:
```json
{
  "nodemon": "^3.0.1"        // 自动重启开发服务器
}
```

### 3. 安装命令

```bash
# 生产环境安装
npm install --production

# 开发环境安装（包含 nodemon）
npm install
```

---

## 环境变量配置

### 1. 创建环境变量文件

**方法 A：使用示例文件**
```bash
cd server
cp .env.example .env
```

**方法 B：手动创建**
```bash
cd server
notepad .env  # Windows
touch .env   # Linux/Mac
```

### 2. 环境变量详解

#### WINDY_API_KEY（必需）
```env
WINDY_API_KEY=your_actual_api_key_here
```

**获取方法**:
1. 访问 [Windy官网](https://www.windy.com/)
2. 注册账号并登录
3. 前往 API密钥页面
4. 创建新的 API 密钥
5. 复制密钥粘贴到 `.env` 文件

**重要提示**:
- ⚠️ **不要将 `.env` 文件提交到 Git**（已在 .gitignore 中）
- ⚠️ **密钥泄露会导致配额被消耗**
- ⚠️ **生产环境应使用独立密钥**

#### PORT（可选）
```env
PORT=3000
```
- 默认值: `3000`
- 说明: 后端服务器监听端口
- 修改场景: 端口冲突时使用其他端口

#### NODE_ENV（可选）
```env
NODE_ENV=development
```
- 可选值: `development`, `production`
- 默认值: `development`
- 说明:
  - `development`: 详细日志，错误堆栈跟踪
  - `production`: 优化日志，最小错误信息

#### CORS_ORIGIN（可选）
```env
CORS_ORIGIN=http://localhost:9002
```
- 默认值: `http://localhost:9002`
- 说明: 允许的前端域名（跨域访问）
- 生产环境示例: `https://your-domain.com`

#### 速率限制（可选）
```env
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```
- 默认值: 15分钟内100个请求
- 说明: 防止API滥用（待实施）

### 3. .env 完整示例

```env
# Windy API Configuration
WINDY_API_KEY=ABC123XYZ789

# Server Configuration
PORT=3000
NODE_ENV=development

# CORS Configuration
CORS_ORIGIN=http://localhost:9002

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

---

## API端点说明

### 1. GET /health

**用途**: 健康检查，监控服务器状态

**请求示例**:
```bash
curl http://localhost:3000/health
```

**响应示例**:
```json
{
  "status": "ok",
  "timestamp": "2026-01-27T12:08:45.660Z"
}
```

**状态码**: 200 OK

---

### 2. GET /api/weather/forecast

**用途**: 获取指定位置的天气数据（代理 Windy API）

**请求参数**:
| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| lat | number | ✅ | - | 纬度 (-90 to 90) |
| lon | number | ✅ | - | 经度 (-180 to 180) |
| hours | number | ❌ | 168 | 预测小时数 (1-168) |

**请求示例**:
```bash
# 获取北京24小时天气
curl "http://localhost:3000/api/weather/forecast?lat=39.9042&lon=116.4074&hours=24"

# 获取上海168小时天气（7天）
curl "http://localhost:3000/api/weather/forecast?lat=31.2304&lon=121.4737"
```

**成功响应** (200 OK):
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
      "timestamp": 1640000000000,
      "temp": 15.2,
      "humidity": 65,
      "cloudCover": 45.0,
      "windSpeed": 12.5,
      "windDirection": 180,
      "pressure": 1013.0,
      "visibility": 10.0,
      "precipitation": 0.0,
      "lowClouds": 20.0,
      "midClouds": 30.0,
      "highClouds": 15.0
    }
  ]
}
```

**错误响应**:

**400 Bad Request** - 参数无效:
```json
{
  "error": {
    "code": "INVALID_PARAMS",
    "message": "缺少必填参数: lat 和 lon"
  }
}
```

**401 Unauthorized** - API密钥错误:
```json
{
  "error": {
    "code": "INVALID_API_KEY",
    "message": "Windy API 密钥错误: ..."
  }
}
```

**429 Too Many Requests** - 请求过于频繁:
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "请求过于频繁，请稍后再试"
  }
}
```

**500 Internal Server Error** - 服务器错误:
```json
{
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "Windy API 服务器错误，请稍后再试"
  }
}
```

---

## 配置流程

### 步骤 1: 安装依赖

```bash
# 进入后端目录
cd server

# 安装所有依赖
npm install

# 验证安装成功
ls node_modules
```

**预期结果**: `node_modules/` 目录被创建，包含所有依赖包。

---

### 步骤 2: 配置环境变量

#### 方法 A: 使用示例文件（推荐）

```bash
# Windows
copy .env.example .env

# Linux/Mac
cp .env.example .env
```

#### 方法 B: 手动创建

1. 创建 `.env` 文件
2. 编辑文件，填入配置：
```env
WINDY_API_KEY=your_actual_api_key_here
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:9002
```

#### 方法 C: 使用命令行（临时配置，不推荐）

**Windows (PowerShell)**:
```powershell
$env:WINDY_API_KEY="your_key"
$env:PORT="3000"
node index.js
```

**Linux/Mac**:
```bash
WINDY_API_KEY="your_key" PORT="3000" node index.js
```

---

### 步骤 3: 获取 Windy API 密钥

1. 访问 [Windy API注册页面](https://www.windy.com/login)
2. 注册账号并验证邮箱
3. 登录后访问 [API密钥管理](https://www.windy.com/api)
4. 创建新项目或使用现有项目
5. 复制 API 密钥

**密钥格式**: 通常是一串字母数字，长度约20-30字符

---

### 步骤 4: 更新 .env 文件

```env
# 替换为你的真实API密钥
WINDY_API_KEY=ABC123XYZ789abc123xyz789

# 其他配置保持默认即可
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:9002
```

---

### 步骤 5: 启动后端服务器

#### 开发模式（支持自动重启）

```bash
cd server
npm run dev
```

**输出示例**:
```
> weather-sunset-predictor-backend@1.0.0 dev
> nodemon index.js

[nodemon] starting `node index.js`
🚀 后端服务器运行在 http://localhost:3000
📝 环境: development
🌐 CORS 允许源: http://localhost:9002
```

#### 生产模式

```bash
cd server
npm start
```

---

### 步骤 6: 验证配置

#### 6.1 检查服务器启动

打开浏览器访问: `http://localhost:3000/health`

**预期响应**:
```json
{
  "status": "ok",
  "timestamp": "2026-01-27T12:00:00.000Z"
}
```

#### 6.2 检查 API 端点

```bash
curl "http://localhost:3000/api/weather/forecast?lat=39.9042&lon=116.4074&hours=1"
```

**预期响应**: 应该返回天气数据或Windy API错误信息

---

## 配置文件详解

### 1. server/index.js - 主服务器文件

**配置代码**:
```javascript
// 端口配置
const PORT = process.env.PORT || 3000;

// CORS配置
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:9002'
}));

// 环境变量读取
require('dotenv').config();
```

**工作原理**:
- `dotenv.config()` 读取 `.env` 文件
- `process.env.VARIABLE_NAME` 访问环境变量
- 提供默认值确保应用可启动

---

### 2. server/services/windyService.js - API服务封装

**API密钥读取**:
```javascript
class WindyService {
  constructor() {
    this.apiKey = process.env.WINDY_API_KEY;
    if (!this.apiKey) {
      console.warn('⚠️  警告: WINDY_API_KEY 环境变量未设置');
    }
  }
}
```

**Windy API 调用**:
```javascript
const requestBody = {
  lat,
  lon,
  model: 'gfs',
  parameters: ['temp', 'rh', 'wind', ...],
  key: this.apiKey  // 从环境变量读取密钥
};

const response = await axios.post(WINDY_API_URL, requestBody);
```

---

### 3. 前端配置 - config.api.js

**API模式配置**:
```javascript
const API_CONFIG = {
  mode: 'proxy',        // 'proxy' 或 'direct'
  proxy: {
    url: 'http://localhost:3000'  // 后端服务器地址
  }
};
```

**前端使用**:
```javascript
const apiService = new WindyAPIService(apiKey, {
  useProxy: API_CONFIG.mode === 'proxy',
  proxyURL: API_CONFIG.proxy.url
});
```

---

## 常见问题

### Q1: 后端服务器启动失败

**错误信息**: `Error: listen EADDRINUSE: address already in use:::3000`

**原因**: 端口3000已被占用

**解决方案**:
```bash
# Windows
netstat -ano | findstr :3000
# 然后找到PID并终止进程

# Linux/Mac
lsof -ti:3000
# 然后杀掉进程
kill -9 [PID]

# 或修改端口
PORT=3001 npm start
```

---

### Q2: 401 Unauthorized - API密钥无效

**错误信息**:
```json
{
  "error": {
    "code": "INVALID_API_KEY",
    "message": "Windy API 密钥错误"
  }
}
```

**解决方案**:
1. 检查 `.env` 文件中 `WINDY_API_KEY` 是否正确
2. 确认API密钥没有额外空格
3. 访问 [Windy API后台](https://www.windy.com/api) 验证密钥状态
4. 如果密钥已过期，需要重新生成

---

### Q3: CORS 错误 - 前端无法访问后端

**错误信息**: 控制台显示 CORS policy 错误

**解决方案**:
1. 检查 `.env` 文件中的 `CORS_ORIGIN` 配置
2. 确保前端地址正确（如 `http://localhost:9002`）
3. 如果前端在不同端口，添加到允许列表
4. 生产环境确保域名匹配

---

### Q4: .env 文件不生效

**可能原因**:
1. `.env` 文件不在 `server/` 目录下
2. 文件名不是 `.env`（注意前面的点）
3. 文件编码问题（应为UTF-8）
4. 环境变量名称拼写错误

**检查方法**:
```javascript
// 在 server/index.js 中添加调试
console.log('API Key:', process.env.WINDY_API_KEY);
console.log('Port:', process.env.PORT);
```

---

### Q5: API请求超时

**错误信息**: `ETIMEDOUT` 或 `请求超时`

**原因**:
- 网络连接问题
- Windy API服务器响应慢
- 超时设置过短

**解决方案**:
```javascript
// 在 server/services/windyService.js 中增加超时时间
const response = await axios.post(WINDY_API_URL, requestBody, {
  timeout: 20000  // 增加到20秒
});
```

---

## 生产环境部署

### 1. 环境配置

**生产环境 .env 示例**:
```env
WINDY_API_KEY=production_api_key_here
PORT=3000
NODE_ENV=production
CORS_ORIGIN=https://your-domain.com
```

### 2. 进程管理（使用 PM2）

```bash
# 安装 PM2
npm install -g pm2

# 启动应用
pm2 start server/index.js --name weather-api

# 保存进程列表
pm2 save

# 查看状态
pm2 status
```

### 3. 反向代理（Nginx）

**Nginx配置示例**:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;

        # CORS headers
        add_header 'Access-Control-Allow-Origin' https://your-domain.com always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS' always;
    }

    location / {
        root /path/to/app;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
}
```

---

## 安全最佳实践

### 1. API密钥保护

- ✅ 永不将 `.env` 文件提交到 Git
- ✅ 使用单独的 API 密钥用于生产和开发
- ✅ 定期轮换 API 密钥（建议每月/每季度）
- ✅ 监控 API 使用量，检测异常

### 2. 环境隔离

- ✅ 开发环境使用测试密钥
- ✅ 生产环境使用生产密钥
- ✅ 不同环境使用不同的服务器实例

### 3. 访问控制

- ✅ CORS 白名单限制
- ✅ 速率限制（待实施）
- ✅ 日志监控和告警
- ✅ HTTPS 强制（生产环境）

---

## 调试技巧

### 1. 查看日志

**后端日志示例**:
```
[2026-01-27T12:00:00.000Z] GET /api/weather/forecast
查询参数: {"lat":"39.9042","lon":"116.4074"}
[2026-01-27T12:00:01.234Z] GET /api/weather/forecast - 状态: 200 - 耗时: 1234ms
```

### 2. 测试端点

```bash
# 测试健康检查
curl http://localhost:3000/health

# 测试天气API（短时间）
curl "http://localhost:3000/api/weather/forecast?lat=39.9042&lon=116.4074&hours=1"

# 查看详细日志
npm run dev  # nodemon 会显示详细日志
```

### 3. 常用调试命令

```bash
# 查看环境变量
cd server
cat .env

# 重启服务器
# Ctrl+C 然后 npm start

# 查看端口占用
netstat -ano | findstr :3000  # Windows
lsof -ti:3000                     # Linux/Mac
```

---

## 总结

后端API配置的核心步骤：

1. ✅ **安装依赖**: `npm install`
2. ✅ **配置环境变量**: 复制 `.env.example` 为 `.env`，填入真实 API 密钥
3. ✅ **启动服务器**: `npm start` 或 `npm run dev`
4. ✅ **验证配置**: 访问 `/health` 端点
5. ✅ **集成前端**: 前端通过 `http://localhost:3000/api/weather/forecast` 获取数据

**关键配置文件**:
- `server/.env` - 环境变量（包含API密钥）
- `server/index.js` - 服务器主文件
- `server/services/windyService.js` - API服务封装

**安全提示**:
- 🔒 保护好 API 密钥，不要泄露
- 🔒 不要将 `.env` 提交到 Git
- 🔒 生产环境使用 HTTPS 和独立的密钥

---

**配置完成后，您的后端API就可以安全地代理Windy API请求了！** 🎉
