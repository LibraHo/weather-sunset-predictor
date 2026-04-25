# 设计文档

## 概述

天气晚霞预测器是全栈Web应用，采用前后端分离架构。前端负责UI展示，后端处理API代理和复杂计算。

**技术栈**：
- 前端：原生JavaScript ES6+、HTML5、CSS3、Chart.js、Leaflet
- 后端：Node.js Express + Python（GFS数据处理）
- 数据源：Open-Meteo API（主）、NOAA GFS（地图覆盖层）

## 架构

### 系统架构

```
浏览器（前端）
├── UI层：位置输入、天气显示、预测卡片、地图
├── 控制层：AppController、WeatherController、PredictionController
├── 服务层：WindyAPIService、GeocodingService、StorageService、ChartService
└── 数据层：WeatherData、Location、SunsetPrediction

后端（Node.js + Python）
├── Express服务器：CORS、日志、路由
├── API路由：/api/weather/*、/api/prediction/*、/api/firecloud/*、/api/heatmap/*
├── 服务层：PredictionService、SurroundingService、GridScoreService、CacheService
└── Python GFS处理器：下载、解析、计算、生成PNG
```

### 数据流

```
用户搜索位置 → 地理编码 → 后端代理天气API → 预测计算 → 前端渲染
                                    ↓
                              Python GFS处理（地图覆盖层）
```

## 核心设计决策

### 天气数据源（Open-Meteo）

- **主数据源**：Open-Meteo API（免费，无需Key）
- **字段映射**：cloud_cover_low/mid/high、visibility、precipitation等
- **配额管理**：日限额10000次，软上限9000次暂停网格抓取
- **429策略**：fail-fast，不长时间重试

### 预测算法

**后端API**：
- `POST /api/prediction/calculate` - 单点预测
- `POST /api/prediction/surrounding` - 8方位周边预测
- `POST /api/prediction/enhanced` - 增强预测（画布+光路）
- `POST /api/prediction/batch` - 批量预测（时间线）

**评分公式**：
```javascript
// 云画布评分
cloudCanvas = highClouds × 0.70 + midClouds × 0.45 + lowClouds × 0.10
optimalBonus = (30% ≤ cloudCover ≤ 70%) ? +15 : 0
lowCloudPenalty = (lowClouds > 50%) ? -(lowClouds - 50) × 0.5 : 0

// 光路评分（V2）
geometryScore = 沿光路采样(20/50/100km)计算遮挡
extinctionFactor = exp(-AOD / sin(solarElevation))
lightPathScore = geometryScore × extinctionFactor × 100

// 封顶策略
if (cloudCover >= 85% || precipitation > 0) lightPathScore = min(lightPathScore, 40-50)

// 气溶胶修正（需求43）
aerosolFactor = scoreAerosolScattering(AOD, PM2_5, PM10, dust, visibility)

// 最终评分
finalScore = (canvasScore × 0.8 + lightPathScore × 0.2) × aerosolFactor
```

### 气溶胶/空气颗粒链路（需求43）

**数据源**：Open-Meteo Air Quality API `https://air-quality-api.open-meteo.com/v1/air-quality`

**字段**：
- `aerosol_optical_depth`：主指标，衡量整层大气气溶胶光学厚度，用于判断红橙散射潜力与灰霾风险。
- `dust`：沙尘风险，过高时直接压低观感。
- `pm2_5` / `pm10`：颗粒物风险，辅助判断雾霾发暗。
- `us_aqi` / `european_aqi`：展示和兜底用，不能替代 AOD。

**合并策略**：
1. `OpenMeteoProvider` 获取天气小时数据后，并行/串行补充 Air Quality 小时数据。
2. 按 `hourly.time` 对齐，合并到每小时 `weatherData`：`aerosolOpticalDepth`、`dust`、`pm2_5`、`pm10`、`aqi`。
3. Air Quality 失败时记录 `providerMeta.degradedReason`，但预测不能失败，按无气溶胶数据处理。
4. 配额统计要区分 `air_quality` 调用，避免和普通天气/网格调用混淆。

**评分原则**：
- 能见度表示“看得清不清”，气溶胶表示“为什么清/不清以及颜色是否容易艳”。
- AOD 适中小幅加分，AOD/PM/Dust 过高扣分。
- 能见度差且颗粒物高时只扣分，不允许因 AOD 高获得色彩加成。

**UI 展示**：
- 实时天气面板新增「气溶胶/颗粒物」指标。
- 分数明细弹窗新增「气溶胶散射」行，显示分数/修正系数。
- 文字分析新增短句：适中=有利红橙散射，过高=灰霾发暗，很低=空气过净颜色可能偏淡。
- 算法说明页新增“气溶胶 vs 能见度”的解释，避免用户认为重复计权。

### 网格抓取队列（需求39）

**架构**：
```
Refresh API → QueueManager → Single Worker(concurrency=1)
    ↓
Batch Job (size=10, delay=2500ms) → OpenMeteoProvider
    ↓
429 → Retry-After或60s熔断等待
```

**状态模型**：
- Job级：idle | running | finished | failed
- Batch级：pending | running | success | failed | retrying

**关键指标**：totalPoints、completedPoints、successPoints、errorPoints、etaSeconds

### 配额统计与保护（需求40）

**组件**：`OpenMeteoQuota.js`
- 持久化：`~/.xiake/openmeteo-quota.json`
- UTC日重置
- 接口：`GET /admin/quota` → count/limit/softLimit/remaining/gridAllowed

**阈值**：
- DAILY_LIMIT = 10000
- SOFT_LIMIT = 9000（≥此值暂停网格抓取）

### 国际城市搜索排序（需求44）

**当前问题**：Auto 搜索把高德结果放前面，导致 `Tokyo/东京/洛杉矶` 等国际城市可能被中国同名小地名抢占第一。

**设计原则**：
- 不维护全世界城市库；只维护中国、美国、欧洲主要城市的高频别名/缩写，作为搜索增强而不是唯一数据源。
- 全球搜索以 Open-Meteo/Nominatim 为主，高德作为中国境内增强。
- 所有 provider 结果进入统一 ranking，不再简单“高德在前”。

**排序特征**：
```javascript
rankScore = exactMatch * 100
  + aliasMatch * 80
  + populationScore
  + capitalOrAdminBonus
  + languageMatchBonus
  + providerConfidence
  + chinaQueryGaodeBonus
  - smallPlacePenalty
```

**别名表范围**：
- 中国：北京/BJ、上海/SH、广州/GZ、深圳/SZ、香港/HK、澳门、台北、成都、重庆、杭州、南京、西安、武汉、厦门、青岛等。
- 美国：洛杉矶/LA/Los Angeles、纽约/NYC/New York、旧金山/SF/San Francisco、华盛顿/DC/Washington DC、西雅图、芝加哥、波士顿、拉斯维加斯、迈阿密等。
- 欧洲：伦敦/London、巴黎/Paris、柏林/Berlin、罗马/Rome、马德里/Madrid、巴塞罗那/Barcelona、阿姆斯特丹/Amsterdam、米兰/Milan、苏黎世/Zurich、维也纳/Vienna、布拉格/Prague、雅典/Athens、伊斯坦布尔/Istanbul 等。

**明显中国查询判断**：
- 查询包含中国省/市/县/区行政名，或结果 countryCode=CN 且名称 exact/alias 命中。
- 对 `LA`、`Tokyo`、`东京`、`洛杉矶` 这类国际别名，不给高德全局优先权。

**最低验收样例**：
- `洛杉矶` / `LA` / `Los Angeles` → Los Angeles, US
- `Tokyo` / `东京` → Tokyo, JP
- `London` / `伦敦` → London, GB
- `北京` / `上海` → China

### 地图覆盖层（需求20/33/37）

**方案**：Leaflet + OpenStreetMap（开发），可选Windy Professional（生产）

**覆盖层生成**：
1. 后端Python下载NOAA GFS GRIB2数据
2. 解析变量：TCDC、LCDC、MCDC、HCDC
3. 光路追踪算法计算概率
4. 生成RGBA PNG覆盖层
5. 前端Leaflet `L.imageOverlay()`叠加

**东亚区域散点图（需求37）**：
- 覆盖区域：中国、日本、韩国
- 中国网格：1°间隔，约104点（72°E-135°E，18°N-53°N）
- 日本、韩国：先复用中国同一套评分与展示规则，按各自国界范围生成采样点
- 缓存：每日4次更新（08/12/15/17 CST）
- 显示：评分≥60的采样点，🌅/🌄图标标注

### 分享地图（需求38）

**架构**：
```
/admin（Basic Auth）→ 上传照片 → sharp缩略图 → ~/.xiake/photos/
/gallery → Leaflet地图 → 照片Marker（DivIcon圆形缩略图）+ 访客点（橙色小圆）
```

**数据**：
- 照片：`photos.json`（id、lat、lon、takenAt、thumbnail）
- 访客：`visitors.json`（ip_hash、lat、lon、country、city）

## 数据模型

### Location
```javascript
{ lat: number, lon: number, name: string }
```

### WeatherData
```javascript
{
  timestamp, temp, humidity, cloudCover, windSpeed, pressure,
  visibility, precipitation, windDirection,
  highClouds, midClouds, lowClouds
}
```

### SunsetPrediction
```javascript
{
  date, score (0-100), quality ('excellent'|'good'|'fair'),
  factors: { cloudCover, humidity, visibility, lowClouds },
  sunriseTime, sunsetTime, type ('sunrise'|'sunset'),
  goldenHour: { start, end }, blueHour: { start, end },
  sunAzimuth, cloudLayers: { high, mid, low, description },
  lightPath: { score, occlusionProbability, samples, capReason }
}
```

## API设计

### 天气数据
- `GET /api/weather/forecast?lat=&lon=` - 天气预测

### 预测API
- `POST /api/prediction/calculate` - 单点预测
- `POST /api/prediction/surrounding` - 周边8方位预测
- `POST /api/prediction/enhanced` - 增强预测
- `POST /api/prediction/batch` - 批量预测

### 网格/热力图
- `GET /api/heatmap/grid?period=` - 网格评分数据
- `POST /api/heatmap/refresh?period=` - 手动刷新
- `GET /api/heatmap/status?period=` - 进度状态

### 火烧云覆盖层
- `GET /api/firecloud/overlay?lat=&lon=&radius=` - 覆盖层PNG

### 管理接口
- `GET /admin/quota` - Open-Meteo配额统计
- `GET /api/visitor/count` / `POST /api/visitor/count` - 访客计数
- `GET /api/photos` / `POST /admin/upload` - 照片管理

### API调用日志（需求41）
- `GET /api/admin/logs?type=grid|weather|gaode|gaode_tile&limit=50` - 分类日志
- `GET /api/admin/logs/summary` - 统计摘要（今日/小时/分类）

### 定时更新配置（需求42）
- `GET /api/admin/schedule` - 获取当前定时配置
- `POST /api/admin/schedule` - 保存定时配置
- 配置格式：
```json
{
  "tasks": [
    { "time": "06:00", "periods": ["sunrise"] },
    { "time": "14:00", "periods": ["sunset"] },
    { "time": "22:00", "periods": ["sunrise", "sunset"] }
  ]
}
```
- 持久化：`~/.xiake/schedule-config.json`

## 缓存策略

| 数据类型 | TTL | 存储 |
|---------|-----|------|
| 天气数据 | 15分钟 | 内存 |
| 预测结果 | 30分钟 | 内存 |
| 网格评分 | 1小时 | 文件(~/.xiake/grid-cache.json) |
| 覆盖层PNG | 30分钟 | 内存 |
| Open-Meteo配额 | UTC日 | 文件(~/.xiake/openmeteo-quota.json) |

## 性能目标

- 单点预测API：<500ms
- 周边聚合API：<2000ms（8点并行）
- 网格刷新：并发=1，批次=10，间隔=2500ms
- 地图首屏：<3s

## 错误处理

- 网络错误：友好提示 + 重试按钮
- API限流（429）：熔断等待（Retry-After或60s）
- 数据验证失败：返回400 + 描述性错误
- GFS数据失败：降级到雷达图模式

## 测试策略

- 单元测试：Jest，覆盖率≥80%
- 属性测试：fast-check验证通用规则
- E2E测试：Playwright覆盖核心流程
- 覆盖率阈值：Statements≥80%, Branches≥75%, Functions≥90%, Lines≥80%

## 安全

- API Key仅存储于后端环境变量
- 前端不暴露Windy/Open-Meteo Key
- IP存储前SHA256哈希
- 文件上传限制20MB，MIME白名单
- 管理接口Basic Auth

## 变更摘要

### 2026-03-29
- 管理后台增强：API配额面板 + 队列状态面板（PR #319）
- 分享地图页改为中国GeoJSON自研底图（PR #318）
- 手机版天气卡片/7天概览长条单列横排优化
- 去掉云图contrast滤镜消除"等高线"视觉
- 新增需求41：API调用分类日志（grid/weather/gaode/gaode_tile）
- 新增需求42：定时更新配置面板（朝霞/晚霞更新时间可自定义）
- 新增需求40：Open-Meteo配额统计与保护（软上限9000/10000）
- 网格抓取队列系统限流稳定版（需求39）

### 2026-03-17
- 朝霞/晚霞评分散点地图（需求37）
- 火烧云全球分享地图（需求38）

### 2026-04
- 云厚评估模块 Phase 22（4月21日）
  - 新增数据源：`shortwave_radiation`, `direct_radiation`, `diffuse_radiation`, `total_column_integrated_water_vapour`
  - 算法：辐射法（直射比）+ 水汽法 + 天气码兜底，三信号综合判定
  - 输出：`assessCloudThickness()` → `{ thickness, modifier, reasons }`
  - modifier 纳入画布分修正：薄云 1.1x / 适中 1.0x / 偏厚 0.75x / 厚云幕 0.45x
  - 无数据时优雅降级（modifier=1.0），不影响现有逻辑
  - 解决问题："高云100%"既可能是绝美薄卷云也可能是死阴天

### 2026-03
- 光路评分物理重构（需求35）
- Windy彻底移除（需求36）

### 2026-02
- 品牌升级、设置重组、访客持久化（需求27-29）
- Open-Meteo迁移、Windy下线（需求31-34）

### 2026-01及更早
- 核心功能、增强功能、前后端分离、多语言支持
