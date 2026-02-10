# 测试修复任务分解 (83 failures across 11 suites)

> 5 个任务完全独立，零依赖，可并行分配给不同 agent。
> 每个 agent 只需关注自己的任务范围，修完后运行对应验证命令确认通过。
> 修复完成后在 `claude/check-project-status-JjOdZ` 分支上提交并 push。

---

## Task 1: 后端服务 CommonJS import 问题 (36 failures)

**失败测试文件:**
- `tests/unit/server/prediction-performance.test.js` — 11 failed / 11 total
- `tests/unit/server/SurroundingService.test.js` — 25 failed / 25 total

**根因:** 测试用 `(await import(...)).default` 导入 CommonJS 模块 (`module.exports = X`)，ESM dynamic import 下 `.default` 拿到 `undefined`，导致所有测试因构造类失败。

**修复方向:** 把测试中的 `.default` 改为直接取模块对象，或者改服务端 export 方式。推荐改测试：
```js
// 改前
SurroundingService = (await import('../../../server/services/SurroundingService.js')).default;
// 改后（二选一）
const mod = await import('../../../server/services/SurroundingService.js');
SurroundingService = mod.default || mod;
// 或者
SurroundingService = (await import('../../../server/services/SurroundingService.js'));
// 取决于 module.exports 的方式
```

**涉及源码（只读参考，一般不需改）:** `server/services/SurroundingService.js`, `server/services/PredictionService.js`, `server/services/EnhancedPredictionService.js`, `server/services/CacheService.js`

**验证命令:**
```bash
node --experimental-vm-modules node_modules/.bin/jest --no-coverage tests/unit/server/prediction-performance.test.js tests/unit/server/SurroundingService.test.js
```

---

## Task 2: prediction.route 测试修复 (24 failures)

**失败测试文件:**
- `tests/unit/server/prediction.route.test.js` — 24 failed / 24 total

**根因:** CommonJS/ESM import 问题 + 路由处理逻辑测试与当前 `EnhancedPredictionService` 实现不匹配。

**修复方向:**
1. 修复 import 方式（同 Task 1）
2. 对比 `server/routes/prediction.js` 和 `server/services/EnhancedPredictionService.js` 的当前 API，更新测试断言

**涉及源码:** `server/routes/prediction.js`, `server/services/EnhancedPredictionService.js`

**验证命令:**
```bash
node --experimental-vm-modules node_modules/.bin/jest --no-coverage tests/unit/server/prediction.route.test.js
```

---

## Task 3: 前端 Property-based 测试修复 (19 failures)

**失败测试文件:**
- `tests/property/api-service.property.test.js` — 8 failed / 8 total
- `tests/property/models.property.test.js` — 6 failed / 12 total
- `tests/property/rendering.property.test.js` — 1 failed / 13 total
- `tests/property/storage.property.test.js` — 3 failed / 7 total
- `tests/property/error-handling.property.test.js` — 1 failed / 16 total

**根因:** 测试断言与当前源码实现不一致：
- `api-service`: `WindyAPIService` 接口/行为变更后测试未更新
- `models`: `Location` 坐标校验边界 + `SunsetPrediction` quality 分级阈值变了
- `rendering`: 颜色映射边界值不匹配
- `storage`: `StorageService` 缓存 API 变更
- `error-handling`: `ErrorHandler` 上下文保留逻辑

**修复方向:** 逐个读源码确认当前行为，更新测试断言以匹配实现。不要改源码，只改测试。

**涉及源码（只读参考）:** `src/services/WindyAPIService.js`, `src/models/Location.js`, `src/models/SunsetPrediction.js`, `src/services/StorageService.js`, `src/utils/ErrorHandler.js`

**验证命令:**
```bash
node --experimental-vm-modules node_modules/.bin/jest --no-coverage tests/property/api-service.property.test.js tests/property/models.property.test.js tests/property/rendering.property.test.js tests/property/storage.property.test.js tests/property/error-handling.property.test.js
```

---

## Task 4: controller.property.test.js 修复 (4 failures)

**失败测试文件:**
- `tests/property/controller.property.test.js` — 4 failed / 8 total (注意：运行耗时 ~355s)

**失败测试名:**
- `generates predictions for exactly 5 days`
- `predictions are in chronological order`
- `prediction dates are unique for each day`
- `quality classification matches score ranges`

**根因:** `SunsetPredictionService` + `PredictionController` 预测逻辑与测试断言不匹配：
- 多天预测数量不是固定 5 天
- 时间排序/日期唯一性断言与实现冲突
- quality 分级 (`excellent`/`good`/`fair`) 阈值与 score 不匹配（score=0 仍返回 `excellent`）

**修复方向:** 读 `src/services/SunsetPredictionService.js` 和 `src/controllers/PredictionController.js` 确认：
1. 多天预测实际产出几天？
2. quality 分级的真实阈值是什么？
3. 同 timestamp 的数据点如何处理？
然后更新测试断言。

**涉及源码（只读参考）:** `src/services/SunsetPredictionService.js`, `src/controllers/PredictionController.js`

**验证命令:**
```bash
node --experimental-vm-modules node_modules/.bin/jest --no-coverage tests/property/controller.property.test.js
```

---

## Task 5: WindyAPIService 单元测试 + controller-interaction 集成测试 (2 suites crash)

**失败测试文件:**
- `tests/unit/services/WindyAPIService.test.js` — 0 tests (crash)
- `tests/integration/controller-interaction.test.js` — crash, 无法统计

**根因:**
- `WindyAPIService.test.js`: 第18行 `global.fetch = jest.fn()` 报 `ReferenceError: jest is not defined`。缺少 `import { jest } from '@jest/globals'`。
- `controller-interaction.test.js`: mock 对象缺少 `getCachedWeatherData` 方法；`PredictionController.generatePredictions` 抛 `Error: 天气数据为空` 未被测试捕获。

**修复方向:**
1. `WindyAPIService.test.js`: 在文件头部添加 `import { jest } from '@jest/globals';`，然后逐一修复后续断言
2. `controller-interaction.test.js`: 补全 mock 的 `storageService`（添加 `getCachedWeatherData` 等方法），给 `generatePredictions` 调用提供有效天气数据

**涉及源码（只读参考）:** `src/services/WindyAPIService.js`, `src/controllers/AppController.js`, `src/controllers/WeatherController.js`, `src/controllers/PredictionController.js`, `src/services/StorageService.js`

**验证命令:**
```bash
node --experimental-vm-modules node_modules/.bin/jest --no-coverage tests/unit/services/WindyAPIService.test.js tests/integration/controller-interaction.test.js
```

---

## 汇总

| Task | 失败数 | 测试文件数 | 改动范围 | 难度 |
|------|--------|-----------|----------|------|
| 1 | 36 | 2 | 改测试 import | 低 |
| 2 | 24 | 1 | import + 断言对齐 | 中 |
| 3 | 19 | 5 | property 断言对齐 | 中 |
| 4 | 4 | 1 | 预测逻辑断言 | 中 |
| 5 | 2 suite crash | 2 | jest import + mock 补全 | 低 |
| **总计** | **83** | **11** | | |

## 全量验证命令

所有任务完成后运行：
```bash
npm test
```

期望结果：28 suites 全部 PASS，600 tests 全部通过。
