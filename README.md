# 霞客 · Sunset Voyager

> English version: [README.en.md](./README.en.md)

基于 **Open-Meteo** 的火烧云（朝霞 / 晚霞）预测 Web 应用。

当前主链路：
- **天气数据主源**：Open-Meteo（默认 ECMWF IFS 025）
- **可选模型**：ECMWF IFS 025 / GFS Seamless / Best Match
- **Windy**：仅 emergency fallback（默认关闭）

---

## 功能概览

- 朝霞 / 晚霞预测评分（多因子融合）
- 7 天概览 + 24 小时天气数据
- 雷达罗盘可视化（8方向 + 高中低云圈层）
- 设置面板可切换 Open-Meteo 模型：
  - `ecmwf_ifs025`（推荐）
  - `gfs_seamless`
  - `best_match`
- 数据来源显示一致（首页 badge / 设置面板 / 底部文案）
- 多语言、暗色主题、响应式布局

---

## 本地开发

### 1) 安装依赖

```bash
# 根目录（前端/测试依赖）
npm install

# 后端依赖
cd server && npm install && cd ..
```

### 2) 配置环境变量

```bash
cd server
cp .env.example .env
```

最少需要配置：

```env
# 主数据源（默认）
PRIMARY_WEATHER_PROVIDER=openmeteo

# 高德地理编码（中国大陆强烈建议配置）
GAODE_API_KEY=your_gaode_api_key_here

# 可选：Windy 地图展示 Key
WINDY_MAP_API_KEY=your_windy_map_key

# 可选：Windy fallback（默认关闭）
ENABLE_WINDY=false
ENABLE_WINDY_EMERGENCY_FALLBACK=false
WINDY_API_KEY=your_windy_point_forecast_key

PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:9002
```

### 3) 启动服务

```bash
# 终端 A：后端
cd server && npm run dev

# 终端 B：前端静态服务
python3 server.py
```

访问：
- 前端：`http://localhost:9002`
- 后端健康检查：`http://localhost:3000/health`

---

## API（当前关键接口）

### `GET /api/weather/forecast`

查询参数：
- `lat`（必填）
- `lon`（必填）
- `hours`（可选，默认 168）
- `model`（可选，默认 `ecmwf_ifs025`）
  - `ecmwf_ifs025`
  - `gfs_seamless`
  - `best_match`

示例：

```bash
curl "http://localhost:3000/api/weather/forecast?lat=39.9&lon=116.4&hours=72&model=ecmwf_ifs025"
```

---

## 部署流程（已按当前脚本更新）

> 推荐环境：腾讯云 Ubuntu，仓库目录 `/home/ubuntu/weather-sunset-predictor`

### A. 推荐：一键脚本部署（当前生产流程）

```bash
# 在本地仓库根目录执行
bash deploy.sh
```

`deploy.sh` 当前行为：
1. 本地 `git pull origin main`
2. 检查服务器 `server/.env` 关键项（如 `GAODE_API_KEY`）
3. 将 `.env.example` 新增 key 追加到服务器 `.env`（不覆盖已有值）
4. `scp` 同步前后端核心代码文件
5. 重启后端并执行健康检查 `http://localhost:3000/health`

### B. 手动部署（兜底）

```bash
# 1) 登录服务器
ssh -i ~/.ssh/id_ed25519 ubuntu@43.143.237.15

# 2) 拉最新代码
cd ~/weather-sunset-predictor
git pull origin main

# 3) 安装依赖（若 package 变更）
npm install
cd server && npm install && cd ..

# 4) 检查/补齐环境变量
cd server
cp -n .env.example .env
# 手动编辑 .env，确保 GAODE_API_KEY 等可用

# 5) 重启后端
sudo bash -c 'cd /home/ubuntu/weather-sunset-predictor/server && pkill -f "node index" || true && nohup node index.js > /tmp/ws-backend.log 2>&1 &'

# 6) 健康检查
curl -s http://localhost:3000/health
```

### 部署注意事项

- `server/.env` **不入库**，只在服务器维护
- 线上进程如由 root 启动，重启需使用 `sudo`
- 发生异常时先看日志：`/tmp/ws-backend.log`

---

## 项目结构（精简）

```text
weather-sunset-predictor/
├── src/
│   ├── components/          # UI 组件（含 RadarCompass、SettingsPanel）
│   ├── controllers/         # App / Weather / Prediction 控制器
│   ├── services/            # 前端服务层
│   └── locales/             # 多语言
├── server/
│   ├── routes/              # weather / prediction / firecloud 等 API
│   ├── services/            # ProviderOrchestrator / OpenMeteoProvider 等
│   └── .env.example
├── styles/
├── deploy.sh                # 当前生产部署脚本
├── index.html
└── README.en.md
```

---

## 开发协作约定

- 分支 → PR → 合并 → 部署
- 不直接在 `main` 上开发
- 每次 push 后立即回传 PR 链接

---

## License

MIT
