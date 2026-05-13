# 火烧云算法版本记录

本文件记录线上评分算法的可追溯版本。后续每次修改 `EnhancedPredictionService`、光路、画布、渲染、封顶/保底逻辑，都必须新增一条记录，并同步：

1. 火烧云计算方法页面
2. 评分细则面板
3. 火烧云形成条件文字分析
4. 对应回归测试/样本回放

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
