# 霞客小程序未完成项收口工作流

本文把 2026-05-12 前后的小程序剩余工作拆成可执行顺序，区分“仓库内可完成”和“必须依赖微信后台/真机/体验版”的外部动作。后续汇报不得把外部阻断项说成已完成。

## 当前状态

- 已合并：小程序骨架、首页查分、结果页、登录/收藏/最近查询、分享参数、照片列表、照片上传页、平台配置清单、设计语言样式。
- 已合并：照片分享地图聚合，见 PR #663，merge commit `d92dc72b2f635bd4d0bdcbe9fd3671ca25d0dcf8`。
- 已合并：PR #690 补齐结果页火烧云文字分析、周边云况雷达、未来 3 天预测，merge commit `2c6b6eef9f5f9352326dc4e1fe5a4c65a0637937`。
- 已合并：PR #691 对齐 Web 同端体验，补首页/结果页页面菜单、原生火烧云地图、算法说明入口、照片/上传路径，merge commit `a70b0d27d2cdfb23c42cbfde33f99a8c4fb23310`。
- 已上传：微信体验版 `1.0.2`，上传命令使用 `miniprogram-ci upload`，对应 main commit `a70b0d27d2cdfb23c42cbfde33f99a8c4fb23310`。
- 未完成：开发者工具、iOS 真机、Android 真机、弱网和接口失败降级验收仍缺真实记录；未提审。

## 执行顺序

### 1. 收口已有代码状态

状态：仓库内已完成。

- `miniprogram/app.json` 已具备定位隐私声明，见 PR #670。
- PR #690/#691 已合并到 `main`。
- 体验版 `1.0.2` 已上传，可用于真机和开发者工具验收。
- 不需要部署 Web 服务；这是小程序配置和测试变更。

### 2. 冻结小程序 MVP 信息架构

状态：仓库内已完成。

准源：
- `.kiro/specs/weather-sunset-predictor/design/miniprogram-ios.md`
- `docs/miniprogram-design-language.md`
- `docs/miniprogram-platform-checklist.md`

冻结口径：
- 首页、结果页、分享地图页、照片上传页已原生实现。
- 分享地图当前阶段提供照片列表和 H5 分享地图入口；原生地图聚合属于后续增强，不阻塞 MVP。
- 我的页不作为当前 MVP 独立 tab，收藏/最近查询先服务于首页和结果页。
- 空状态、错误状态、深链参数和 H5 fallback 已在设计文档中给出口径。

### 3. 固化共享 API 契约

状态：仓库内已完成。

准源：
- `.kiro/specs/weather-sunset-predictor/design/miniprogram-ios.md` 的“共享 API 契约草案”
- `tests/unit/server/wechat-login.test.js`
- `tests/unit/server/user-routes.test.js`
- `tests/unit/server/photos-routes.test.js`
- `tests/unit/miniprogram/*.test.js`

已覆盖接口：
- `POST /api/wechat/login`
- `GET /api/geocoding/search`
- `POST /api/prediction/enhanced`
- `GET/POST/DELETE /api/user/favorites`
- `GET/POST /api/user/recent-locations`
- `GET /api/photos`
- `POST /api/photos/upload`

后续新增接口必须保持 `userId + identities` 模型，不把微信 `openid` 暴露成业务主键。

### 4. 地图、图表、分享、上传技术验证

状态：仓库内文档、自动化与体验版上传已完成；原生真机体验待外部验收。

已完成：
- 小程序分享参数、标题和稳定路由测试。
- 照片上传 service、页面状态、元数据表单和上传进度测试。
- Web 分享地图聚合实现和测试，PR #663 已合并。
- 小程序原生照片地图已接入 `map` marker，保留 H5 分享地图 fallback。
- 小程序原生火烧云地图已接入 `/api/spots/china`，支持朝霞/晚霞切换和点选进入同源预测。
- 小程序设计文档已明确 Leaflet/Chart.js 不直接搬运，图表优先 canvas/轻量组件，地图优先小程序 `map` 组件或 H5 fallback。

外部待验收：
- 微信开发者工具中验证 `map`、分享卡片缩略图、上传权限弹窗。
- iOS/Android 真机验证 marker/聚合性能、弱网失败和权限拒绝路径。

### 5. 平台配置与人工验收

状态：被外部条件阻塞，不能在仓库内伪装完成。

必须拿到或完成：
- 真实小程序 AppID：`wx9463645c9cd7fb34` 已用于体验版上传。
- 微信后台 request/upload/download/web-view 合法域名配置。
- 体验成员配置。
- 微信开发者工具版本和基础库版本确认。
- iOS/Android 真机。
- 体验版上传和二维码：体验版 `1.0.2` 已上传；二维码/后台截图仍需保存到验收记录。
- 隐私协议和提审材料确认。

执行清单见 `docs/miniprogram-platform-checklist.md`。这些勾选项只有完成真实配置或真实验收后才能勾。

## PR 与合并规则

- 任何代码或文档变更必须走 branch -> commit -> push -> PR。
- PR 创建后必须等 GitHub CI 通过再正式汇报。
- 合并必须等待 Alex 对具体 PR 明确说“合并/ok/批准/yes”。
- 小程序文档和配置变更默认不部署 Web；体验版/提审属于微信平台发布流程，不等同于 Web 部署。

## 完成定义

仓库内完成：
- 任务清单状态与真实实现一致。
- 相关文档、契约、测试能追溯到 PR/commit。
- GitHub CI 通过。

平台完成：
- 微信后台配置完成。
- 开发者工具、真机、体验版验收记录完整。
- 阻断项全部清零。
- Alex 明确授权提审或发布。
