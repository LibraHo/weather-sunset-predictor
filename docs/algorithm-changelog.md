# 火烧云算法版本记录

本文件记录线上评分算法的可追溯版本。后续每次修改 `EnhancedPredictionService`、光路、画布、渲染、封顶/保底逻辑，都必须新增一条记录，并同步：

1. 火烧云计算方法页面
2. 评分细则面板
3. 火烧云形成条件文字分析
4. 对应回归测试/样本回放

## 2026.06.18-remote-layer-carriers-v1

- 日期：2026-06-18
- 代码：`server/services/EnhancedPredictionService.js`、`server/services/LayerBrightnessService.js`、`src/controllers/PredictionController.js`、`src/locales/*.js`、`miniprogram/pages/methodology/index.js`、`miniprogram/pages/result/index.js`
- 背景：远端日落方向云原先容易被解释成一个“日落方向云幕”，用户看不到高云、中云和低云遮挡分别如何影响基础分。
- 改动：
  - 评分细则把远端方向载体展示为 `remoteHigh`、`remoteMid` 和 `remoteLowBlock`，并在基础分贡献里列出远端高云/中云。
  - Web 算法页、小程序算法页同步说明：10/25/50/75/100km 的小时两点窗口加权后，拆成远端高云、远端中云和远端低云遮挡。
  - 说明版本更新为 `2026.06.18-remote-layer-carriers`。
- 回归测试：
  - `tests/unit/controllers/PredictionController.test.js`
  - `tests/unit/home-methodology-structure.test.js`
  - `tests/unit/miniprogram/methodology-page.test.js`
  - 真实校准样本库要求 9 个历史样本 + 2026-06-17 北京样本全量回放。

## 2026.06.13-layer-weighted-brightness-v1

- 日期：2026-06-13
- 代码：`server/services/LayerBrightnessService.js`、`server/services/EnhancedPredictionService.js`、`src/controllers/PredictionController.js`、`src/locales/*.js`、`miniprogram/pages/methodology/index.js`、`miniprogram/pages/result/index.js`
- 背景：最终评分口径需要从整体 `载体 × 受光亮度 × 空气显色` 收敛为 `Σ(分层载体 × 分层受光亮度) × 空气显色`；太阳方向光路继续作为受光亮度的内部因子，不再作为最终分的独立乘子。
- 改动：
  - `LayerBrightnessService` 输出 `weightedCarrierScore` 和 `layerContributions`，按低云/中云/高云/方向云带/气溶胶载体贡献分别乘受光亮度后求和。
  - 受光亮度使用 `log1p` 饱和响应：从无光到弱光的分数增长更敏感，接近满亮后边际增益变小；太阳方向阻挡走廊仍保持线性保守响应。
  - `EnhancedPredictionService` 使用 `weightedCarrierScore` 作为空气显色前基础分，保留旧 `brightnessMultiplier` 作为展示和兼容字段。
  - Web 评分细则、算法页、小程序算法页和结果页同步显示 `Σ(载体 × 受光亮度)` 口径。
- 预期影响：
  - 远端光路阻挡、单层云带和方向云带场景会按各层真实贡献加权，不再用一个整体亮度系数套所有载体。
  - 清透、暖散射和已校准的正例保持原有区间；弱亮度场景仍会被压分，但不再把“有一点光”的样本压到接近无光。
- 回归测试：
  - `tests/unit/server/LayerBrightnessService.test.js`
  - `tests/unit/server/EnhancedPredictionService.layerBrightness.test.js`
  - `tests/unit/server/EnhancedPredictionService.test.js`
  - `tests/unit/controllers/PredictionController.test.js`
  - `tests/unit/home-methodology-structure.test.js`
  - `tests/unit/miniprogram/methodology-page.test.js`

## 2026.06.06-gray-veil-directional-carrier-v2

- 日期：2026-06-06
- 代码：`server/services/EnhancedPredictionService.js`、`src/controllers/PredictionController.js`、`src/locales/*.js`、`miniprogram/pages/methodology/index.js`
- 背景：北京 2026-06-04 现场反馈应在 50-60，属于太阳方向中云带被照亮；北京 2026-06-05 现场反馈远不如 4 号，只有远处一点点，但旧 `scoringV2` 把满铺中高云 + PM/AOD 偏高当成 `warm_scattering_path_open`，从 `62 × 1.1` 抬到 68.2。
- 改动：
  - 新增连续灰幕空气显色：本地与太阳方向中高云接近满铺、总云量高且 PM2.5/PM10/AOD/dust/visibility 呈灰幕压力时，优先进入 `gray_veil_air_suppression`，降低 `airFactor`，而不是继续给暖散射加成。
  - 太阳方向中云带载体改为连续评分：低云不挡、光路打开、日落方向中云带明确时，可进入 50-60 档；仍有上限，避免把局部方向云带误判成 70+ 爆发。
  - 同步 Web 算法页、评分细则、火烧云形成条件文字分析、多语言文案，以及小程序算法页和小程序文字分析口径。
- 预期影响：
  - 2026-06-03 北京暖色散射样本保持 70 档。
  - 2026-06-04 北京方向中云带样本约 53.5。
  - 2026-06-05 北京满铺灰幕样本约 44，且状态为轻微霞光。
- 回归测试：
  - `tests/fixtures/real-sunset-cases/2026-06-04-beijing-sunset.json`：方向中云带样本。
  - `tests/fixtures/real-sunset-cases/2026-06-05-beijing-sunset.json`：满铺灰幕样本。
  - `tests/unit/server/real-sunset-case-library.test.js`：真实样本全量回放。
  - `tests/unit/controllers/PredictionController.test.js`、`tests/unit/home-methodology-structure.test.js`、`tests/unit/miniprogram/methodology-page.test.js`：展示文案同步。

## 2026.06.04-local-upper-participation-cap

- 日期：2026-06-04
- 代码：`server/services/EnhancedPredictionService.js`
- 背景：`scoringV2` 初版修正了 2026-06-03 北京暖色散射低估问题，但历史样本回放发现“远端开口 + 中高云”容易过度乐观：2026-05-10 颐和园被打到 100，2026-05-18 北京/玉渊潭被打到 75.6，而现场反馈分别是“偏好/值得看但非满分”和“约 65，不是 78+”。Alex 补充指出，很多真实火烧并不是头顶高云变红，而是日落光路方向的云变红，所以不能只用头顶云参与度校准。
- 改动：
  - 新增通用 `visibleSunsetSectorCap`：高分必须有足够可见日落扇区中高云参与；本地头顶云和日落方向近端/中距云都计入，只有很远端单独好时才压分。
  - 当前实现用本地云 + 日落方向多点采样作为可见日落扇区代理；不同距离进入同一套光路/云载体逻辑，再按 `distanceKm` 加权，避免为单个距离写特殊规则。
  - 收紧同时保留暖色散射正例：本地中高云充足、近距日落方向参与、光路开且轻/中度霾可显色的 2026-06-03 北京样本进入 70 档；该修正只用于单点详细预测/3 天预测，不用于火烧云地图简化分支。
  - 不加城市/日期特殊规则，统一约束“光路方向有云但不足以构成全景顶级爆发”的过高分。
- 后续计划：
  - 本 PR 将单点日落方向采样扩展到 `10/25/50/75/100km`；历史 4 点样本按 `distanceKm` 取权重兼容回放。
  - `10/25/50/75/100km` 统一计算低/中/高云、降水、光路遮挡和可染色云；`25/50km` 权重较高，`10km` 作为近距样本参与整体加权，不单独决定加分或扣分。
  - 火烧云地图显式走 `map_grid_simplified` 分支：只使用 GFS/CAMS 区域格点自身云、辐射、水汽和空气质量字段，不假装拥有单点 10/25/50/75/100km 精细光路。
  - Web / 小程序算法页、文字分析和评分细则同步改为“阻挡走廊 / 距离加权 / 载体保护”口径，避免继续展示“近远云墙”或“保底”式解释。
- 预期影响：
  - 2026-05-10 颐和园从 100 压到 68。
  - 2026-05-18 北京/玉渊潭补入 Open-Meteo 历史预报 10/25/50/75/100km 云层采样后，回放约 66。
  - 2026-06-02 北京灰幕保持约 30，2026-06-03 北京橙红光回放约 71。
- 回归测试：
  - 新增 `tests/fixtures/real-sunset-cases/2026-05-10-summer-palace-sunset.json`。
  - 新增 `tests/fixtures/real-sunset-cases/2026-05-18-beijing-yuyuantan-sunset.json`。
  - `tests/unit/server/EnhancedPredictionService.test.js`：开口型中高云和雨后高云路径样本校准。
  - `tests/unit/server/real-sunset-case-library.test.js`：真实样本统一回放。

## 2026.06.03-sunset-scoring-v2

- 日期：2026-06-03
- 代码：`server/services/EnhancedPredictionService.js`、`src/controllers/PredictionController.js`、`src/locales/*.js`
- 背景：北京 2026-06-03 实况无雨，光非常美且呈橙红色，主观进入 70 档；旧逻辑把 AOD/dust 偏高一概视为灰幕风险，将光路开且有中高云接光的样本压到 35。Alex 明确要求不要为单个样本乱加特殊规则，而要调整评分系统。
- 改动：
  - 新增通用 `scoringV2` 解释层：`云载体 × 日落光路 × 空气显色`。
  - 当日落方向光路开、低云不堵、能见度可接受时，轻/中度 AOD/PM/dust 作为橙红散射正向因素；无光路、极端霾、低能见度、降水和厚低云仍优先压制。
  - 火烧云分析和评分细则同步显示“四分量”口径，不再把开口暖色散射解释成灰幕失败。
- 预期影响：
  - 2026-06-03 北京从 35 回到 70 档，落入最新实况校准区间。
  - 2026-06-02 北京无雨灰幕样本保持约 30，不因 AOD/PM 存在而被抬高。
- 回归测试：
  - `tests/fixtures/real-sunset-cases/2026-06-03-beijing-sunset.json`：开口暖色散射样本。
  - `tests/unit/server/real-sunset-case-library.test.js`：6/2 与 6/3 真实样本统一回放。
  - `tests/unit/server/EnhancedPredictionService.test.js`：厚高云、极端霾、低云/光路等反例继续通过。

## 2026.05.13-formation-factors-v1

- 日期：2026-05-13
- 代码：`src/controllers/PredictionController.js`、`src/locales/*.js`
- 背景：火烧云分析卡片随着算法迭代不断追加条目，用户看到的解释越来越碎，不利于快速判断“为什么这个分数”。
- 改动：
  - 将火烧云分析固定为四个用户可读因子：云层载体、光路条件、空气显色、限制因素。
  - 每个因子只展示状态和一句解释，避免把气溶胶、厚云、低云、雨后等内部规则拆成一长串条目。
  - 评分公式不变；分数明细仍保留完整计算链路。
- 预期影响：
  - 用户阅读路径稳定，不再随内部算法分支增多而变长。
  - 气溶胶弱载体、低云遮挡、灰幕、厚云、降水等情况会归并到对应因子。
- 回归测试：
  - `tests/unit/controllers/PredictionController.test.js`：分析卡片固定四因子、气溶胶场景归并到空气显色。
  - `tests/unit/i18n/*`：主语言和扩展语言 key 完整且无中文/英文 fallback 残留。
  - 全量：`npm test -- --runInBand --silent`。

## 2026.05.12-aerosol-carrier-v1

- 日期：2026-05-12
- 代码：`server/services/EnhancedPredictionService.js`
- 背景：北京 2026-05-12 晚霞样本中，中高云画布很少，模型给约 20 分；但现场能看到红色太阳盘和一点暖色天光，说明适度薄雾/气溶胶在光路通畅时也能提供弱显色载体，只是不应被当成典型火烧云。
- 改动：
  - 将最终评分里的“画布分”系统化为“载体分”：`carrierScore = max(cloudCanvasScore, activatedAerosolCarrier)`。
  - 新增气溶胶弱载体分：适度 AOD/PM 可提供低上限的红日落载体；必须由光路分激活，光路差时不加分。
  - 重霾、沙尘、低能见度、低云遮挡和降水仍按衰减/限制处理，不会因为气溶胶而抬高。
- 预期影响：
  - 云很少但有红太阳/暖色散射的普通日落，从 20 多分抬到 30 多分，表达为“有一点日落观赏性，但不是典型火烧云”。
  - 好火烧云、高云载体场景基本不变；南京厚灰幕、重霾/沙尘和低云遮挡场景不抬高。
- 回归测试：
  - `tests/unit/server/EnhancedPredictionService.test.js`：北京弱红日落、干净晴空、光路未激活、重霾反例。
  - `tests/unit/controllers/PredictionController.test.js`：火烧云分析展示气溶胶弱载体。
  - `tests/unit/home-methodology-structure.test.js`、i18n 测试：方法页与多语言 key 同步。

## 2026.05.11-opening-upper-cloud-carrier-v1

- 日期：2026-05-11
- 代码：`server/services/EnhancedPredictionService.js`
- 背景：2026-05-10 颐和园现场样本中，低云为 0、中高云共同存在、太阳方向有透光开口、能见度和 AOD 正常，但云厚模块把它按“厚云幕”处理，导致画布分被压到 45，最终分约 41。
- 改动：
  - 新增“开口型中高云载体”保护条件：低云 ≤10%、中云 ≥45%、高云 ≥40%、太阳方向光路通畅或有开口、无降水且空气不灰。
  - 在该条件下，云厚修正从厚云幕的 `0.45` 软化为 `0.58`，只表达“云面偏厚、需看发展”，不再按完全遮光灰幕处理。
  - 低云遮挡、灰霾/沙尘、降水、能见度差等保守条件仍不触发该保护。
- 预期影响：
  - 类似颐和园的“低云少 + 中高云可染色 + 太阳方向开口”样本从 40 分左右回到 55–65 分区间，表达为“值得看、有发展机会”。
  - 真实阴天、灰幕、沙尘或无开口的厚云场景不会被抬高。
- 回归测试：
  - `tests/unit/server/EnhancedPredictionService.test.js`：颐和园开口型中高云样本 + 高灰霾反例。

## 2026.05.10-low-cloud-lightpath-v3

- 日期：2026-05-10
- 代码：`server/services/LightPathV2Service.js`
- 背景：V2 光路曾把 `cloudCover >= 90` 直接当作低云阴天处理，导致“高云/中云很多、低云很少”的火烧云画布场景被误判为光路很差。
- 改动：
  - 光路遮挡改为低云主导：`lowClouds >= 75`，或总云量很高但低云是主导云层时，才按低云遮光处理。
  - 中高云丰富且低云很少时，不再仅因总云量高压低光路；中高云优先作为可染色画布参与判断。
  - 降水、低云主导阴天、强灰幕等低分保护仍保留。
- 预期影响：
  - 高云满天但低云少的晚霞样本，光路不再被误伤。
  - 低云主导、雨雪、低能见度等真实遮光场景仍保持保守。
- 回归测试：
  - `tests/unit/server/LightPathV2Service.test.js`：高云画布反例 + 低云主导保守样本。
  - `tests/integration/server/lightpath-v2.integration.test.js`：增强预测接口光路反例。

## 2026.05.10-upper-cloud-carrier-v2

- 日期：2026-05-10
- 代码：`server/services/EnhancedPredictionService.js`
- 背景：北京 2026-05-10 晚霞样本中，高云和中云都充足、低云为 0、无降水、能见度良好，但日落时刻直射比低导致算法把它判为厚高云幕，分数落到 30 多分。
- 改动：
  - 新增“中高云载体明确”保护条件：高云 ≥80%、中云 ≥30%、低云 ≤10%、无降水、能见度 ≥15km、AOD/PM10/dust 未达到灰幕风险。
  - 在该条件下，云厚信号只把画布分温和乘以 `0.75`，不再额外触发厚高云封顶，不再额外压低光路分。
  - 真正的厚高云幕、灰霾/沙尘、降水、几何不可行等封顶仍保留。
- 预期影响：
  - 北京该类样本由 30 多分回到约 50–60 分区间，表达为“有机会/轻微晚霞”，而不是“几乎无望”。
  - 空气灰、沙尘重或缺少中云支撑的高云幕仍保持保守低分。
- 回归测试：
  - `tests/unit/server/EnhancedPredictionService.test.js`：dense upper-cloud carrier softening case。
  - 全量：`npm test -- --runInBand`。
