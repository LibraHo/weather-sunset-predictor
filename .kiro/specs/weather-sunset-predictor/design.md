# 设计文档

## 概述

天气晚霞预测器是全栈Web应用，采用前后端分离架构。前端负责UI展示，后端处理API代理和复杂计算。

**技术栈**：
- 前端：原生JavaScript ES6+、HTML5、CSS3、Chart.js、Leaflet
- 后端：Node.js Express + Python（GFS数据处理）
- 数据源：Open-Meteo API（主）、NOAA GFS（地图覆盖层）

## 文档维护原则

- `requirements.md` 只记录用户目标、范围、验收口径；避免塞实现流水账。
- `design.md` 只记录当前架构、关键设计决策、数据/API/安全/测试策略；过期方案必须标注废弃或移除。
- `tasks.md` 只记录可执行任务、状态、PR/验证证据和明确待办；已完成大项保留摘要，避免重复展开。
- 新增需求时三文档同步：需求编号、设计影响、任务拆分、验收标准必须能互相追溯。

## 设计文档拆分策略（2026-05-11）

需要轻拆，但不把三大文档拆散。

- `design.md` 保持为架构总览、关键决策索引和跨模块约束。
- 复杂专题放入 `design/` 子目录，入口必须从本文件链接回来。
- 拆分标准：单专题超过约 120 行、跨 Web/小程序/iOS 多端、或需要长期独立演进时拆。
- 第一批拆分：小程序与未来 iOS 产品线设计放入 [`design/miniprogram-ios.md`](./design/miniprogram-ios.md)。
#### PR #693 baseline update (2026-05-13)
The current Mini Program design baseline includes PR #693 (`fix/miniprogram-web-parity-ui`, merge `709dd89`). The first home/result shell parity pass is already present:
- Home compact product menu and settings panel.
- Direct current-location/history shortcut query.
- Result-page methodology/map/gallery/upload action loop.
- Compass-style surrounding cloud radar.
- Unit coverage in `tests/unit/miniprogram/web-like-experience.test.js`.

Design follow-up should compare the latest Mini Program screens against web mobile screenshots and patch concrete mismatches only. The goal is parity closure, not a second independent redesign.
- 不拆 `requirements.md` 和 `tasks.md`：它们仍是需求编号与执行状态的单一索引。

## 架构

### 系统架构

```
浏览器（前端）
├── UI层：位置输入、天气显示、预测卡片、地图
├── 控制层：AppController、WeatherController、PredictionController
├── 服务层：OpenMeteo/Geocoding/Storage/Chart/Prediction 相关服务
└── 数据层：WeatherData、Location、SunsetPrediction

后端（Node.js + Python）
├── Express服务器：CORS、日志、路由
├── API路由：/api/weather/*、/api/prediction/*、/api/firecloud/*、/api/heatmap/*、/api/photos、/api/agent/*
├── 服务层：PredictionService、SurroundingService、GridScoreService、CacheService
└── Python GFS处理器：下载、解析、计算、生成PNG

微信小程序（规划）
├── 原生小程序前端：miniprogram/
├── 页面：查分、地点搜索、收藏/最近查询、分享、照片上传
├── 服务层：复用现有 HTTPS API，不复制预测算法
└── 未来 iOS：复用同一 API 契约、产品结构和设计 token
```

### 数据流

```
用户搜索位置 → 地理编码 → 后端代理天气API → 预测计算 → 前端渲染
                                    ↓
                              Python GFS处理（地图覆盖层）
```

## 核心设计决策

### 统一设计语言（Web 端，2026-05-13 更新）

为避免“主界面一套风格、弹层/菜单另一套风格”的割裂，前端视觉统一为 **Sunset Glass** 设计语言：

1. **单一 Token 源**
   - 所有模块（页面、弹窗、下拉、Toast、按钮）优先使用 `styles/main.css` 中的主题 token。
   - 关键 token：`--color-*`、`--glass-*`、`--header-*`。
   - 禁止在子样式文件中新增同语义硬编码色值（例如固定 `#1f2937` 作为正文色、固定 `rgba(74,144,226,0.2)` 作为 hover 色）。

2. **双主题一致性**
   - 明亮/暗色主题都必须走同一套 token 名称；差异只允许在 token 值层定义，不允许在组件层分叉两套配色逻辑。
   - `ThemeService` 负责切换 `theme-*` 类及 `data-theme`、`data-actual-theme` 属性；组件只消费变量，不自行判定主题。

3. **玻璃材质规范**
   - 容器背景：`var(--color-surface)` 或 `color-mix(... var(--glass-bg-heavy) ...)`。
   - 悬停背景：`var(--glass-bg-hover)`。
   - 边框：`var(--glass-border)`。
   - 阴影：`var(--glass-shadow)`。
   - 模糊：`var(--glass-blur)` / `var(--glass-blur-heavy)`。

4. **禁用补丁式覆盖**
   - 避免“先硬编码，再靠 `!important` 覆盖修正”的写法。
   - 若需要修正模块风格，优先回收为 token，避免 selector 竞态和回归风险。

5. **验收口径（UI）**
   - 顶栏、设置面板、分享菜单在亮/暗模式中需保持同一视觉语言（色相、透明度、边框、阴影统一）。
   - 不出现亮色常量泄漏到暗色模式（例如浅米色渐变终点、浅灰白固定 hover）。

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

**照片分享元数据增强（需求51）**：
- 上传者：字段为 `uploaderName`。前台/后台显示时若为空，统一 fallback 为 `网友`；服务端需限制长度并做 HTML 转义/输出安全。
- 地点名称：字段为 `locationName`。系统可根据经纬度反向地理编码自动建议，用户也可手动输入；手动地点只影响展示文案，不修改 `lat/lon`，避免“文字地点”和坐标互相覆盖。
- 拍摄时间：字段为 `takenAt`。优先读取 EXIF DateTimeOriginal；用户可手动填写/修正；手动拍摄时间只影响时间展示，不影响经纬度和上传时间。
- 上传时间：继续由服务端记录 `uploadedAt`，存储建议保留 ISO UTC；展示层统一转为 Asia/Shanghai（北京时间）。非北京时间用户上传时，不使用客户端时区作为最终上传时间来源。
- 兼容旧数据：历史照片缺少 `uploaderName/locationName/takenAt/thumbFile` 时必须可读；展示层使用 fallback，不要求迁移时一次性补齐所有字段。
- 上传表单提供三个手动解析动作：`解析地址` 调 `/api/geocoding/search` 回填 `lat/lon`；`解析经纬度` 从当前图片 EXIF 重新读取 GPS 并反查地点；`解析拍摄时间` 从当前图片 EXIF 重新读取 `takenAt`。
- 高德等外部地理编码调用必须写入 `ApiCallLog`，后台日志和每日统计不能漏记。

**后台照片编辑管理（需求51）**：
- 后台照片列表在现有删除能力外，新增编辑入口，支持修改 `uploaderName`、`locationName`、`takenAt`、`desc`、`lat`、`lon`。
- `uploadedAt` 为服务端记录的审计时间，只读展示，不允许后台手动修改。
- 编辑 `locationName` 只影响展示地点，不自动反写经纬度；编辑 `lat/lon` 需明确作为“修改地图位置”。
- 编辑 `takenAt` 只影响拍摄时间展示，不改变上传时间。
- 保存后写回 `photos.json`，公开 `/api/photos` 与 `/gallery` 立即使用更新后的元数据。
- 服务端编辑接口必须复用新增字段的校验/规范化逻辑，并继续禁止暴露 `uploadIpHash`、`uploadDay` 等内部字段。

**同地点多图地图展示（需求51）**：
- 低 zoom：按屏幕像素距离聚合照片，显示代表缩略图 + 数量角标，视觉参考 Apple 相册地图。
- zoom 变大：聚合半径逐步缩小，照片组自然拆分。
- 完全相同或极近坐标：始终显示 stack marker，避免多个 marker 完全重叠。
- 代表图：优先选最新上传或评分/拍摄时间更合适的一张作为封面；marker/popup 一律优先 `thumbUrl`，无缩略图才 fallback 原图。
- 点击聚合 marker：弹出横向缩略图列表/小网格，展示上传者、地点、拍摄时间、上传时间；点单张照片再进入详情/大图。
- 第一阶段优先前端聚合（基于当前 zoom 与像素距离），照片量增大后再考虑服务端聚合 API。

### 预测解释与图表可读性（需求48）

**分数明细 Ledger**：由 `PredictionController.renderScoreBreakdownPopover()` 渲染，目标是解释“最终分为什么是这个数”。信息层级固定为：
1. 最终分 hero + 简短摘要。
2. 天气上下文 chips（高/中/低云、能见度、湿度、降水）。
3. 计算步骤卡片：云层载体、光路、基础分、显色修正、实际触发的封顶/保底、最终分。

**文案原则**：
- 展示用户关心的计算变化，如 `87.5×80% + 40.0×20% = 78.0`、`78.0 × 显色系数 0.77 = 60.0`。
- 不展示 UI 自我解释（例如“分数流水，不是文字分析”）。
- 未触发的规则不占位，避免出现“未触发封顶/无修正”等无效信息。

**24 小时温度图天气标签**：由 `ChartRenderController.renderSimpleChart()` 在 `param === 'temp'` 时追加天气 chips。标签从小时数据推导：降水优先，其次按云量判断阴天/多云/少云/晴天。桌面端与移动端分别降采样，避免图表下方标签拥挤。

### 管理后台信息架构（需求50）

后台入口仍为 `/admin`，但前端从单页长滚动改为主页模板同款 menu + panel：
- `dashboard`：KPI、访问趋势、系统健康、Top IP。
- `ops`：Grid 队列状态、手动刷新、清缓存、重启后端。
- `logs`：API 调用日志、24h 调用分布、每日统计。
- `schedule`：定时刷新配置。
- `agent`：Token、申请审核、Agent 用量、审计日志。
- `photos`：照片上传与管理。

刷新策略按激活页面收敛：Dashboard/Ops/Logs 可定时刷新，Schedule/Agent/Photos 以用户操作触发为主。高风险动作集中在 Ops 的 danger zone，并保留确认框。

### 微信小程序与未来 iOS（需求52）

详见 [`design/miniprogram-ios.md`](./design/miniprogram-ios.md)。

关键决策：
- 主产品入口优先做原生微信小程序，不把公众号作为主产品；公众号仅用于文章、活动和跳转小程序。
- 小程序代码放当前 repo 的 `miniprogram/`，不单独建库。
- 小程序和未来 iOS 共用现有后端 API；新增 API 必须按多端契约设计，不复制预测算法。
- `web-view` 仅作为临时入口/兼容方案，不作为正式 MVP 主体验。
- 小程序按“Web 同等原生端”设计：同一设计语言、同一核心功能、同一评分/解释口径；平台实现可以不同，产品能力不能缩水。
- 小程序结果页必须承载霞客核心能力：火烧云文字分析、周边云况雷达、未来 3 天朝霞/晚霞预测，不能只做分数展示壳。
- 用户模型以服务端 `userId` 为业务主键，微信 `openid` 只是小程序 identity provider；未来 iOS 可追加 Apple/手机号/邮箱等 identity。
- 开工前必须先冻结 MVP 信息架构、共享 API 契约、设计 token 映射、地图/图表适配方案和微信平台审核清单。

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


### 时间计算系统（太阳事件 / 查询地点法定时区）

**核心原则**：所有日出、日落、黄金时段、蓝调时段、最佳观赏窗口，以及 Agent API 返回的太阳事件时间，都必须以“查询地点实际使用的法定时区”为准，而不是用户所在地、浏览器、服务器或经度推算时区。

**为什么必须系统化**：
- 用户所在地不一定等于查询地点。例如用户人在卡塔尔查北京，页面必须显示北京当地时间，而不是卡塔尔时间。
- 查询地点的经度标准时间不一定等于该地区实际使用的法定时区。例如槟城经度接近 UTC+7，但马来西亚实际使用 `Asia/Kuala_Lumpur` / UTC+8；新疆经度接近 UTC+6，但中国统一使用 `Asia/Shanghai` / UTC+8。
- 因此不能用 `new Date().getTimezoneOffset()` 或 `Math.round(lon / 15)` 作为主逻辑；经度推算只能作为缺少 IANA timezone 时的最后兜底。

**统一规则**：
1. 地理编码/天气源若返回 IANA timezone，必须沿链路传递到预测对象和 API meta，例如 `Asia/Shanghai`、`Asia/Kuala_Lumpur`、`Asia/Qatar`。
2. 太阳事件计算先用查询地点 IANA timezone 解析该日期的实际 UTC offset（包含 DST），再构造真实 UTC instant。
3. UI/API 展示或格式化时，必须传入同一个查询地点 timezone；禁止默认使用用户浏览器/服务器 timezone。
4. 只有 timezone 缺失或不可解析时，才允许按 `Math.round(lon / 15)` 兜底，并在 meta/日志中保留可观测信息。

**实现落点**：
- 前端：`src/services/SunsetPredictionService.js` 负责按目标 timezone 计算 sunrise/sunset；`src/controllers/PredictionController.js` 在渲染主时间、最佳观赏窗口、黄金时段、蓝调时段时传入 `prediction.timezone`。
- 后端：`server/utils/SunCalculator.js` 提供统一工具：`getTargetTimezoneOffsetHours()`、`createDateFromTargetLocalTime()`、`formatTimeForZone()`；`server/services/PredictionService.js`、`server/routes/agent-forecast.js` 必须使用 provider/weather meta 中的 timezone。
- 数据源：Open-Meteo 请求使用 `timezone=auto`，其 `providerMeta.timezone` 是首选时区来源。

**必须覆盖的回归测试**：
- 用户在 `Asia/Qatar` 查北京：北京日出显示 `Asia/Shanghai` 时间，不显示卡塔尔时间。
- 槟城：使用 `Asia/Kuala_Lumpur` / UTC+8，不按经度 fallback 成 UTC+7。
- 新疆/乌鲁木齐、拉萨等中国西部城市：使用 `Asia/Shanghai` / UTC+8，不按经度 fallback 成 UTC+6。
- 前端服务和后端 `SunCalculator` 都要覆盖，避免 Web UI 与 Agent API 结果分叉。

### Agent API 与 Token 管理（需求45）

**架构原则**：不另起后端。Agent API 与网站 API 共用同一个 Node 服务、同一套预测算法、同一套天气/地理编码服务，避免分数与解释分叉。差异仅在鉴权、限流、输出格式和审计维度。

**调用方定位**：第一阶段主要给 Alex 自用的大模型/自动化脚本；保留未来邀请制开放给用户且禁止商用的能力，因此从 MVP 开始就要有 Token、scope、额度和吊销。

**Token 格式与存储**：
- 明文格式：`xiake_live_<random>` / `xiake_test_<random>`。
- 创建时只展示一次明文；服务端只保存 `tokenHash`、`prefix`、`name`、`scopes`、`enabled`、`minuteLimit`、`dailyLimit`、`createdAt`、`lastUsedAt`、`usageCount`。
- 推荐持久化：优先 SQLite（如已存在 `~/.xiake/visitor.db` 可扩展表），否则阶段一可使用 `~/.xiake/api-tokens.json`，后续迁移 SQLite。
- Hash：`sha256(token + serverSecret)`；日志只记录 token id/prefix，不记录明文。

**鉴权方式**：
```http
Authorization: Bearer xiake_live_xxx
```
也可兼容 `X-Xiake-Token`，但文档推荐 Bearer。

**Agent API 路由**：
- `GET /api/agent/forecast?location=北京&type=sunset&date=today&detail=simple|full`
- `GET /api/agent/forecast?lat=39.9042&lon=116.4074&type=sunrise&detail=full`
- `GET /api/agent/explain?lat=&lon=&type=&date=`（P2）
- `GET /api/agent/geocode?q=Tokyo, Japan`（P2）
- `GET /api/agent/map-summary?bbox=&type=&threshold=`（P3）
- `GET /api/agent/openapi.json`（P2/P3）

**Agent forecast 返回结构**：
```json
{
  "success": true,
  "data": {
    "location": { "name": "北京", "lat": 39.9042, "lon": 116.4074, "confidence": 0.98 },
    "type": "sunset",
    "score": 68,
    "quality": "good",
    "bestViewingWindow": { "start": "2026-04-25T10:40:00.000Z", "end": "2026-04-25T11:40:00.000Z" },
    "factors": { "highClouds": 72, "midClouds": 45, "lowClouds": 12, "visibility": 18, "aerosolOpticalDepth": 0.42 },
    "summary": "条件不错，火烧云概率较高",
    "explanation": "高云和中云提供色彩载体，低云遮挡较少，能见度良好。",
    "warnings": []
  },
  "meta": { "tokenId": "tok_...", "cached": false, "elapsedMs": 420 }
}
```

**后台管理接口**：
- `GET /api/admin/tokens` - Token 列表（不返回明文）
- `POST /api/admin/tokens` - 创建 Token，返回一次性明文
- `PATCH /api/admin/tokens/:id` - 修改名称、scope、限流、启停
- `DELETE /api/admin/tokens/:id` - 吊销/删除 Token
- `GET /api/admin/tokens/:id/usage` - 使用统计

**Token 数据模型（建议 SQLite 表）**：
```sql
CREATE TABLE api_tokens (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  prefix TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  scopes TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  minute_limit INTEGER NOT NULL DEFAULT 60,
  daily_limit INTEGER NOT NULL DEFAULT 2000,
  usage_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE api_token_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  error_code TEXT,
  elapsed_ms INTEGER,
  ip_hash TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL
);
```

**错误模型**：
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED | TOKEN_DISABLED | SCOPE_DENIED | RATE_LIMITED | BAD_REQUEST | INTERNAL_SERVER_ERROR",
    "message": "Human readable message"
  },
  "meta": { "requestId": "...", "elapsedMs": 12 }
}
```

**实现落点**：
- `server/services/ApiTokenService.js`：生成、哈希、校验、额度计数、使用日志。
- `server/middleware/agentAuth.js`：Bearer 解析、scope 校验、401/403/429 统一返回。
- `server/routes/agent.js`：Agent API 业务路由。
- `server/routes/admin-tokens.js` 或并入现有 admin 路由：后台 Token 管理。
**测试文件规划**：
- `tests/unit/server/apiTokenService.test.js`：Token 生成、hash 校验、明文只返回一次、启停/吊销、额度计数。
- `tests/unit/server/agentAuth.test.js`：无 token 401、无效 token 401、禁用 token 403、scope 不足 403、minute/day 超限 429、合法 token 通过。
- `tests/unit/server/agentForecast.test.js`：`location` 输入、`lat/lon` 输入、`type=sunrise|sunset`、`detail=simple|full`、错误参数 400、结构化字段完整。
- `tests/unit/server/adminTokens.test.js`：后台创建/列表/改名/启停/删除 token，列表不泄露 token 明文。
- `tests/integration/agentApi.integration.test.js`（可选）：从鉴权到 forecast 的端到端调用，mock 外部天气源，避免真实 API 不稳定。

**限流与审计**：
- Token 维度：每分钟限制 + 每日额度；默认建议自用 token `60/min, 2000/day`，外部邀请用户（禁止商用） token 可按非商用额度调整。
- IP 维度：保留粗粒度辅助限流，防止单 token 泄露后瞬间打爆。
- 429 返回 `RATE_LIMITED`，401 返回 `UNAUTHORIZED`，403 返回 `TOKEN_DISABLED` 或 `SCOPE_DENIED`。
- 日志字段：tokenId、endpoint、status、elapsedMs、createdAt、ipHash、userAgent 简要，不长期保存完整 IP 明文。


**测试覆盖要求（需求45 必须重点覆盖）**：
- Token/鉴权：无 Token、格式错误、hash 不匹配、禁用、scope 不足、分钟/日额度超限、明文只返回一次、列表和日志不泄露明文。
- Agent API：城市名、经纬度、sunrise/sunset、simple/full、无效参数、上游失败降级、字段 schema 稳定。
- API申请：邮箱/联系方式必填、用途可选、提交入库、后台列表、审核通过创建 Token、拒绝申请、申请-token 关联、前台不直接返回 Token。
- API接入/API申请 UI：入口存在、禁止商用文案存在、复用现有主题样式、移动端不溢出、示例代码可复制且不含真实 Token。
- OpenAPI：JSON 可解析、鉴权 scheme 正确、schema 与实际返回一致。

**分期计划**：
- Phase 1（MVP）：Token 存储/鉴权/后台管理 + `/api/agent/forecast` + 单测/集成测试。
- Phase 2：`explain`、`geocode`、OpenAPI JSON、用量统计图。
- Phase 3：`map-summary`、邀请用户额度/非商用规则、MCP/tool schema 示例。

**API接入（前台文档页）**：
- 新增主页面/菜单入口：`API接入`（建议路径 `#/api-guide` 或独立 section `api-guide-section`）。
- 页面目标：让开发者/大模型用户不用看源码即可完成接入。
- 内容结构：
  1. 快速开始：进入 API申请 → 留邮箱/用途 → 管理员后台审核并创建 Token → 复制 Bearer Token → 调用 forecast。
  2. 鉴权说明：`Authorization: Bearer xiake_live_xxx`，Token 只展示一次，泄露可后台停用。
  3. 示例请求：curl、JavaScript fetch、Python requests。
  4. 核心接口：`/api/agent/forecast` 参数表、返回字段解释、`simple/full` 差异。
  5. 错误码：401/403/429/400/500 对应处理建议。
  6. 限流与额度：每分钟、每日额度、未来邀请用户（禁止商用）非商用额度说明。
  7. 大模型接入建议：OpenAPI/MCP/tool schema 后续位置，提示不要编造结果，必须调用 API。
- UI 要求：必须在现有霞客主题框架下实现，复用当前主页分页/菜单体系、容器宽度、卡片样式、按钮、字体、明暗主题变量和响应式断点；不得做独立风格页面或跳出当前主题；移动端可读；代码示例可复制；不暴露任何真实 Token。

**API申请（前台申请页）**：
- 新增主页面/菜单入口：`API申请`（建议路径 `#/api-apply` 或独立 section `api-apply-section`），必须复用现有主题框架、卡片/表单/按钮样式与明暗主题变量。
- 最小表单字段：邮箱/联系方式（必填）、用途说明（可选）、预计调用量（可选，默认普通额度）；不收集“是否商用”，因为商用默认禁止。
- 前台只提交申请，不直接生成 Token，避免被自动化刷 token；页面必须明确提示“禁止商用，仅限个人/研究/测试/非商业用途”。
- 后台新增申请列表：显示邮箱、用途、状态（pending/approved/rejected）、提交时间、处理时间、关联 tokenId；后台审核时默认按非商用额度发放。
- 管理员可从申请记录一键创建 Token；创建后 token 明文仍只展示一次，申请记录只保存 tokenId/状态，不保存 token 明文。
- 存储建议与 Token 同库：`api_token_applications` 表，字段含 `id/email/contact/useCase/expectedUsage/status/tokenId/adminNote/createdAt/updatedAt`。
- 测试覆盖：申请表单提交成功、邮箱必填校验、后台列表可见、审核创建 Token 后申请与 tokenId 关联、前台不能直接获得 Token。

## 需求46设计：朝霞/晚霞预测卡片概念界面重构

### 设计原则
- **借结构，不借皮肤**：概念图只作为信息架构参考；最终视觉必须属于霞客，延续现有深色玻璃、霞光橙金、蓝紫天空、卡片阴影与主题变量。
- **先结论，再原因**：用户第一眼看到“值得期待/一般/不推荐”、分数、日出/日落时间和最佳观赏窗口；原因放在下方结构化展示。
- **时间语义准确**：`00:22` 这类值是时区 bug 造成的日出时间错误，不是倒计时。新版标签必须明确写 `日出 HH:mm` / `日落 HH:mm`，并显示地点当地最佳窗口。
- **云况雷达不动**：保留现有云况雷达组件、数据来源、视觉和交互；新卡片只调整预测摘要与形成条件分析。

### 信息架构
1. **头部摘要区**
   - 左侧/上方：`今日晚霞` / `明日朝霞` / 具体日期。
   - 主视觉：分数与质量等级，例如 `85 分 · 值得期待`；分数圆环/分数区域继续作为“分数明细”入口，保留既有 popover/底层交互能力。
   - 时间块：`日出 06:22` 或 `日落 18:47`；副信息显示 `最佳观赏 05:52-06:42`。
   - 时间全部来自地点 IANA timezone 的计算结果。
2. **云层结构区**
   - 三个紧凑指标：高云、中云、低云。
   - 每项包含百分比、状态色/短标签、轻量条形或小型进度表达。
   - 不替换、不移动云况雷达；这里只做摘要。
3. **形成条件分析区**
   - 顶部一句结论：如 `高云条件好，低云略有遮挡风险`。
   - 中部 2 列网格指标：高云、中云、低云、能见度、湿度、AOD/气溶胶。
   - 每项：统一图标（✅/⚠️/❌）+ 指标名 + 加粗数值 + 极短说明。
   - 底部最多 2-3 条解释，避免日志式长段落。

### 视觉规范
- 使用现有 CSS 变量与霞客色彩，不新增割裂的大面积粉紫主题。
- 朝霞可偏冷蓝金，晚霞可偏暖橙紫，但都应落在现有霞客渐变和玻璃卡片体系。
- 数字对齐：分数、百分比、时间、AOD 等要有明显数字层级；指标网格值建议右对齐或加粗。
- 移动端优先：保证两列指标在窄屏可降为单列或紧凑两列，不产生横向滚动；卡片内容不截断。

### 测试策略
- `PredictionController` 或对应渲染单测覆盖：
  - 既有覆盖：时区核心逻辑、北京/新疆/拉萨/槟城等地点时区、AOD 文案、云层短标签、分数明细点击/动态插入、分析不截断。
  - 新增/更新：新版头部摘要 DOM（分数/等级/日出日落/最佳窗口）、形成条件指标网格、分数区域仍作为明细入口、云况雷达容器/关键 marker 仍存在。
  - 不重复测试算法级时区，只验证新 UI 没接错格式化后的时间字段。
  - 空/缺失指标优雅降级，不显示 `undefined`。
- 如涉及 CSS class，补快照/DOM class 断言，防止再次出现分析文字被截断。

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

- Agent API 必须鉴权；API Token 明文只在创建时显示，服务端仅保存 hash，支持停用/吊销/额度限制
- API Key仅存储于后端环境变量
- 前端不暴露Windy/Open-Meteo Key
- IP存储前SHA256哈希
- 文件上传限制20MB，MIME白名单
- 管理接口Basic Auth

## 变更摘要

### 2026-05-07
- 增加需求48设计：分数明细 ledger 解释链路、24 小时温度图天气标签。
- 增加三文档维护原则，明确 requirements/design/tasks 的边界与同步要求。

### 2026-03-29
- 管理后台增强：API配额面板 + 队列状态面板（PR #319）
- 分享地图页改为中国GeoJSON自研底图（PR #318）
- 手机版天气卡片/7天概览长条单列横排优化
- 去掉云图contrast滤镜消除"等高线"视觉
- 新增需求45：Agent API 与 API Token 管理（同后端、Bearer Token、独立限流、后台管理）
- 新增需求41：API调用分类日志（grid/weather/gaode/gaode_tile）
- 新增需求42：定时更新配置面板（朝霞/晚霞更新时间可自定义）
- 新增需求40：Open-Meteo配额统计与保护（软上限9000/10000）
- 网格抓取队列系统限流稳定版（需求39）

### 2026-03-17
- 朝霞/晚霞评分散点地图（需求37）
- 火烧云全球分享地图（需求38）

### 2026-04
- 朝霞/晚霞预测卡片概念界面重构（需求46）：借鉴概念图信息结构，保留霞客现有色彩，云况雷达不变
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
