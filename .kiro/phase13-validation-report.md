# Phase 13 验收报告

**日期：** 2026-03-12  
**任务：** 58.2 / 58.3 / 59.3

---

## 测试通过情况

### 单元测试 `tests/unit/server/LightPathV2Service.test.js`

| 测试用例 | 状态 |
|---|---|
| 太阳高度角为负时，应返回低分 | ✅ PASS |
| 晴天低云少时，应返回高分 | ✅ PASS |
| cloudCover=90 应触发 overcast_cap_40 | ✅ PASS |
| precipitation=1 应触发 precipitation_cap_50 | ✅ PASS |
| 云底高度缺失时不应崩溃 | ✅ PASS |
| Val Thorens 坏样本（原有）：score <= 10 | ✅ PASS |
| 输出结构应包含所有必要字段 | ✅ PASS |
| **[坏样本回放] Val Thorens 雨夹雪：score <= 10** | ✅ PASS |
| **[坏样本回放] 北京阴天：score <= 40** | ✅ PASS |

**总计：9/9 通过**

### 集成测试 `tests/integration/server/lightpath-v2.integration.test.js`

| 测试用例 | 状态 |
|---|---|
| lightPathAnalysis 包含必要字段（score/occlusionProbability/samples/capReason/explain） | ✅ PASS |
| samples 每项包含 distanceKm/cloudBaseHeight/criticalElevation/block | ✅ PASS |
| cloudCover=100 时 score <= 40，capReason 不为 null | ✅ PASS |
| cloudCover=0 时 score >= 60（晴天高分） | ✅ PASS |
| score 范围在 0-100 之间 | ✅ PASS |

**总计：5/5 通过**

---

## 坏样本验证结果

### Val Thorens 雨夹雪场景

**输入：**
```
solarElevation: 5, solarAzimuth: 250
lowClouds: 96, midClouds: 72, highClouds: 0
cloudCover: 100, precipitation: 2, convPrecip: 0
weatherCode: 85 (阵雪), cloudBaseHeight: 830m
```

**输出：**
- `score: 10`（满足 <= 10）
- `capReason: 'overcast_cap_40'`
- `occlusionProbability: 0.0766`

**触发路径：** `isFullOvercast (cloudCover=100)` AND `isHeavyPrecip (precipitation=2 >= 1 && weatherCode=85 ∈ HEAVY_PRECIP_CODES)` → `severe_cap_10`

### 北京阴天场景

**输入：**
```
solarElevation: 10, solarAzimuth: 260
lowClouds: 0, midClouds: 0, highClouds: 100
cloudCover: 100, precipitation: 0, weatherCode: 3
cloudBaseHeight: null
```

**输出：**
- `score: 40`（满足 <= 40）
- `capReason: 'overcast_cap_40'`

**触发路径：** `isOvercast (cloudCover=100 >= 85)` → `overcast_cap_40`（上限 40）

---

## 当前算法参数

### 采样点配置

```js
SAMPLE_DISTANCES_KM = [20, 50, 100]  // 3个采样点（近、中、远）
```

### 云层权重（layerWeight）

采样点遮挡计算综合考虑低中高云层，权重由 `computeSampleBlock` 函数动态决定：
- 低云（lowClouds）：主要影响近距采样点
- 中云（midClouds）：影响中距采样点
- 高云（highClouds）：参与所有采样点

### 封顶阈值

| 条件 | 封顶值 | capReason |
|---|---|---|
| `cloudCover=100` 或 `lowClouds >= 90` + 重度降水（precipitation >= 1 或 HEAVY_PRECIP_CODES） | 10 | `overcast_cap_40` |
| `isOvercast` + 任意降水 | 40 | `overcast_cap_40` |
| 仅 `isOvercast`（云量 >= 85%） | 40 | `overcast_cap_40` |
| 仅降水（无 overcast） | 50 | `precipitation_cap_50` |

**Overcast 判定：** `cloudCover >= 85 || lowClouds >= 85 || midClouds >= 85 || highClouds >= 85`  
**Heavy Precip Codes：** `{65, 75, 77, 82, 85, 86, 95, 96, 99}`

---

## 已知限制

1. **采样点固定**：仅采样 20/50/100 km 三点，无法精准表达局地云况变化，对山区复杂地形建模能力有限。

2. **occlusionProbability 偏低**：当云底高度高于临界仰角时，block 值接近 0，导致 occlusionProbability 很低（如 Val Thorens 场景仅 7.66%），依赖封顶机制而非物理建模来纠正最终评分。

3. **API 响应字段名不一致**：`/api/prediction/enhanced` 返回 `lightPathAnalysis`（而非 `lightPath`），集成测试已相应适配，但如需对外规范 API 应考虑字段重命名或别名。

4. **severe_cap_10 触发条件严格**：需要 `cloudCover=100` 或 `lowClouds >= 90` + 重度降水，部分接近临界的强降水场景（如 `cloudCover=95, precipitation=0.8`）仍只触发 `overcast_cap_40`（上限 40）。

5. **无远端气象站数据**：当前 V2 算法仅使用本地天气数据进行光路评分，当有远端云量数据时回退旧算法（`hasRemoteData=false`）。
