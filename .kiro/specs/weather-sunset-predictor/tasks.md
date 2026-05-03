# 📋 Weather Sunset Predictor 任务清单

**最后更新**：2026-04-25

---

## 🔐 需求45：Agent API 与 API Token 管理（待分批实施，2026-04-25）

### 背景
Alex 希望让大模型/自动化工具直接调用霞客火烧云信息。结论：不必先做 CLI；核心应是同一后端上的受控 Agent API。第一阶段自用，未来可邀请制开放给用户且禁止商用，因此从一开始要有 Token、限流、审计和后台管理。

### Phase 1：MVP（优先，建议 3 个 PR 拆分）
- [x] 45.1 Token 数据模型：新增 token 存储（优先 SQLite；如短期用 JSON，必须预留迁移边界），字段含 `id/name/prefix/tokenHash/scopes/enabled/minuteLimit/dailyLimit/createdAt/lastUsedAt/usageCount`。
- [x] 45.2 Token 生成与哈希：生成 `xiake_live_` / `xiake_test_` 前缀 token；明文仅创建时返回；服务端只存 hash。
- [x] 45.3 鉴权中间件：支持 `Authorization: Bearer <token>`，校验 hash、enabled、scope、minute/day quota。
- [x] 45.4 后台 Token 管理：在 admin 增加 API Tokens 区域，支持创建、列表、启停、改名、改限流、吊销；列表不显示明文。
- [x] 45.5 Agent Forecast API：新增 `GET /api/agent/forecast`，支持 `location` 或 `lat/lon`、`type=sunrise|sunset`、`date=today|tomorrow|ISO`、`detail=simple|full`。
- [x] 45.6 结构化返回：返回 `location/score/quality/bestViewingWindow/factors/summary/explanation/warnings/meta`，适合 LLM 直接消费。
- [x] 45.7 审计日志：记录 tokenId、endpoint、status、elapsedMs、ipHash、userAgent 摘要、错误码；不记录 token 明文。
- [x] 45.8 测试：新增/更新 `apiTokenService.test.js`、`agentAuth.test.js`、`agentForecast.test.js`、`adminTokens.test.js`；覆盖无 token 401、禁用 token 403、scope 不足 403、超限 429、forecast 成功、token 明文只返回一次。

### Phase 2：工具化增强
- [x] 45.9 Agent Explain API：`GET /api/agent/explain`，输出分数构成、因子关系、关键限制和自然语言解释。
- [x] 45.10 Agent Geocode API：`GET /api/agent/geocode?q=`，返回标准地点、国家、经纬度、confidence、rankReason。
- [x] 45.11 OpenAPI 文档：新增 `GET /api/agent/openapi.json`，描述鉴权、参数、返回和错误码，便于大模型/工具接入。
- [x] 45.12 API接入：新增「API接入」主页面/菜单入口，必须在现有霞客主题框架下实现并复用当前菜单、卡片、按钮、字体、明暗主题和移动端布局；内容包含快速开始、Token 使用、curl/JS/Python 示例、参数表、返回字段、错误码、限流规则和安全说明。
- [x] 45.13 API申请：新增「API申请」前台入口，必须在现有霞客主题框架下实现并复用当前表单/按钮/卡片/明暗主题；最小表单字段为邮箱/联系方式（必填）和用途说明（可选），页面明确提示禁止商用、仅限个人/研究/测试/非商业用途；提交后后台可查看申请、标记状态，并从申请一键创建 Token；申请与 tokenId 持久化关联保存。
- [x] 45.14 用量统计后台：按 token 展示今日调用量、错误率、最近调用、日额度剩余。

### Phase 3：开放与生态
- [x] 45.15 Map Summary API：`GET /api/agent/map-summary?bbox=&type=&threshold=`，返回区域火烧云概览/高分点摘要，避免直接暴露大体积图层。
- [x] 45.16 邀请用户（禁止商用）能力：支持 token 备注、非商用额度、到期时间、批量禁用；后台和 API接入文档均需明确禁止商用。（2026-05-03 PR）
- [x] 45.17 MCP/tool schema 示例：提供 Claude/OpenAI/OpenClaw 可直接使用的 tool schema 示例；CLI 暂不作为必需项。

### 验收标准
- [x] Agent API 与网站 API 共用同一后端和算法，不出现两套评分逻辑。
- [x] 所有 `/api/agent/*` 默认必须鉴权；公开文档接口除外也要限流。
- [x] Token 泄露时可在后台立即停用，并且停用后请求返回 403。
- [x] Agent forecast 返回 JSON 字段稳定，适合大模型无网页解析地调用。
- [x] 需求45 所有实现 PR 必须补充分层测试，不能只测 happy path；若某项暂无法自动化测试，PR 内必须说明原因。
- [x] Token/鉴权测试必须覆盖：无 Token 401、格式错误 401、hash 不匹配 401、禁用 Token 403、scope 不足 403、分钟/日额度超限 429、Token 明文只返回一次、列表/日志不泄露明文。
- [x] Agent API 测试必须覆盖：城市名输入、经纬度输入、`sunrise/sunset`、`simple/full`、无效参数 400、上游失败降级、返回字段 schema 稳定、解释/时间窗口不为空。
- [x] API申请测试必须覆盖：邮箱/联系方式必填校验、用途可选、提交成功入库、后台列表可见、审核通过创建 Token、拒绝申请、申请与 tokenId 关联、前台永不直接返回 Token。
- [x] API接入/API申请 UI 测试必须覆盖：页面入口存在、禁止商用文案存在、复用现有主题/卡片/按钮类名或变量、移动端不溢出、代码示例可复制且不包含真实 Token。
- [x] OpenAPI/工具化测试必须覆盖：`openapi.json` 可解析、鉴权 scheme 正确、forecast/explain/geocode schema 与实际返回一致。

### 建议 PR 拆分
- PR A（基础安全）：45.1-45.3 + 45.8 部分。Token 存储、生成、鉴权中间件；必须包含 `apiTokenService.test.js`、`agentAuth.test.js`。
- PR B（Forecast MVP）：45.5-45.6 + forecast 成功测试。只做 `/api/agent/forecast`，复用现有 geocoding/weather/prediction 服务；必须包含 `agentForecast.test.js`。
- PR C（后台与审计）：45.4 + 45.7 + 45.13。后台管理 UI/API、API申请列表、使用日志、最近使用与调用次数；必须包含 `adminTokens.test.js` 和申请流程测试。
- PR D（文档工具）：45.9-45.12 + 45.14。explain/geocode/OpenAPI/API接入/用量统计；必须补对应 route/schema/UI 测试。

### 建议分配
- minicoder A：PR A 的 Token 存储、生成、鉴权中间件与测试。
- minicoder B：PR B 的 Agent forecast 路由与结构化返回测试。
- coder：PR C 后台管理整合、审计、最终验收；PR D 视节奏拆分。


---

## 🌐 需求47：英日韩西全站功能 i18n 信任任务（2026-05-02）

### 背景
Alex 要求把当前网站所有功能都纳入英语、日语、韩语、西班牙语覆盖检查与补齐。目标不是只补首页，而是全站用户可见功能在 `en-US`、`ja-JP`、`ko-KR`、`es-ES` 下都不能漏 key、不能残留中文、不能因为长文案破版。此任务为“信任任务”：后续新增功能默认必须同步这些语言，不能等用户再次提醒。

### 任务拆分
- [x] 47.1 全站 i18n key 完整性审计：以 `zh-CN` 为基准，对比 `en-US/ja-JP/ko-KR/es-ES`，列出缺失 key、多余 key、结构不一致 key。（2026-05-03：主语言 key 结构防回归）
- [x] 47.2 页面入口与静态页面审计：覆盖 `index.html`、`public/api-apply.html`、gallery/debug/算法说明等用户可见页面；所有用户可见文字必须走 i18n 或有明确不可翻译理由。（2026-05-03：静态页审计报告 + 防新增未审计页面 guard）
- [x] 47.3 控制器/组件/服务动态文案审计：覆盖 `src/controllers`、`src/components`、`src/services`、`src/utils` 中 toast、按钮、空状态、错误、分享卡片、地图、预测卡片、设置、API接入/申请等动态文案。（2026-05-03：动态文案审计报告 + CJK source inventory guard）
- [x] 47.4 英语补齐与质量检查：英文不能 fallback 中文；功能路径文案自然、可读；代码示例/错误码说明准确。（2026-05-03：English quality audit + no-CJK fallback guard）
- [x] 47.5 日语补齐与质量检查：日语不能混中文；避免机器直译式生硬表达；长文案不挤压移动端。（2026-05-03：Japanese quality audit + fallback residue guard）
- [x] 47.6 韩语补齐与质量检查：韩语不能混中文；按钮/菜单/表单/错误状态完整；长文案不挤压移动端。（2026-05-03：Korean quality audit + fallback residue guard）
- [x] 47.7 西班牙语补齐与质量检查：西语不能混中文；按钮/菜单/表单/错误状态完整；长文案不挤压移动端。（2026-05-03：Spanish quality audit + fallback residue guard）
- [x] 47.8 自动化防回归：新增/扩展测试，至少覆盖 key completeness、关键页面无中文残留、API接入/申请页四语言切换、分享卡片/预测卡片动态文案 i18n。（2026-05-03：i18n regression suite coverage guard）
- [ ] 47.9 真实页面验收：至少用 Playwright 或截图验证 `en-US/ja-JP/ko-KR/es-ES` 关键路径：首页搜索、预测结果、地图、设置、API接入/申请。

### 验收标准
- [ ] `en-US/ja-JP/ko-KR/es-ES` 与 `zh-CN` 的用户可见 key 结构一致，无 `Translation key not found`。
- [ ] 四种语言下核心页面不出现中文残留（城市名/地名数据、品牌名和明确允许项除外）。
- [ ] 所有新用户可见文案必须同步四种语言；PR 缺任一语言视为不完整。
- [ ] 移动端英文/日文/韩文/西文长文案不横向溢出、不遮挡主要操作。
- [ ] 自动化测试真实通过；`No tests found` 不算通过。

### 并行分工
- minicoder EN：英语覆盖审计与修复建议。
- minicoder JA：日语覆盖审计与修复建议。
- minicoder KO：韩语覆盖审计与修复建议。
- minicoder ES：西班牙语覆盖审计与修复建议。
- coder：统一 key schema、合并修复、补测试、开 PR、验收。

---

## ✅ 需求43：气溶胶/空气颗粒纳入评分与 UI（已完成，2026-04-25）

### 背景
粉丝建议把气溶胶指数纳入火烧云判断。结论：气溶胶与能见度高度相关但不重合；能见度是通透度结果，气溶胶/AOD/PM/Dust 是散射与灰霾原因，应作为独立修正项而不是替代能见度。

### 任务拆分
- [x] 43.1 数据接入：新增 Open-Meteo Air Quality API 客户端/方法，拉取 `aerosol_optical_depth,dust,pm2_5,pm10,us_aqi/european_aqi`。
- [x] 43.2 数据合并：按小时把 Air Quality 数据并入 `weatherData`，字段为 `aerosolOpticalDepth,dust,pm2_5,pm10,aqi`；失败时降级不影响天气预测。
- [x] 43.3 评分算法：新增 `scoreAerosolScattering()` 或等价逻辑；AOD 适中小幅加分，过高/PM高/沙尘高扣分；能见度差且颗粒物高时禁止加分。
- [x] 43.4 UI 展示：实时天气面板、分数明细弹窗、文字分析、算法说明页同步展示气溶胶/颗粒物影响。
- [x] 43.5 测试：覆盖 AOD 适中加分、AOD高+低能见度扣分、无气溶胶数据降级、UI显示气溶胶分析。

### 完成记录
- PR #419：气溶胶散射评分。
- PR #420：气溶胶 UI 展示。
- PR #425：气溶胶数据进入 prediction response。
- PR #432：天气面板气溶胶字段修复。

## 🟡 需求44：国际城市搜索排序优化（主体已完成，PR #431 待合并，2026-04-25）

### 背景
粉丝反馈“洛杉矶”不能要求用户写 LA；同时 `Tokyo/东京` 可能被高德匹配到国内同名小地名。世界城市不能靠全量手工维护，必须优化 geocoding provider 合并与排序。

### 任务拆分
- [x] 44.1 Provider 策略：Auto 搜索统一合并 Open-Meteo/Nominatim/Gaode 结果，不再简单高德置顶；全球城市以 Open-Meteo/Nominatim 为主。
- [x] 44.2 Ranking：实现 exact/alias/contains、population、capital/admin、language、country/provider 置信度、中国查询识别等重排。
- [x] 44.3 高频别名表：只维护中国、美国、欧洲主要城市的常见中文名/英文名/缩写，作为查询扩展和 ranking 特征；不维护全世界完整城市库。
- [x] 44.4 别名范围：
  - 中国主要城市：北京/BJ、上海/SH、广州/GZ、深圳/SZ、香港/HK、澳门、台北、成都、重庆、杭州、南京、西安、武汉、厦门、青岛等。
  - 美国主要城市：洛杉矶/LA/Los Angeles、纽约/NYC/New York、旧金山/SF/San Francisco、华盛顿/DC/Washington DC、西雅图、芝加哥、波士顿、拉斯维加斯、迈阿密等。
  - 欧洲主要城市：伦敦/London、巴黎/Paris、柏林/Berlin、罗马/Rome、马德里/Madrid、巴塞罗那/Barcelona、阿姆斯特丹/Amsterdam、米兰/Milan、苏黎世/Zurich、维也纳/Vienna、布拉格/Prague、雅典/Athens、伊斯坦布尔/Istanbul 等。
  - 2026-05-03 核对：`server/routes/geocoding.js` 已覆盖上述范围，`tests/unit/server/geocoding.test.js` 与 `tests/unit/server/geocodingRanking.test.js` 覆盖核心别名与排序。
- [x] 44.5 API 元信息：返回 `providerUsed/fallbackUsed/rankReason` 或调试字段，便于排查搜索排序。
- [x] 44.6 测试：`洛杉矶/LA/Los Angeles -> Los Angeles US`，`NYC -> New York US`，`SF -> San Francisco US`，`Tokyo/东京 -> Tokyo JP`，`London/伦敦 -> London GB`，`巴黎/Paris -> Paris FR`，`北京/上海/香港 -> CN/HK`。

### 完成/待处理记录
- 已合并 PR #421：全球 geocoding ranking。
- 已合并 PR #422：主要城市 alias map + ranking。
- 已合并 PR #426：优先国际城市 alias。
- 已合并 PR #429：国际城市 alias/ranking 测试。
- 待处理 PR #431：扩展更多城市 alias，当前仍 OPEN，等 Alex 明确授权后合并。

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

## 🎴 需求46：朝霞/晚霞预测卡片概念界面重构（待执行）

### 目标
根据 Alex 提供的概念图，重构朝霞/晚霞预测卡片的信息结构，让用户先看到结论、分数、日出/日落时间和最佳观赏窗口，再看到云层与形成条件分析。视觉保持霞客现有体系，云况雷达不变。

### 任务拆分
- [ ] 46.1 现状审计：定位当前朝霞/晚霞卡片、形成条件分析、云况雷达对应的渲染函数与 CSS，记录不可动边界。
- [ ] 46.2 头部摘要重构：展示朝霞/晚霞类型、今日/明日/日期、分数、质量等级、`日出/日落 HH:mm`、最佳观赏窗口；确认全部使用已有地点 IANA 时区格式化结果。
- [ ] 46.3 云层摘要重构：以结构化方式展示高云/中云/低云百分比与状态，保持云况雷达组件不变。
- [ ] 46.4 形成条件分析重排：顶部结论 + 中部指标网格（高云/中云/低云/能见度/湿度/AOD）+ 底部 2-3 条短解释；统一 ✅/⚠️/❌ 图标。
- [ ] 46.5 霞客视觉适配：沿用现有深色玻璃、霞光橙金、蓝紫天空和主题变量；不照搬概念图粉紫配色；移动端无横向滚动、不截断文本。
- [ ] 46.6 回归测试：复用既有时区/AOD/云层/分数明细测试；新增或更新 DOM 渲染测试，覆盖新版头部摘要、指标网格、分数明细入口仍可点击、缺失数据降级、云况雷达 marker 保持存在。
- [ ] 46.7 验证与 PR：运行相关单测；提交分支、push、创建 PR；PR 创建后停止等待 Alex 明确“合并/ok/批准”。

### 验收标准
- [ ] 截图/DOM 可验证卡片信息层级符合：结论 → 时间/分数 → 云层 → 条件分析。
- [ ] 日出/日落不是倒计时文案，且使用已有目标地点时区格式化结果。
- [ ] 云况雷达未改动、未消失、未被新布局挤压。
- [ ] 形成条件分析不再像日志文本，数字值清晰对齐。
- [ ] 自动化测试真实通过；`No tests found` 不算通过。

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
