# 📋 Weather Sunset Predictor 任务清单

**最后更新**：2026-04-25

---

## 🔬 需求43：气溶胶/空气颗粒纳入评分与 UI（待分配，2026-04-25）

### 背景
粉丝建议把气溶胶指数纳入火烧云判断。结论：气溶胶与能见度高度相关但不重合；能见度是通透度结果，气溶胶/AOD/PM/Dust 是散射与灰霾原因，应作为独立修正项而不是替代能见度。

### 任务拆分
- [ ] 43.1 数据接入：新增 Open-Meteo Air Quality API 客户端/方法，拉取 `aerosol_optical_depth,dust,pm2_5,pm10,us_aqi/european_aqi`。
- [ ] 43.2 数据合并：按小时把 Air Quality 数据并入 `weatherData`，字段为 `aerosolOpticalDepth,dust,pm2_5,pm10,aqi`；失败时降级不影响天气预测。
- [ ] 43.3 评分算法：新增 `scoreAerosolScattering()` 或等价逻辑；AOD 适中小幅加分，过高/PM高/沙尘高扣分；能见度差且颗粒物高时禁止加分。
- [ ] 43.4 UI 展示：实时天气面板、分数明细弹窗、文字分析、算法说明页同步展示气溶胶/颗粒物影响。
- [ ] 43.5 测试：覆盖 AOD 适中加分、AOD高+低能见度扣分、无气溶胶数据降级、UI显示气溶胶分析。

### 建议分配
- minicoder A：43.1 + 43.2 数据接入与降级。
- minicoder B：43.3 算法与单测。
- coder：43.4 UI整合、最终验收、PR。

## 🌍 需求44：国际城市搜索排序优化（待分配，2026-04-25）

### 背景
粉丝反馈“洛杉矶”不能要求用户写 LA；同时 `Tokyo/东京` 可能被高德匹配到国内同名小地名。世界城市不能靠全量手工维护，必须优化 geocoding provider 合并与排序。

### 任务拆分
- [ ] 44.1 Provider 策略：Auto 搜索统一合并 Open-Meteo/Nominatim/Gaode 结果，不再简单高德置顶；全球城市以 Open-Meteo/Nominatim 为主。
- [ ] 44.2 Ranking：实现 exact/alias/contains、population、capital/admin、language、country/provider 置信度、中国查询识别等重排。
- [ ] 44.3 高频别名表：只维护中国、美国、欧洲主要城市的常见中文名/英文名/缩写，作为查询扩展和 ranking 特征；不维护全世界完整城市库。
- [ ] 44.4 别名范围：
  - 中国主要城市：北京/BJ、上海/SH、广州/GZ、深圳/SZ、香港/HK、澳门、台北、成都、重庆、杭州、南京、西安、武汉、厦门、青岛等。
  - 美国主要城市：洛杉矶/LA/Los Angeles、纽约/NYC/New York、旧金山/SF/San Francisco、华盛顿/DC/Washington DC、西雅图、芝加哥、波士顿、拉斯维加斯、迈阿密等。
  - 欧洲主要城市：伦敦/London、巴黎/Paris、柏林/Berlin、罗马/Rome、马德里/Madrid、巴塞罗那/Barcelona、阿姆斯特丹/Amsterdam、米兰/Milan、苏黎世/Zurich、维也纳/Vienna、布拉格/Prague、雅典/Athens、伊斯坦布尔/Istanbul 等。
- [ ] 44.5 API 元信息：返回 `providerUsed/fallbackUsed/rankReason` 或调试字段，便于排查搜索排序。
- [ ] 44.6 测试：`洛杉矶/LA/Los Angeles -> Los Angeles US`，`NYC -> New York US`，`SF -> San Francisco US`，`Tokyo/东京 -> Tokyo JP`，`London/伦敦 -> London GB`，`巴黎/Paris -> Paris FR`，`北京/上海/香港 -> CN/HK`。

### 建议分配
- minicoder A：44.1 + 44.2 ranking 纯函数与单测。
- minicoder B：44.3 + 44.4 + 44.6 alias/样例测试。
- coder：整合 geocoding 路由、线上验证、PR。

---

## ✅ 需求40：Open-Meteo配额统计与额度保护（2026-03-29）
- [x] 新增 `OpenMeteoQuota` 服务（UTC日计数 + 本地持久化）
- [x] 在Open-Meteo请求链路记录调用次数
- [x] 在网格刷新前增加软上限拦截（超限暂停队列）
- [x] 新增 `GET /admin/quota` 统计接口
- [x] 验证重启后计数文件仍可读取

### 后续可选优化
- [x] ~~调试页面显示quota仪表盘（进度条+剩余额度）~~ → 已在PR#319完成
- [x] 按调用类型分组统计（基础天气/网格刷新/其他） → 需求41

---

## 🔧 需求41：API调用日志记录（2026-03-29，2026-04-12 已完成）

### 目标
记录所有外部 API 调用，分类展示在管理后台。

### 分类
- `grid`：火烧云地图网格抓取（GridScoreService 调用 OpenMeteoProvider）
- `weather`：用户前端触发的天气查询（`/api/weather/forecast`）
- `gaode`：高德地理编码（BackendGeocodingService）
- `gaode_tile`：高德瓦片代理（`/api/tiles/gaode/:z/:x/:y`）

### 任务清单
- [x] 新增 `server/services/ApiCallLog.js` — 日志服务（已完成框架）
- [x] 埋点：OpenMeteoProvider._getWithRetry（2026-04-12 已核对）
- [x] 埋点：weather路由 forecast 端点（2026-04-12 已核对）
- [x] 埋点：高德地理编码、瓦片代理（2026-04-12 已核对）
- [x] 新增 `server/routes/api-logs.js` — 日志API路由（2026-04-12 已核对）
- [x] admin页面新增日志面板（分Tab展示，自动刷新）— 已实现（见 `server/routes/admin.js` 内嵌HTML）
- [x] 统计摘要：今日总数/每小时请求数/分类统计 — 已实现（`GET /api/admin/logs/summary` + `GET /api/admin/logs/hourly`）

---

## 🔧 需求42：定时更新配置（2026-03-29，2026-04-13 核对）

### 目标
管理后台可配置火烧云数据更新策略。

### 功能
- 可设置多个更新时间点（如 06:00, 14:00, 22:00）
- 每个时间点可选：更新朝霞 / 晚霞 / 都更新
- 配置持久化到 `~/.xiake/schedule-config.json`
- 后端定时器按配置触发 gridService._doRefresh()

### 任务清单
- [x] 新增配置API（GET/POST `/api/admin/schedule`）— 已有（api-logs.js）
- [x] admin页面新增配置面板（时间点+朝霞/晚霞选择）— 已有（admin.js）
- [x] 配置持久化到 `~/.xiake/schedule-config.json` — 已有
- [x] 后端定时器读取配置按 cron 触发刷新（`global.__scheduleReload` 已接入并触发 gridService）

---

## ✅ 需求39：网格抓取队列系统（2026-03-28）

### P0（已完成）
- [x] 网格步长降为1°
- [x] 降批次到 `batch=10`，并发 `1`，批次间隔 `2500ms`
- [x] 新增进度状态接口 `/api/heatmap/status?period=...`
- [x] 调试页新增"拉取进度面板"和手动刷新按钮

### P1（进行中）
- [x] 429熔断等待：优先`Retry-After`，否则固定等待60s
- [x] 批次状态细化（pending/running/retrying/success/failed）
- [x] 刷新接口超时与后台任务状态解耦

### P2（待做）
- [x] 断点续跑：持久化已完成批次
- [x] 队列明细接口（复用 `/api/heatmap/status` 的 `batches` 明细）
- [x] 次日朝霞/晚霞优先刷新策略

### 验收口径
- [x] 1°模式下成功率稳定 > 85%（以线上运行观察口径记录）
- [x] 429出现时任务可自动恢复
- [x] 用户可通过调试页实时看到进度

---

## ⏰ 待执行任务（等Alex批准）

### 需求三：朝霞/晚霞显示优化
- [x] 手机版：添加朝霞/晚霞切换开关
- [x] 手机版：卡片布局优化（单列显示）
- [x] 优先显示逻辑：
  - 中午 → 显示晚霞 + 明日朝霞
  - 日出前 → 显示今日朝霞 + 今日晚霞
  - 日落后 → 显示明日朝霞 + 明日晚霞

### 需求五：地图页面优化
- [x] 地图可拖动、可缩放（滚轮）
- [x] 地图只显示定位地点附近（2026-04-10：定位到中国大陆时自动聚焦约 280km 视窗并高亮定位点）
- [x] 新增专门放火烧云地图的页面（下拉菜单pages里）
- [x] `.kiro` 文档补充韩国、日本地图范围与展示规则
- [x] 地图范围从仅中国扩展到中国、日本、韩国（当前为底图边界扩展）
- [x] 韩国、日本复用中国火烧云评分展示逻辑并渲染数据涂层（已接入网格抓取区域与同一展示逻辑）
- [x] 韩国、日本先在地图上显示边界，但不拉数据、不渲染火烧云涂层
- [x] 点击火烧云图上点位后，天气/评分信息展示实测通过（2026-04-10：popup 展示地点名 + 分数 + 温度/云量/风速）

---

## 🚫 硬约束

### 禁止自动合并PR
- 创建PR后必须等待Alex明确说"合并"、"ok"、"批准"、"yes"才能执行
- 以下词不算授权："地址呢"、"好的"、"收到了"、"可以"

### 禁止虚报进度
- 说"已完成"时必须附证据：修改文件、commit hash、PR编号、测试结果
- 一旦卡住，必须直接说明阻塞点

---

## 📝 历史记录

### 2026-03-25
- ✅ 火烧云计算方法页面优化（PR #252）
- ✅ 7天天气概览改为垂直列表（PR #214）
- ✅ 后端崩溃修复（PR #215, #218）
- ✅ 去掉风向文字（PR #221）

### 2026-03-22
- ✅ 蓝调/黄金时段标签对齐（PR #212）
- ✅ 风速图标改回💨（PR #217）
- ✅ 7天概览布局优化（PR #220）

### 2026-03-02
- ✅ 品牌升级、设置重组、访客持久化（需求27-29）

### 2026-02
- ✅ 前后端分离架构（需求22）
- ✅ 测试覆盖率达标（需求23）
- ✅ 中国定位服务（需求24）
- ✅ 火烧云地图重构（需求20 Phase 6）

---

**当前分支**：`main`
**最新commit**：`a98bdee`（main）
