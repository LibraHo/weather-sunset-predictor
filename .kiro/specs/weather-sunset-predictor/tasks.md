# 任务清单

## 文档定位

本文件只维护当前待办、进行中事项和固定约束。已完成任务不长期堆在这里，完成后移动到 PR、changelog、docs 或 git history。

## 当前 P0

### T1 修复地图 raw score 泄漏

- 状态：待合并部署。
- 分支：`fix/map-grid-ignore-product-raw-score`
- PR：#815
- 目标：地图公开分数必须来自 `calculateMapSimplifiedPrediction()`，不能使用 GFS/CAMS 产品点自带 `score/firecloudScore`。
- 验收：
  - `GridProductScoreAdapter.test.js` 通过。
  - 火烧云 API / 小程序地图相关测试通过。
  - 生产 `/api/spots/china?period=sunset|sunrise` 不再出现原始分导致的整体 90+ 暴涨。

## 当前 P1

### T2 朝霞 v2 对齐审计与实现

- 明确朝霞是否复用 sunset `scoringV2` 的云载体、光路、空气显色逻辑。
- 若复用，补朝霞真实案例和回归测试。
- 若不复用，文档和 UI 需明确朝霞当前算法口径。

### T3 预测入口一致性

- 梳理主链路：`/api/prediction/home`、`/api/prediction/enhanced`、closed-loop batch。
- 梳理兼容链路：旧 GET、share、agent forecast/explain。
- 对兼容链路二选一：
  - 接入 `remoteCloudData` 方向采样。
  - 明确标记为 fast/legacy，避免和主分数混用。

### T4 地图区域时间口径

- 当前地图用北京参考点选择下一次 sunrise/sunset 产品时间。
- 评估中日韩范围内东西向时差对产品选择和评分的影响。
- 必要时改为区域分桶或按格点本地事件时间选择产品。

## 当前 P2

### T5 地图性能防回归

- 为 GFS/CAMS 全量格点添加性能 smoke。
- 覆盖约 9k 点或更大规模，不只测 2-3 个点。
- 验收重点：方向邻格查找不能退回 O(n²)。

### T6 小程序版本号流程固化

- 上传前查最近体验版/上传记录。
- 版本号必须唯一，且与 commit/PR 对上。
- 查不到历史时明确报告，不凭记忆编版本。

### T7 算法文案一致性

- Web 算法页、小程序算法页、预测分析、评分细则统一术语。
- 单点精细预测与地图区域趋势必须明确区分。
- 新增用户可见文案补 i18n。

## 固定约束

- 不直接 push main。
- 不在未授权情况下 merge 或 deploy。
- 合并部署必须有明确授权、可验证 commit、CI 状态和生产验证。
- 霞客项目部署后验证至少包括 `/health`、首页、主预测、地图和本次变更点。
- 算法变更必须跑相关测试；影响地图时必须验证公开地图 API。
- 不用城市/日期特殊规则硬调分；需要从通用气象判断和真实案例库校准。

## 推荐 PR 拆分

- P0 修复单独 PR，不混入文档或算法重构。
- 朝霞 v2 单独 PR。
- 入口一致性单独 PR。
- 地图时间口径单独 PR。
- `.kiro` 文档瘦身单独 PR。

## 常用验证命令

```bash
npm test -- tests/unit/server/EnhancedPredictionService.test.js tests/unit/server/real-sunset-case-library.test.js --runInBand
npm test -- tests/unit/server/GridProductScoreAdapter.test.js tests/integration/server/firecloud-api.integration.test.js --runInBand
npm test -- tests/unit/miniprogram/firecloud-map.test.js tests/unit/server/ChinaRasterService.test.js --runInBand
node --check server/services/EnhancedPredictionService.js
node --check server/services/GridProductScoreAdapter.js
git diff --check
```

## 维护规则

- 新任务只写目标、状态、验收。
- 完成任务从本文移除，不追加长篇完成记录。
- 当任务演变为稳定产品规则，移入 `requirements.md` 或 `design.md`。
