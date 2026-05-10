# 火烧云算法版本记录

本文件记录线上评分算法的可追溯版本。后续每次修改 `EnhancedPredictionService`、光路、画布、渲染、封顶/保底逻辑，都必须新增一条记录，并同步：

1. 火烧云计算方法页面
2. 评分细则面板
3. 火烧云形成条件文字分析
4. 对应回归测试/样本回放

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
