# 任务 41.3 最终选型评审

## 结论
- **主数据源：Open-Meteo**
- **备数据源：Windy（emergency fallback）**
- **彩云：Phase 2（deferred）**，待 key 与商务条款明确后接入

## 主要风险
1. Open-Meteo 上游短时不稳定
2. 特定字段（cape/convPrecip）在不同 provider 可用性差异
3. 地图层与预测层耦合导致回滚复杂

## 已落地缓解
- ProviderOrchestrator + 质量门禁 + fallbackReason
- 子评分开关（cape/convPrecip）
- 地图能力独立验证（见任务 47.4）

## 回滚条件
- 5xx 持续超阈值
- dataQuality 显著下降
- 关键路径查询不可用

触发后按任务 45.4 预案执行配置级回滚。
