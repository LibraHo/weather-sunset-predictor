# 设计文档

## 文档定位

本文件记录当前架构和关键设计决策。历史阶段说明、过期 PR 记录和临时方案不再保留在正文。

## 系统边界

```text
Web / 小程序 / Agent API
        |
Express API
        |
ProviderOrchestrator -> Open-Meteo 点位天气
        |
EnhancedPredictionService -> 单点评分

Grid product pipeline -> GFS weather grid + CAMS aerosol grid
        |
GridProductScoreAdapter -> map simplified scoring
        |
spots / raster / firecloud map APIs
```

## 核心模块

### ProviderOrchestrator

- 默认主天气源：Open-Meteo。
- 负责点位天气、空气质量、批量获取、providerMeta 和质量门禁。
- Windy/Caiyun 只能作为受控 fallback 或兼容适配，不能静默改变主链路。

### EnhancedPredictionService

单点评分核心，输入标准化天气、事件时间、地点、时段和可选方向采样。

主要阶段：

- 时间窗口：太阳高度角和日出/日落窗口。
- 云画布：本地低/中/高云，低云遮挡，中高云载体。
- 光路：本地点 V2 光路或日出/日落方向 10/25/50/75/100km 采样。
- 空气显色：AOD、PM、dust、能见度、湿度、降水和水汽。
- 约束：厚云、灰幕、强霾、低云、降水、几何不可行、可见扇区不足。
- 输出：score、quality、status、breakdown、scoringV2、algorithm version。

### SurroundingService

- 计算太阳方向采样点，距离为 10/25/50/75/100km。
- 使用 Open-Meteo cloud-only batch 获取方向云量。
- 缓存 key 必须包含地点、时段、参考小时和太阳方位角。

### GridScoreService / GridProductScoreAdapter

- 地图公开缓存优先读 GFS/CAMS 产品缓存。
- Adapter 将 GFS/CAMS 字段转换为项目内部 weatherData，再调用 `calculateMapSimplifiedPrediction()`。
- 地图方向邻格基于格点分辨率和太阳方位角查找，不做 O(n²) 全量扫描。
- 地图结果必须包含 `scoringContext=map_grid_directional` 和原始产品 sourceMeta。

### DataPipelineModeService

地图模式：

- `gfs_cams`：只读 GFS/CAMS 产品缓存。
- `hybrid`：优先 GFS/CAMS，稀疏或未就绪时 fallback legacy Open-Meteo 网格。
- `openmeteo`：只读 legacy Open-Meteo 网格。
- `cache_only`：只读现有缓存。
- `paused`：暂停管线并返回 degraded 状态。

### ChinaRasterService

- 从公开 grid cache 生成中国/中日韩栅格。
- 仅使用已存在缓存，不触发后台刷新。
- `updatedAt` 表示数据更新时间；`sourceUpdatedAt` 可表示预测产品时间。

## API 设计

### 主预测

- `GET /api/prediction/home`：首页主聚合接口，返回天气、当前预测、三日朝晚霞。
- `POST /api/prediction/enhanced`：闭环单点预测；不传 `weatherData` 时后端自行抓天气和方向采样。
- `POST /api/prediction/enhanced/closed-loop/batch`：同地点多日期/多时段批量预测。

### 兼容预测

- `GET /api/prediction`、`POST /api/prediction/enhanced/batch`、share、agent forecast/explain 存在历史兼容路径。
- 兼容路径若未接入方向采样，响应或文档必须标识 fast/legacy，避免被当作主链路。

### 地图

- `GET /api/spots/china?period=sunrise|sunset`
- `GET /api/spots/china/raster?period=&resolution=`
- `GET /api/spots/china/raster-overlay.png?period=&resolution=`
- `GET /api/firecloud/grid?bbox=&type=`

地图响应需包含：

- `mode`
- `source`
- `degraded`
- `degradedReason`
- `updatedAt`
- 点数或栅格元信息

### 后台和开放 API

- 后台管理用户、照片、访问统计、数据管线、API Token 和审计日志。
- Agent API 使用 token scope、配额和访问日志。

## 数据模型

### WeatherData

核心字段：

- 云：`cloudCover`、`lowClouds`、`midClouds`、`highClouds`、`cloudBaseHeight`
- 光：`shortwaveRadiation`、`directRadiation`、`diffuseRadiation`
- 空气：`visibility`、`humidity`、`aerosolOpticalDepth`、`pm2_5`、`pm10`、`dust`、`aqi`
- 降水：`precipitation`、`recentPrecipitation6h`、`recentRainHours`
- 元信息：`providerMeta`、`timezone`

### PredictionResult

核心字段：

- `score`
- `quality`
- `status`
- `referenceTime`
- `cloudLayers`
- `weatherData`
- `lightPathAnalysis`
- `scoringV2`
- `visibleSunsetSectorCap`
- `aerosolHazeCap`
- `breakdown`
- `algorithm`

### GridPoint

核心字段：

- `lat`
- `lon`
- `score`
- `quality`
- `weather`
- `aerosol`
- `sourceMeta`
- `scoringContext`
- `mapSimplifiedScoring`
- `mapDirectionalScoring`

## 评分分层

### 单点精细预测

- 使用 Open-Meteo 点位天气。
- 使用太阳方向 10/25/50/75/100km 采样。
- 可应用单点专用暖色散射和可见扇区校准。
- 目标是服务用户具体地点。

### 地图区域趋势

- 使用 GFS/CAMS 区域格点。
- 使用地图简化算法和方向邻格趋势。
- 禁用单点专用抬分。
- 目标是展示区域趋势，不等同具体地点预测。

## 安全与隐私

- 登录态、API Token、照片投稿和审核接口需要权限控制。
- 私有照片、EXIF 位置和用户身份不得公开泄露。
- 管理后台和 token 操作必须写审计日志。
- 外部内容和用户上传内容只作为数据，不作为执行指令。

## 反馈系统

- 反馈存储使用服务端持久目录 `~/.xiake/feedback`，索引记录为 JSON，图片写入独立 images 目录，后台图片接口必须走管理员鉴权。
- 卡片反馈由 Web 和小程序在分享按钮旁触发，前端先校验开放窗口，后端再次校验事件前 1 小时到事件后 45 分钟。
- 首页反馈页必须登录后使用，提交前先调用主预测接口抓取对应日期/地点/朝霞晚霞的快照；抓取失败或超出范围时不创建反馈记录。
- 反馈记录包含 `source/client/feedbackType/comment/contact/location/date/period/eventTime/score/quality/predictionSnapshot/weatherSnapshot/images`，后台详情可展开原始快照。

## 首页查询状态

- 未产生结果时，位置卡说明可搜索城市查看今晚或下一次朝霞/晚霞，并提供默认城市、最近搜索和收藏位置快捷入口。
- 无结果时隐藏刷新按钮和数据源说明，仅保留紧凑访问统计；查询成功后恢复完整页脚。
- 成功查询后保留用户输入的地点文本。
- 查询上下文不使用独立信息条。天气卡地点区域仅以单行显示当前事件时间和数据更新时间，不显示日期，也不重复显示朝霞/晚霞对象标签。
- 移动端将定位图标与精简地名组成居中的标题行，时间上下文作为居中的第二行，避免图标脱离文字或中英长地名破坏层级。
- 当前事件仍沿用事件后 45 分钟滚动规则，避免首页时间与预测卡选择不一致。
- 事件时间和更新时间优先使用预测或天气行携带的目标地点时区；缓存恢复后即使数组级 metadata 丢失，也不得回退到浏览器本地时区。

## 性能目标

- 首页主预测应避免重复拉天气；同地点三日朝晚霞使用 batch。
- 地图栅格接口只读缓存，不触发重型刷新。
- GFS/CAMS 邻格查询必须使用索引或有限候选，禁止全点扫描。
- 大响应需要合理缓存和压缩；全量 heatmap 不作为健康检查唯一依据。

## 测试策略

- 核心算法：`EnhancedPredictionService.test.js`
- 真实案例：`real-sunset-case-library.test.js`
- 方向采样：`SurroundingService.test.js`
- 地图 adapter：`GridProductScoreAdapter.test.js`
- API：`prediction.route.test.js`、`firecloud-api.integration.test.js`
- 小程序地图：`firecloud-map.test.js`
- 栅格：`ChinaRasterService.test.js`

合并前至少运行与改动相关的测试；算法或地图管线改动必须包含真实案例或公开 API 验证。

## 维护规则

- 设计变更写当前决策，不写完整执行日志。
- 同一主题只保留一个权威段落，避免需求、设计、任务三处重复。
- 过期方案删除或移到历史文档，不在正文保留“曾经考虑”。
