# 霞客 · Sunset Voyager

> English version: [README.en.md](./README.en.md)

基于 **Open-Meteo** 的朝霞 / 晚霞 / 火烧云预测 Web 应用。霞客会结合云层、能见度、湿度、降水、太阳高度角和周边格点数据，为指定地点生成可解释的观赏评分。

## 当前数据策略

- **主天气源**：Open-Meteo
- **默认模型**：`ecmwf_ifs025`
- **可选模型**：`ecmwf_ifs025` / `gfs_seamless` / `best_match`
- **Windy**：仅作为 emergency fallback，默认关闭
- **中国大陆地理编码**：建议配置高德 API Key，以提升城市搜索质量

## 功能概览

- 朝霞 / 晚霞预测评分与结论解释
- 7 天概览和 24 小时逐小时天气图表
- 雷达罗盘可视化：8 个方向 + 高 / 中 / 低云圈层
- 中国大陆火烧云地图、热力图和周边点位推荐
- 分享卡片、分享地图、照片上传与后台管理
- 多语言、暗色主题、移动端适配、RTL 样式支持
- Agent API、访问统计、API 申请与调用日志

## 项目结构

```text
weather-sunset-predictor/
├── index.html                 # 前端入口
├── src/                       # 前端应用代码
│   ├── components/            # UI 组件
│   ├── controllers/           # 页面与业务控制器
│   ├── locales/               # 多语言文案
│   ├── models/                # 前端数据模型
│   └── services/              # 天气、预测、地图、分享等服务
├── styles/                    # 全局、RTL、设置面板、分享面板样式
├── public/                    # 静态页面、Leaflet、本地地图数据
├── server/                    # Express 后端
│   ├── routes/                # weather / prediction / spots / photos 等 API
│   ├── services/              # Provider、评分、网格、照片、Token 等服务
│   ├── middleware/            # 日志与鉴权
│   └── scripts/               # GFS 处理脚本
├── tests/                     # unit / integration / property / e2e 测试
├── docs/                      # 审计、设计、迁移、质量文档
├── deploy.sh                  # 生产部署脚本
└── server.py                  # 本地前端静态服务
```

## 本地开发

### 1. 安装依赖

```bash
npm install
cd server && npm install && cd ..
```

### 2. 配置环境变量

```bash
cd server
cp .env.example .env
```

推荐的最小配置：

```env
PRIMARY_WEATHER_PROVIDER=openmeteo
GAODE_API_KEY=your_gaode_api_key_here
WINDY_MAP_API_KEY=your_windy_map_key

ENABLE_WINDY=false
ENABLE_WINDY_EMERGENCY_FALLBACK=false
WINDY_API_KEY=your_windy_point_forecast_key

SERVER_TOKEN_SECRET=change-me-in-production
API_TOKEN_STORAGE_PATH=/tmp/xiake/agent-tokens.json

PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:9002

RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 3. 启动服务

```bash
# 终端 A：后端
cd server && npm run dev

# 终端 B：前端静态服务
python3 server.py
```

访问地址：

- 前端：`http://localhost:9002`
- 后端健康检查：`http://localhost:3000/health`

## 常用命令

```bash
# 单元/集成测试
npm test

# 监听模式
npm run test:watch

# 覆盖率
npm run test:coverage

# Playwright E2E
npm run test:e2e

# i18n 硬编码中文检查
npm run test:i18n-hardcoded-zh
```

## 关键 API

### `GET /api/weather/forecast`

查询天气预报数据。

参数：

- `lat`：必填，纬度
- `lon`：必填，经度
- `hours`：可选，默认 `168`
- `model`：可选，默认 `ecmwf_ifs025`

示例：

```bash
curl "http://localhost:3000/api/weather/forecast?lat=39.9&lon=116.4&hours=72&model=ecmwf_ifs025"
```

### 其他主要接口

- `/api/prediction`：火烧云预测评分
- `/api/spots`：中国大陆点位评分
- `/api/geocoding`：城市搜索与地理编码
- `/api/photos`：分享照片上传与读取
- `/api/agent`：Agent API 与 Token 管理
- `/api/admin`：后台管理 API，Basic Auth 保护

更多接口细节见 [server/api-docs.yaml](./server/api-docs.yaml)。

## 部署

推荐在本地仓库根目录执行：

```bash
bash deploy.sh
```

当前脚本会：

1. 拉取 `origin/main`
2. 检查服务器 `server/.env` 关键配置
3. 将 `.env.example` 中新增 key 追加到服务器 `.env`，不覆盖已有值
4. 通过 `scp` 同步前后端核心文件
5. 重启后端并检查 `http://localhost:3000/health`

手动部署兜底：

```bash
ssh -i ~/.ssh/id_ed25519 ubuntu@43.143.237.15
cd ~/weather-sunset-predictor

git pull origin main
npm install
cd server && npm install && cd ..

cd server
cp -n .env.example .env
# 按需编辑 .env，确保 GAODE_API_KEY、SERVER_TOKEN_SECRET 等可用

sudo bash -c 'cd /home/ubuntu/weather-sunset-predictor/server && pkill -f "node index" || true && nohup node index.js > /tmp/ws-backend.log 2>&1 &'
curl -s http://localhost:3000/health
```

部署注意事项：

- `server/.env` 不入库，只在服务器维护。
- 生产环境必须替换 `SERVER_TOKEN_SECRET` 和管理员密码等默认值。
- 如果后端由 root 启动，重启时需要 `sudo`。
- 线上日志优先查看 `/tmp/ws-backend.log`。

## 协作约定

- 使用分支 → PR → 合并 → 部署流程。
- 不直接在 `main` 上开发。
- 每次 push 后回传 PR 链接。
- 涉及 UI、i18n、预测算法、API 契约的改动，至少运行相关单元测试。

## License

MIT
