# 任务 47.1 完成：需求到字段映射清单

**完成时间**: 2026-03-05
**Git 分支**: `feat/task47-provider-feature-matrix`

---

## 完成内容

### 1. 功能支持矩阵 (`docs/weather-provider-feature-matrix.md`)

创建了完整的功能对比文档，包括：

**功能支持对比表**：
- 基础数据（温度、湿度、气压、风速等）
- 分层云量（低/中/高云）
- 高级数据（CAPE, convPrecip）
- 服务特性（API Key、预测时长、中国访问、时序稳定性）

**需求到字段映射**：
- 需求 3: 基础气象数据 - 所有提供商支持
- 需求 5 & 7: 火烧云评分与 CAPE - Windy 支持，Open-Meteo/彩云缺失
- 需求 11: 分层云量 - 所有提供商支持
- 需求 12: 日出日落时间 - 使用 `SunCalculator` 本地计算

**降级策略定义**：
- Primary 数据源: Open-Meteo（免费、稳定）
- Fallback 1: 彩云（需 API Key、商务条款明确）
- Fallback 2: Windy（需用户 API Key）
- 降级触发条件: 超时、错误、数据质量差、缺口大

**评分算法调整策略**：
- CAPE 数据缺失时的两种处理方案
  - 方案 1: 禁用 CAPE 子评分，调整权重
  - 方案 2: 使用保守估算值（不建议）
- 分层云量缺失时: 使用 `CloudLayerEstimator`（任务 47.2）

### 2. 关键发现

**必需字段（所有提供商支持）**：
- `temp`, `humidity`, `cloudCover`, `windSpeed`, `pressure`, `visibility`, `precipitation`, `windDirection`
- `lowClouds`, `midClouds`, `highClouds`

**可降级字段（部分提供商缺失）**：
- `convPrecip` - 仅 Windy 支持
- `cape` - 仅 Windy 支持
- **降级处理**: 禁用相关子评分项，调整权重

---

## 实现检查清单

### 任务 47.1
- [x] 功能支持矩阵文档已创建
- [x] 需求到字段映射已明确
- [x] 降级策略已定义
- [x] 评分算法调整策略已说明

### 待完成任务（47.2）
- [ ] 实现 `CloudLayerEstimator` - 分层云量估算器
- [ ] 集成到 `EnhancedPredictionService`
- [ ] 标记 `cloudLayerEstimated: true`

---

## 下一步

继续执行任务 47.2: 实现彩云分层云量估算器。
