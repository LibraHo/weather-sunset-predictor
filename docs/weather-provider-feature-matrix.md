# 天气数据提供商功能支持矩阵

**版本**: 1.0
**日期**: 2026-03-05
**关联任务**: 任务 47.1

---

## 概述

本文档列出了三个主要天气数据提供商（Open-Meteo, Windy, 彩云）的功能支持差异，用于指导降级策略和字段映射。

---

## 功能支持对比表

| 功能 | Open-Meteo | Windy (免费版) | 彩云 | 需求关联 | 降级处理 |
|------|------------|----------------|------|----------|----------|
| **基础数据** |||||||
| 温度 (temp) | ✅ | ✅ | ✅ | 需求 3 | 无 |
| 湿度 (humidity) | ✅ | ✅ | ✅ | 需求 3 | 无 |
| 气压 (pressure) | ✅ | ✅ | ✅ | 需求 3 | 无 |
| 风速 (windSpeed) | ✅ | ✅ | ✅ | 需求 3 | 无 |
| 风向 (windDirection) | ✅ | ✅ | ✅ | 需求 3 | 无 |
| 云量 (cloudCover) | ✅ | ✅ | ✅ | 需求 3 | 无 |
| 能见度 (visibility) | ✅ | ✅ | ✅ | 需求 3 | 无 |
| 降水量 (precipitation) | ✅ | ✅ | ✅ | 需求 3 | 无 |
| **分层云量** |||||||
| 低云 (lowClouds) | ✅ | ✅ | ✅ | 需求 11 | 无 |
| 中云 (midClouds) | ✅ | ✅ | ✅ | 需求 11 | 无 |
| 高云 (highClouds) | ✅ | ✅ | ✅ | 需求 11 | 无 |
| **高级数据** |||||||
| CAPE (convective available potential energy) | ❌ | ✅ | ⚠️ | 需求 7 | 禁用子评分项 |
| 对流降水量 (convPrecip) | ❌ | ✅ | ⚠️ | 需求 7 | 禁用子评分项 |
| **服务特性** |||||||
| 无需 API Key | ✅ | ❌ | ❌ | 需求 31 | Primary 优先级 |
| 预测时长 (小时) | 168h | 168h | 168h | 需求 10 | 无 |
| 中国访问 | ✅ | ⚠️ | ✅ | 需求 31 | Windy 可能受限时降级 |
| 时序稳定性 | ✅ (标准) | ⚠️ (随机乱序) | ✅ (标准) | 需求 31 | Windy 数据质量差时降级 |

---

## 需求到字段映射

### 需求 3: 基础气象数据

**必需字段**（所有提供商支持）：
- `temp` - 温度 (°C)
- `humidity` - 相对湿度 (%)
- `cloudCover` - 总云量 (%)
- `windSpeed` - 风速 (m/s)
- `pressure` - 气压 (hPa)
- `visibility` - 能见度 (km)
- `precipitation` - 降水量 (mm)
- `windDirection` - 风向 (0-360°)

**降级处理**：无，所有提供商均支持

---

### 需求 5 & 7: 火烧云评分与 CAPE 数据

**必需字段**：
- `convPrecip` - 对流降水量 (mm)
- `cape` - CAPE (J/kg)

**支持情况**：
- ✅ Windy - 支持
- ❌ Open-Meteo - 不支持
- ⚠️ 彩云 - 文档未明确

**降级处理**：
```javascript
// 在评分算法中检查字段可用性
if (!weatherData.convPrecip || !weatherData.cape) {
  // 禁用 CAPE 相关的子评分项
  // 调整其他因子权重，保证总分不会异常偏低
  return calculateScoreWithoutCAPE(weatherData);
}
```

---

### 需求 11: 分层云量

**必需字段**：
- `lowClouds` - 低云量 (%)
- `midClouds` - 中云量 (%)
- `highClouds` - 高云量 (%)

**支持情况**：
- ✅ Open-Meteo - 支持（`cloud_cover_low`, `cloud_cover_mid`, `cloud_cover_high`）
- ✅ Windy - 支持
- ✅ 彩云 - 支持

**降级处理**：见任务 47.2（分层云量估算器）

---

### 需求 12: 日出日落时间

**API 字段映射**：
| 功能 | Open-Meteo | Windy | 彩云 |
|------|------------|-------|------|
| 日出时间 | `sunrise` | `sunrise` | `sunrise` |
| 日落时间 | `sunset` | `sunset` | `sunset` |
| 黄金时段 | 无原生支持 | 无原生支持 | 无原生支持 |

**降级处理**：
- 使用 `SunCalculator` 本地计算（独立于数据源）
- 不依赖 API 返回的字段

---

## 数据源选择策略

### Primary 数据源

**推荐**: Open-Meteo

**理由**：
1. **成本**: 完全免费，无调用限制
2. **数据质量**: 时序稳定，无乱序问题
3. **访问性**: 全球可用，中国可访问

**触发条件**: 优先使用

---

### Fallback 数据源 1: 彩云

**条件**：
- 彩云 API Key 已配置
- 商务条款已明确
- Open-Meteo 请求失败或数据质量差

**触发时机**：
1. API 请求超时 (> 10s)
2. API 返回错误 (4xx, 5xx)
3. 数据质量为 `poor`（`ForecastSequenceValidator` 标记）
4. 数据缺口 > 6 小时

**降级原因记录**：
```json
{
  "providerMeta": {
    "degradedReason": [
      "Primary Provider (openmeteo) failed: API timeout",
      "降级至 Fallback (彩云)"
    ]
  }
}
```

---

### Fallback 数据源 2: Windy

**条件**：
- 用户配置了 Windy API Key
- 彩云不可用或未配置

**触发时机**：
1. Open-Meteo 失败
2. 彩云失败或未启用

**降级原因记录**：
```json
{
  "providerMeta": {
    "degradedReason": [
      "Primary Provider (openmeteo) failed: API timeout",
      "Fallback 1 (彩云) failed: API key not configured",
      "降级至 Fallback 2 (windy)"
    ]
  }
}
```

---

## 评分算法调整策略

### CAPE 数据缺失时

**问题**：
- CAPE 用于评估大气不稳定性
- 缺失时可能导致总分异常偏低

**解决方案**：
```javascript
// 方案 1: 禁用 CAPE 子评分，调整权重
function calculateScoreWithoutCAPE(weatherData) {
  const weights = {
    cloudCover: 0.35,  // 增加云量权重
    humidity: 0.30,
    visibility: 0.25,
    windSpeed: 0.10   // 新增风速权重
  };
  
  return calculateWeightedScore(weatherData, weights);
}

// 方案 2: 使用保守估算值（不建议）
// CAPE 保守估算为 500 J/kg（中性不稳定）
function estimateCAPE(weatherData) {
  return 500;  // 固定中性值
}
```

---

### 分层云量缺失时（任务 47.2）

**问题**：
- 分层云量用于判断火烧云条件
- 仅 `cloudCover` 时无法区分低/中/高层云

**解决方案**：
- 实现 `CloudLayerEstimator`（见任务 47.2）
- 基于 `cloudCover` 和 `temp` 进行保守估算
- 标记 `cloudLayerEstimated: true`，降低置信度

---

## 实现检查清单

### 任务 47.1 完成
- [x] 功能支持矩阵文档已创建
- [x] 需求到字段映射已明确
- [x] 降级策略已定义
- [x] 评分算法调整策略已说明

### 文件更新
- [x] `docs/weather-provider-feature-matrix.md` - 功能矩阵文档
- [ ] `server/services/CloudLayerEstimator.js` - 分层云量估算器（任务 47.2）
- [ ] `server/services/EnhancedPredictionService.js` - 集成估算器（任务 47.2）

---

## 参考链接

- [Open-Meteo API 文档](https://open-meteo.com/en/docs)
- [Windy API 文档](https://www.windy.com/docs/api/)
- [彩云 API 文档](https://www.caiyunapp.com/)
- [任务 43: 数据质量门禁与序列校验](../../.kiro/specs/weather-sunset-predictor/tasks.md#任务-43数据质量门禁与序列校验)
- [任务 46: 迁移执行建议](../migration-advice.md)
