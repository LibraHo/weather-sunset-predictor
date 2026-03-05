# 天气数据源迁移建议

**版本**: 1.0
**日期**: 2026-03-05
**关联任务**: 任务 46

---

## 迁移策略建议

### 推荐架构

**Open-Meteo 为主 + 彩云为备**

- **主数据源**: Open-Meteo (免费、无需 API Key、全球覆盖)
- **备选数据源**: 彩云（仅当彩云 API Key 已配置且商务条款明确时启用）
- **地图能力**: 保留 Windy 地图图层，但不再作为预测数据源

### 理由

1. **成本考虑**
   - Open-Meteo 完全免费，无调用限制
   - Windy 免费版 API 存在数据质量问题（预测时序随机打乱）
   - 彩云需要 API Key，但作为备选数据源可降低总体成本

2. **数据质量**
   - Open-Meteo 提供标准化、有序的预测数据
   - Windy 免费版 API 的时序问题已通过 `ForecastSequenceValidator` 校验
   - 彩云作为国内服务商，对中国区域可能更精准

3. **合规性**
   - Windy 作为国外服务商，中国访问可能受限
   - 彩云为中国本土服务，符合数据本地化要求
   - Open-Meteo 为国际服务，但无需用户配置 API Key

---

## 实施建议

### Phase 1: Open-Meteo 单源上线

- **目标**: 将 Open-Meteo 作为默认主数据源
- **实施**: 已完成（任务 42-45）
- **验证**: 运行 `tests/quality/dualReadComparison.js` 对比数据一致性

### Phase 2: 彩云兜底集成

- **前提条件**:
  - 彩云 API Key 已获取
  - 商务条款已确认（费用、配额、合规）
- **实施步骤**:
  1. 实现 `CaiYunProviderAdapter` (参考 `OpenMeteoProvider`)
  2. 在 `ProviderOrchestrator` 中添加彩云为 Fallback
  3. 更新 `ProviderOrchestrator` 降级逻辑：Open-Meteo → 彩云 → Windy（最终兜底）
  4. 测试彩云降级路径（模拟 Open-Meteo 故障）

### Phase 3: Windy 降级为纯地图能力

- **目标**: Windy 仅用于地图展示，不参与预测计算
- **实施步骤**:
  1. 从 `ProviderOrchestrator` 中移除 Windy 作为数据源
  2. 保留 Windy 地图组件 (`WindyMapService`)
  3. 确保前端地图图层可正常加载 Windy 瓦片
  4. 更新文档：说明 Windy 现为地图图层服务，非数据源

---

## 功能支持差异分析

### Open-Meteo vs Windy vs 彩云

| 功能 | Open-Meteo | Windy (免费版) | 彩云 |
|------|------------|----------------|------|
| **无需 API Key** | ✅ | ❌ | ❌ |
| **预测时长** | 7 天 (168h) | 7 天 (168h) | 7 天 (168h) |
| **数据质量** | 优秀 (无乱序) | 一般 (有时序问题) | 优秀 (国内优化) |
| **中国访问** | ✅ (通过代理) | ⚠️ (可能受限) | ✅ |
| **云层分层** | ✅ (low/mid/high) | ✅ (low/mid/high) | ✅ (low/mid/high) |
| **能见度** | ✅ | ✅ | ✅ |
| **降级字段** | `convPrecip`, `cape` | - | - |
| **地图图层** | ❌ (需第三方) | ✅ | ❌ (需第三方) |

### 降级策略

**降级路径**:
```
Open-Meteo (Primary)
    ↓ (失败/数据质量差)
彩云 (Fallback 1)
    ↓ (失败/未配置)
Windy (Fallback 2 - 仅地图)
```

**降级触发条件**:
1. API 超时 (> 10s)
2. API 返回错误 (4xx, 5xx)
3. 数据质量降级（`ForecastSequenceValidator` 标记为 `poor`）
4. 数据缺口 > 6 小时

---

## 兼容性说明

### 旧 API 兼容

- **后端**: `/api/weather/forecast` 接口保持不变，`providerMeta` 新增字段不影响现有调用
- **前端**: `WindyAPIService.js` 已适配 `providerMeta`，无需修改业务逻辑
- **地图**: Windy 地图图层保留，用户界面无感知变化

### 配置变更

- **新增**: `PRIMARY_WEATHER_PROVIDER` (环境变量，默认 `openmeteo`)
- **新增**: `FALLBACK_WEATHER_PROVIDER` (环境变量，默认 `windy`)
- **弃用**: `WINDY_API_KEY` (环境变量，2026-06-01 后移除)

---

## 下一步行动

1. **彩云集成** (任务 47.1, 47.2)
   - 确认彩云 API Key 和商务条款
   - 实现 `CaiYunProviderAdapter`
   - 建立需求到字段映射清单 (`docs/weather-provider-feature-matrix.md`)

2. **Windy 降级** (Phase 12 - 任务 51-54)
   - 从预测数据源中移除 Windy
   - 保留地图能力
   - 更新文档和用户提示

3. **监控与优化**
   - 定期运行 `dualReadComparison.js` 对比数据一致性
   - 收集 `providerMeta` 中的降级原因统计
   - 根据数据质量动态调整 Primary/Fallback 配置
