# 微信小程序与未来 iOS 设计

## 结论

霞客下一阶段主产品入口选择原生微信小程序，未来 iOS 复用同一套后端 API 与产品结构。公众号只做内容分发、活动运营和小程序导流，不作为主产品入口。

## 为什么不是公众号优先

- 霞客的核心行为是查分、定位、收藏、分享、照片投稿，属于工具型服务，不是纯内容消费。
- 公众号菜单打开 H5 的路径重，用户收藏和再次打开成本高。
- 小程序分享卡片、定位、选图、上传、最近使用入口更符合高频工具体验。
- 公众号文章仍有价值，但应承担传播和导流，而不是承载主要交互。

## A/B 方案取舍

### A. 小程序 web-view 版

用途：临时入口、灰度验证、过渡承载已有 H5 页面。

优点：
- 上线快，能最大复用现有 H5。
- 可快速验证微信内打开、分享链路和域名配置。

缺点：
- 体验仍像网页壳，定位、上传、分享等微信原生能力受限。
- 未来 iOS 基本不能复用前端实现。
- 难以形成微信内原生产品心智。

结论：可做临时入口，但不作为正式 MVP 主体。

### B. 原生小程序版

用途：正式 MVP。

优点：
- 用户打开、分享、收藏、上传链路更顺。
- 逼迫后端 API 契约稳定，未来 iOS 可直接复用。
- 能复用霞客现有设计语言，而不是复用 DOM 代码。

代价：
- 需要用 WXML/WXSS/小程序 JS 重写前端页面与组件。
- 地图、图表、分享卡片需要单独适配。

结论：正式方向选择 B。

## 仓库结构

小程序代码放在现有仓库，不单独建库：

```text
weather-sunset-predictor/
├── server/               # 现有后端，继续共用
├── src/                  # 现有 H5 前端
├── public/               # 现有静态页和后台
├── miniprogram/          # 新增：微信小程序原生前端
│   ├── app.json
│   ├── app.js
│   ├── app.wxss
│   ├── pages/
│   ├── components/
│   ├── services/
│   └── utils/
└── .kiro/
```

不单独建库的原因：
- 小程序强依赖现有预测、地理编码、照片、分享、用户数据 API。
- 当前仍在快速迭代，同 repo 能避免 Web/小程序/API 契约错位。
- CI 可以在一个 PR 内同时校验后端契约与小程序调用层。
- 未来如果小程序团队独立、发布节奏完全分离、CI 互相拖累，再评估拆库。

## 后端 API 原则

- 小程序调用 `https://sunset.bjhyc.online/api/...`，不复制算法。
- 新增 API 必须以“Web + 小程序 + 未来 iOS”三端共用为目标。
- 接口响应不要写死微信端概念；微信登录态可以在认证层处理，业务数据保持通用。
- 小程序本地只存缓存、最近状态和轻量 UI 偏好；用户收藏、最近查询、投稿归属放服务端。

## MVP 信息架构

第一版不做完整内容社区，优先把“查分、留存、分享、投稿”跑顺。

```text
小程序
├── 首页
│   ├── 地点搜索
│   ├── 当前定位授权
│   └── 今日/明日 朝霞/晚霞快捷查分
├── 结果页
│   ├── 分数与等级
│   ├── 最佳观赏窗口
│   ├── 关键指标
│   └── 分享入口
├── 地图/照片
│   ├── 分享地图入口
│   ├── 照片列表/轻量地图
│   └── 照片上传
└── 我的
    ├── 收藏地点
    ├── 最近查询
    ├── 投稿记录
    └── 隐私与数据管理
```

页面策略：
- 首页、结果页、收藏/最近查询、分享卡片必须原生实现。
- 分享地图第一阶段可跳 H5 或做轻量原生列表；正式地图聚合等 Web 端聚合稳定后再原生化。
- 照片上传必须原生实现，避免 H5 在微信内选图/上传体验不稳定。
- 设置页只放必要项：定位授权状态、缓存清理、隐私协议、数据删除入口。

## 共享 API 契约草案

| 能力 | 接口 | 说明 |
| --- | --- | --- |
| 微信登录 | `POST /api/wechat/login` | 入参 `code`，返回服务端 session token 与通用 `userId`。 |
| 地点搜索 | `GET /api/geocoding/search?q=` | 复用 Web 搜索排序；结果字段对小程序/iOS 稳定。 |
| 反向地理编码 | `GET /api/geocoding/reverse?lat=&lon=` | 上传照片或当前位置展示地点名。 |
| 单点预测 | `POST /api/prediction/enhanced` | 小程序结果页主接口，复用现有增强预测。 |
| 未来时间线 | `POST /api/prediction/batch` | 今日/明日/多日入口，按 MVP 需要裁剪展示。 |
| 收藏列表 | `GET /api/user/favorites` | 登录后按 `userId` 返回收藏地点。 |
| 新增收藏 | `POST /api/user/favorites` | 入参标准地点、经纬度、展示名。 |
| 删除收藏 | `DELETE /api/user/favorites/:id` | 只允许删除当前 `userId` 数据。 |
| 最近查询 | `GET /api/user/recent-locations` | 服务端同步，客户端可做本地兜底缓存。 |
| 写入最近查询 | `POST /api/user/recent-locations` | 查分成功后写入，服务端去重/限量。 |
| 照片列表 | `GET /api/photos` | 公开展示字段，不暴露内部限额字段。 |
| 照片上传 | `POST /api/photos/upload` | 小程序/iOS 共享上传入口，带鉴权、限流、审核状态。 |
| 分享落地 | `GET /api/share/resolve` | 根据分享参数返回地点/预测/照片入口元数据。 |

契约规则：
- 所有登录态接口使用服务端 session token，不把微信 `openid` 暴露给业务前端。
- 错误响应统一 `{ error: { code, message, details? } }`，避免小程序和 iOS 分别猜错误文案。
- 新接口默认要有频率限制、审计日志和字段兼容策略；旧客户端缺字段不能崩。
- 照片上传不要复用后台 Basic Auth 上传接口，应新增面向用户端的受控接口。

## 用户与存储

### 小程序阶段

- 微信 `openid` 只作为 identity provider 标识，不作为业务表永久主键。
- 新增微信登录接口，例如 `POST /api/wechat/login`，服务端用 `code` 换 openid/session 信息后创建或绑定 `userId`。
- 收藏地点、最近查询、照片投稿归属等服务端数据绑定 `userId`。
- 不在客户端长期保存敏感凭据。

建议数据模型：

```text
users
├── id
├── displayName
├── createdAt
└── updatedAt

user_identities
├── userId
├── provider        # wechat_mp / apple / phone / email
├── providerUserId  # openid / apple sub / phone hash / email hash
├── unionId
├── createdAt
└── lastLoginAt
```

服务端存储策略：
- `favorites`、`recent_locations`、`photo_submissions` 引用 `userId`。
- 小程序本地只缓存 session token、最近地点快照、UI 偏好；服务端数据才是准源。
- 未来账号合并时，只合并 identities，不迁移业务表主键。

### 未来 iOS

- iOS 不依赖 openid。
- 后端用户模型需要预留跨端绑定能力，例如 `userId` + provider identities。
- 小程序 openid 可作为一个 identity provider，而不是永久唯一用户模型。

## MVP 页面

1. 首页查分
   - 手动搜索地点。
   - 当前定位。
   - 朝霞/晚霞切换。
   - 今日/明日入口。

2. 预测结果
   - 最终分、质量等级、最佳观赏窗口。
   - 高/中/低云、能见度、湿度、AOD 等核心指标。
   - 简短解释，不搬 Web 端长段落。

3. 收藏与最近查询
   - 最近查询本地快速展示，服务端同步。
   - 收藏地点按 openid 存储。

4. 分享
   - 小程序卡片分享。
   - 分享标题、描述、缩略图遵循霞客现有品牌和分享卡片规范。

5. 照片上传
   - 使用 `wx.chooseMedia` 选择照片。
   - 使用 `wx.uploadFile` 上传到现有照片 API 或小程序专用兼容接口。
   - 保留拍摄地点、拍摄时间、上传者、上传时间元数据。

6. 分享地图
   - 第一阶段可用 H5 入口或轻量原生列表/地图。
   - 正式阶段做原生地图 marker/聚合，与 Web 分享地图共用照片 API。

## 地图与图表适配

小程序不能直接搬 Web 的 Leaflet 和 Chart.js，需要按能力拆：

- 首页/结果页图表：优先用 canvas 或轻量自定义组件实现分数、指标条、云层结构，不追求 Web 图表完全一致。
- 分享地图：优先使用小程序 `map` 组件和自定义 marker；聚合算法可复用 Web 端纯函数思路，但渲染层独立。
- 高级热力/复杂图层：第一阶段保留 H5 fallback，等原生地图性能和交互验证后再迁移。
- 未来 iOS：API 和聚合数据结构复用，地图渲染用 MapKit 或同类原生能力。

验收重点：
- 地图 marker 数量上升时不明显卡顿。
- 图表在低端机和窄屏上不遮挡文字。
- 地图/图表数据结构不绑定小程序组件私有字段。

## 设计语言复用

小程序不能直接复用 Web 的 HTML/CSS/DOM，但必须复用：
- 品牌名、Logo、图标风格。
- 霞客主题色：暖橙、日光金、夜空深蓝、玻璃感层级。
- 评分表达：分数、等级、最佳窗口、云层指标。
- 文案口径：普通用户能理解，避免工程词。
- 分享卡片构图和信息优先级。

建议在 `miniprogram/` 内维护轻量 token：

```css
--xiake-bg: var(--color-bg)
--xiake-surface: var(--color-surface)
--xiake-card-bg: var(--color-card)
--xiake-card-border: var(--color-border)
--xiake-text: var(--color-text)
--xiake-text-muted: var(--color-text-muted)
--xiake-accent: var(--color-sunset)
--xiake-accent-strong: var(--color-sun-gold)
--xiake-danger: var(--color-danger)
--xiake-radius-card: 8px
--xiake-shadow-card: ...
```

这些 token 与 Web 主题变量语义保持一致，但实现可按小程序 WXSS 约束调整。

组件策略：
- 先沉淀 `ScoreHero`、`MetricGrid`、`LocationSearch`、`FavoriteButton`、`PhotoUploader`、`ShareCardPreview`。
- 用户可见文案进入小程序 locale 文件，至少维护 `zh-CN`、`zh-TW`、`en-US`。
- 不把 Web 的装饰性布局完整复制到小程序；小程序优先保证扫读、点击热区和性能。

## 分享与落地

- 小程序分享使用 `onShareAppMessage`，参数只放稳定短 id 或经纬度/日期/type 等可解析字段。
- 分享标题遵循“地点 + 朝霞/晚霞评分 + 观赏窗口”，缩略图沿用霞客分享卡片构图。
- 分享落地页必须能在未登录状态展示基础预测；收藏、投稿等动作再触发登录。
- H5 fallback 用同一套分享参数，保证从公众号文章、浏览器、朋友圈入口进入时不丢上下文。
- 未来 iOS 使用同一分享解析接口，平台层只替换系统分享能力。

## 照片上传

- 小程序使用 `wx.chooseMedia` 选图、`wx.uploadFile` 上传。
- 服务端上传接口负责鉴权、大小限制、格式校验、缩略图、审核状态和元数据落库。
- EXIF 经纬度/拍摄时间能读则自动建议；读不到时必须允许手动填写地点和拍摄时间。
- 上传后的照片默认进入待审核或可隐藏状态，避免公开地图被垃圾内容污染。
- `uploadedAt` 由服务端生成，不允许客户端传入覆盖。
- 照片公开 API 只返回展示字段，不暴露 IP hash、每日限额等内部控制字段。

## 微信平台约束

- 所有请求域名、上传域名、下载域名需要在微信小程序后台配置。
- 域名必须 HTTPS，不能使用 IP、端口或未备案域名。
- `web-view` 需要配置业务域名，仅作为临时入口或补充页面。
- `wx.getLocation` / `wx.chooseLocation` 需要在 `app.json` 声明，并确认类目与接口权限。
- 地图、canvas、图表能力需要按小程序组件能力重新评估，不直接照搬 Leaflet/Chart.js。
- 订阅消息后续可做提醒，但要单独设计模板、触发条件和授权，不作为 MVP 必需项。

## 隐私与审核清单

- 请求域名：`https://sunset.bjhyc.online` 必须配置 request/upload/download 合法域名。
- 业务域名：如保留 H5 fallback，需要配置 `web-view` 业务域名。
- 权限声明：定位、相册/相机、上传图片必须有清晰用途说明。
- 隐私协议：说明位置、照片、拍摄时间、上传者信息、收藏/最近查询的用途和保存方式。
- 数据删除：用户需要能删除收藏、最近查询、投稿记录，或至少有可执行的人工删除入口。
- 审核材料：准备核心页面截图、功能路径说明、定位/相册使用说明、ICP备案与域名归属材料。

## 测试与验收

- 小程序 service 层需要可单测：API URL、参数、错误处理、字段映射。
- 后端新增接口必须继续有 Jest/Supertest 覆盖。
- MVP 必须人工在微信开发者工具验证：搜索、定位、评分、分享、上传、收藏。
- API 契约测试必须覆盖小程序/iOS 共享字段、错误码、登录态、限流和旧字段兼容。
- 地图/图表必须做真机或微信开发者工具性能与布局检查，不能只靠单测。
- PR 交付仍按现有流程：branch、commit、PR、CI 状态；合并/部署需 Alex 明确授权。
