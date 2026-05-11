# 📋 Weather Sunset Predictor 任务清单

**最后更新**：2026-05-11

---

## 🆕 需求52：微信小程序与未来 iOS 产品线（2026-05-11）

### 背景
Alex 判断公众号入口偏奇怪，小程序更适合霞客；后续还计划 iOS。结论：正式产品线选择原生小程序，公众号只做内容分发/导流；小程序代码放当前仓库 `miniprogram/`，后端继续复用现有 API。

### 任务拆分
- [ ] 52.1 小程序项目脚手架：在当前 repo 新增 `miniprogram/`，包含 `app.json/app.js/app.wxss`、基础 pages/components/services/utils 目录；不影响现有 Web 构建与部署。
- [ ] 52.2 API 契约梳理：列出小程序 MVP 依赖的共享接口，确认 `/api/prediction/enhanced`、`/api/geocoding/search`、`/api/photos`、照片上传、收藏/最近查询、微信登录等接口边界。
- [ ] 52.3 微信登录与用户维度：新增或设计 `POST /api/wechat/login`，服务端以 openid 关联收藏、最近查询、照片投稿归属；为未来 iOS 预留跨端 userId/identity provider 模型。
- [ ] 52.4 首页查分 MVP：原生小程序页面支持手动搜索地点、当前位置、朝霞/晚霞切换、今日/明日评分。
- [ ] 52.5 预测结果页：展示分数、质量等级、最佳观赏窗口、高/中/低云、能见度、湿度、AOD 和简短解释；不复制 Web 端长段落。
- [ ] 52.6 收藏与最近查询：本地缓存 + 服务端持久化，按 openid 同步。
- [ ] 52.7 小程序分享：实现微信小程序卡片分享，标题、描述、缩略图遵循霞客分享卡片规范。
- [ ] 52.8 照片上传：使用 `wx.chooseMedia` / `wx.uploadFile` 接入现有照片 API 或小程序兼容接口，保留地点、拍摄时间、上传者、上传时间元数据。
- [ ] 52.9 分享地图入口：第一阶段可跳 H5 或轻量原生地图/列表；正式阶段做原生 marker/聚合，并复用 `/api/photos`。
- [ ] 52.10 微信平台配置清单：整理 request/upload/download/web-view 合法域名，定位权限、类目、`app.json` 声明、审核注意事项。
- [ ] 52.11 测试与验收：小程序 service 层单测、后端新增接口测试、微信开发者工具人工验收清单。
- [ ] 52.12 MVP 信息架构：定稿 tab/页面层级、页面跳转、空状态、错误状态和深链参数；明确哪些页面原生实现，哪些阶段性跳 H5。
- [ ] 52.13 共享 API 契约文档：为小程序和未来 iOS 固化登录、搜索、预测、收藏、最近查询、照片上传、分享、地图入口接口的请求/响应/错误码/限流。
- [ ] 52.14 服务端用户模型设计：新增 `userId + identities` 设计，微信 `openid` 只作为 identity provider；收藏、最近查询、投稿归属绑定 `userId`。
- [ ] 52.15 小程序设计 token 与基础组件：把 Web 主题变量映射为 WXSS token，并沉淀按钮、卡片、分数、指标、列表、弹窗等基础组件规范。
- [ ] 52.16 地图与图表技术验证：验证小程序 `map` marker/聚合、canvas/自定义图表可行性；明确哪些 Web Leaflet/Chart.js 能力不直接搬。
- [ ] 52.17 小程序分享与落地页：设计 `onShareAppMessage` 参数、分享卡片标题/图、落地页路由和 H5 fallback。
- [ ] 52.18 照片上传 MVP 契约：确认 `wx.chooseMedia` / `wx.uploadFile`、EXIF/手动地点时间、上传鉴权、限流、审核/隐藏策略。
- [ ] 52.19 微信平台与隐私审核清单：整理合法域名、类目权限、定位/相册授权文案、隐私协议、用户数据删除路径和提审材料。
- [ ] 52.20 未来 iOS 兼容检查：每个新增 API、用户字段、设计 token 和分享/上传流程都要标注 iOS 是否可复用或需要平台适配。
- [ ] 52.21 小程序调试链路：明确微信开发者工具、真机调试、体验版验收流程；记录 AppID、基础库版本、机型、网络环境和调试日志要求。
- [ ] 52.22 小程序自动化测试：接入 service 单测、后端 API 合约测试，并预留 `miniprogram-automator` 页面自动化和 `miniprogram-ci` 构建/预览入口。
- [ ] 52.23 真机验收矩阵：覆盖 iOS/Android 的定位、相册、上传、分享、地图 marker/聚合、弱网、授权拒绝和接口失败降级。

### 设计文档
- 总览：`design.md`
- 细分：`design/miniprogram-ios.md`

### 建议 PR 拆分
- PR A（规划冻结）：52.12、52.13、52.14、52.15、52.19、52.20；先冻结 IA、API、用户模型、token、隐私审核和 iOS 兼容口径。
- PR B（小程序骨架）：52.1、52.4、52.5、52.15；能查一个城市并展示评分，基础组件与设计 token 同步落地。
- PR C（用户与分享）：52.3、52.6、52.7、52.17；登录、收藏/最近查询、分享卡片和落地页。
- PR D（照片与地图）：52.8、52.9、52.16、52.18；照片上传、地图入口、marker/聚合和 EXIF/审核策略。
- PR E（平台验收）：52.10、52.11、52.19、52.20、52.21、52.22、52.23；微信开发者工具、真机调试、体验版、自动化、隐私审核、后端接口测试和 iOS 兼容复核。

### 验收标准
- 小程序代码在当前 repo 内，不单独建库。
- 小程序不复制预测算法，所有评分来自共享后端。
- 新增后端接口要同时考虑 Web、小程序、未来 iOS，不写死微信端。
- 收藏、最近查询、投稿归属绑定服务端 `userId`，微信 `openid` 只作为小程序登录 identity，不作为永久业务主键。
- 小程序 UI 复用霞客设计语言；用户可见文案至少维护 `zh-CN`、`zh-TW`、`en-US`。
- 开发前必须能从任务清单追溯到信息架构、API 契约、用户模型、设计 token、平台审核和 iOS 兼容检查。
- 小程序提审前必须有开发者工具、真机、体验版和自动化测试记录；定位、相册、上传、地图、分享不能只靠模拟器验证。
- 每个 PR 必须带 branch、commit、PR、CI 状态；合并/部署仍需 Alex 明确授权。


## 🆕 需求51：照片分享元数据增强与地图聚合展示（2026-05-09）

### 背景
Alex 要求照片分享补齐更像“相册/地图”的元数据体验：上传者、地点、拍摄时间、上传时间都要清楚；同一地方多张图不能堆成一团，要参考 Apple 相册地图做聚合/堆叠展示。

### 任务拆分
- [x] 51.1 数据模型与 API：扩展照片元数据字段 `uploaderName`、`locationName`、`takenAt`、`uploadedAt` 展示规范；旧数据缺字段必须兼容；`/api/photos` 不暴露内部限额字段。（PR #656/#657）
- [x] 51.2 上传表单 UI：后台上传增加上传者、地点、拍摄时间输入；地点/拍摄时间允许自动读取后手动修正；新增解析地址/经纬度/拍摄时间按钮。（PR #656/#657）
- [x] 51.3 自动读取：继续从 EXIF 读取 GPS 与拍摄时间；接入反向地理编码，根据经纬度自动建议地点名称；自动地点仅写展示字段，不反向修改坐标。（PR #656/#657）
- [x] 51.4 后台编辑管理：照片列表支持编辑上传者、地点、拍摄时间、描述、经纬度；上传时间只读不可改；保存后同步影响 `/api/photos` 与 `/gallery`。（PR #656）
- [x] 51.5 时间规则：服务端记录上传时间，以服务端时间为准；展示层格式化展示，后台只读不可改。（PR #656）
- [ ] 51.6 地图聚合展示：同一地点/近距离多图按 zoom 和像素距离聚合成 stack marker，显示代表缩略图 + 数量角标；点击后展示缩略图列表/小网格。
- [ ] 51.7 Marker/Popup 细节：marker、popup、聚合列表优先使用 `thumbUrl`，无缩略图才 fallback 原图；popup 展示上传者、地点、拍摄时间、上传时间。（popup 元数据已完成，聚合列表待做）
- [ ] 51.8 i18n 与无障碍：新增用户可见文案优先维护 `zh-CN`、`zh-TW`、`en-US`，其他语言默认英文 fallback；图片、按钮、时间文本有可读 label。
- [ ] 51.9 测试与验证：补 PhotoService/API 单测、上传表单单测、地图聚合纯函数测试；用至少 50/100/150km 半径业务测试不回归；浏览器验证移动端聚合不遮挡缩放控件。（PhotoService/admin/geocoding 部分测试已补，地图聚合待做）

### 已完成记录
- PR #656：后台照片编辑、照片元数据、Grid 状态、地图底图/标签等修复；merge commit `896c46f`。
- PR #657：上传表单新增解析地址/解析经纬度/解析拍摄时间；高德地理编码调用写入后台 API 日志；merge commit `0813de8`。

### 建议 PR 拆分 / 分发
- 已完成：元数据基础、上传与编辑体验主体。
- 下一步 PR C（地图聚合）：51.6、51.7、51.8、51.9，Apple 相册式 stack marker、popup 列表、缩略图优先、i18n/无障碍与视觉验证。

### 验收标准
- 上传者为空时所有展示位置显示“网友”。
- 地点可自动建议也可手动输入；手动地点不改变经纬度。
- 拍摄时间可从 EXIF 自动读取也可手动输入；手动拍摄时间不影响经纬度。
- 上传时间由服务端记录，展示为北京时间，后台只读不可改。
- 后台可编辑上传者、地点、拍摄时间、描述、经纬度；编辑地点不改变经纬度，编辑拍摄时间不改变上传时间。
- 同一地点多张照片不会重叠成多个不可点 marker；低 zoom 聚合，高 zoom 逐步拆分。
- marker/popup/聚合列表默认加载缩略图，不默认加载原图。
- PR 必须带 branch、commit、PR 链接、CI 状态；合并/部署仍需 Alex 明确授权。


## 📌 文档状态索引（2026-05-07）

- 当前三大文档：`requirements.md` / `design.md` / `tasks.md`。
- 文档边界：需求写“为什么/验收”，设计写“怎么组织/关键决策”，任务写“拆分/状态/证据”。
- 新需求落地时必须同步三处：需求编号、设计影响、任务状态。
- PR 汇报必须包含 branch、commit、PR、CI；合并和部署仍需 Alex 明确授权。

## ✅ 需求49：.kiro 三大文档优化（2026-05-07）

### 目标
让 `.kiro/specs/weather-sunset-predictor/` 下三大文档与近期真实实现同步，减少过期状态、重复流水账和需求/设计/任务断链。

### 任务拆分
- [x] 49.1 更新文档边界说明：明确 requirements/design/tasks 各自职责。
- [x] 49.2 补齐近期需求：新增需求48（分数明细解释链路、24小时温度图天气标签）。
- [x] 49.3 设计同步：补充分数明细 ledger 与温度图天气标签的设计原则。
- [x] 49.4 任务同步：记录 PR #589/#590 已完成状态与验证方式。
- [x] 49.5 标注后续整理方向：历史长任务后续可继续按“完成摘要 + 证据链接”压缩，保留可追溯性但降低阅读成本。

### 验收标准
- requirements/design/tasks 三文档能互相追溯同一需求编号。
- 不把已废弃或已完成很久的内容标成“待执行”。
- 新增内容不引入未授权开发任务；只整理文档与近期已完成事实。


## ✅ 需求50：管理后台信息架构重构（2026-05-07）

### 任务拆分
- [x] 50.1 调研现有后台实现：`public/admin/index.html`、`admin.js`、`admin.css`、`server/routes/admin.js`、`server/routes/api-logs.js`。
- [x] 50.2 使用主页同款 menu/panel 模板拆分后台页面：总览、运维、日志、定时任务、Agent/API、照片。
- [x] 50.3 收敛自动刷新：仅 Dashboard/Ops/Logs 高频刷新，其他页按需加载。
- [x] 50.4 运维页增加 Grid 队列状态可视化，高风险动作集中到 danger zone。
- [x] 50.5 Token 编辑从 `prompt` 改为弹窗表单。
- [x] 50.6 补充后台结构单测与静态页面/i18n 相关回归。

## ✅ 需求45：Agent API 与 API Token 管理（已完成，2026-05-03 核对）

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
- [ ] 47.9 真实页面验收：至少用 Playwright 或截图验证 `en-US/ja-JP/ko-KR/es-ES` 关键路径：首页搜索、预测结果、地图、设置、API接入/申请。（暂缓：本容器缺 Chromium 系统依赖跑不了；Alex 回北京后再看/补本地或截图验收。CI 已有 primary-locale-layout.spec.js gate）

### 验收标准
- [x] `en-US/ja-JP/ko-KR/es-ES` 与 `zh-CN` 的用户可见 key 结构一致，无 `Translation key not found`。（2026-05-03：`primaryLocalesCompleteness.test.js`）
- [x] 四种语言下核心页面不出现中文残留（城市名/地名数据、品牌名和明确允许项除外）。（2026-05-03：static/dynamic audits + locale quality guards）
- [x] 所有新用户可见文案必须同步四种语言；PR 缺任一语言视为不完整。（2026-05-03：key completeness guard）
- [ ] 移动端英文/日文/韩文/西文长文案不横向溢出、不遮挡主要操作。（暂缓：本容器缺 Chromium 系统依赖跑不了；Alex 回北京后再看。CI 已接入 primary-locale-layout.spec.js）
- [x] 自动化测试真实通过；`No tests found` 不算通过。（2026-05-03：regression suite meta guard + concrete test commands）

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

## ✅ 需求44：国际城市搜索排序优化（主体已完成，2026-05-07 核对）

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
- 2026-05-07 核对：当前 GitHub open PR 中未见 #431；该条历史待办不再作为活跃阻塞。

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

### P1（已完成）
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

## ✅ 历史已完成任务（旧需求整理）

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

## ✅ 需求48：预测解释与图表可读性优化（2026-05-07）

### 背景
Alex 指出分数明细仍然“不知道怎么从 78 变成 60”，并要求 24 小时温度预报附上天气。该需求只改展示解释，不改算法。

### 任务拆分
- [x] 48.1 分数明细移动端 ledger：最终分 hero、天气上下文 chips、步骤卡片化。（PR #589）
- [x] 48.2 删除无信息文案：移除“分数流水，不是文字分析”“未触发封顶/无修正”等占位。（PR #589）
- [x] 48.3 补清楚分数变化：基础分展示 `画布×80% + 光路×20% = 基础分`，显色修正展示 `基础分 × 显色系数 = 修正后分`。（PR #589）
- [x] 48.4 24 小时温度图附天气：温度图下方按小时数据展示晴天/少云/多云/阴天/降水标签，移动端降采样。（PR #590）
- [x] 48.5 测试：`PredictionController.test.js`、`ChartRenderController.test.js` 覆盖对应渲染。

### 完成记录
- PR #589：`fix: refine score breakdown mobile ledger`，merge commit `61ec15b`，CI passed，已部署。
- PR #590：`fix: add weather labels to hourly temperature chart`，merge commit `04ac117`，CI passed，已部署。


## ✅ 需求46：朝霞/晚霞预测卡片概念界面重构（已完成）

### 目标
根据 Alex 提供的概念图，重构朝霞/晚霞预测卡片的信息结构，让用户先看到结论、分数、日出/日落时间和最佳观赏窗口，再看到云层与形成条件分析。视觉保持霞客现有体系，云况雷达不变。

### 任务拆分
- [x] 46.1 现状审计：定位当前朝霞/晚霞卡片、形成条件分析、云况雷达对应的渲染函数与 CSS，记录不可动边界。（2026-05-03：`docs/prediction-card-46-audit.md` + audit guard）
- [x] 46.2 头部摘要重构：展示朝霞/晚霞类型、今日/明日/日期、分数、质量等级、`日出/日落 HH:mm`、最佳观赏窗口；确认全部使用已有地点 IANA 时区格式化结果。（2026-05-03：header summary pills + timezone unit coverage）
- [x] 46.3 云层摘要重构：以结构化方式展示高云/中云/低云百分比与状态，保持云况雷达组件不变。（2026-05-03：cloud layer status pills + radar placeholder guard）
- [x] 46.4 形成条件分析重排：顶部结论 + 中部指标网格（高云/中云/低云/能见度/湿度/AOD）+ 底部 2-3 条短解释；统一 ✅/⚠️/❌ 图标。（2026-05-04：conclusion-first analysis layout + metric grid）
- [x] 46.5 霞客视觉适配：沿用现有深色玻璃、霞光橙金、蓝紫天空和主题变量；不照搬概念图粉紫配色；移动端无横向滚动、不截断文本。（2026-05-04：分析模块改用现有 glass/sunset tokens + 移动端溢出 guard）
- [x] 46.6 回归测试：复用既有时区/AOD/云层/分数明细测试；新增或更新 DOM 渲染测试，覆盖新版头部摘要、指标网格、分数明细入口仍可点击、缺失数据降级、云况雷达 marker 保持存在。（2026-05-04：PR #548，3 suites / 44 tests passed）
- [x] 46.7 验证与 PR：运行相关单测；提交分支、push、创建 PR；PR 创建后停止等待 Alex 明确“合并/ok/批准”。（2026-05-04：PR #548 已合并，merge commit 705e857）

### 验收标准
- [x] 截图/DOM 可验证卡片信息层级符合：结论 → 时间/分数 → 云层 → 条件分析。（46.1-46.5 DOM/CSS guard）
- [x] 日出/日落不是倒计时文案，且使用已有目标地点时区格式化结果。（PredictionController timezone tests + 46.6 regression）
- [x] 云况雷达未改动、未消失、未被新布局挤压。（46.6 radar anchor regression）
- [x] 形成条件分析不再像日志文本，数字值清晰对齐。（46.4 metric grid + 46.5 visual guard）
- [x] 自动化测试真实通过；`No tests found` 不算通过。（2026-05-04：3 suites / 44 tests passed）

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
