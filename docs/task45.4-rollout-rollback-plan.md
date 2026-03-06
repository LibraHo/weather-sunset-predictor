# 任务 45.4 灰度与回滚预案

## 灰度发布策略

1. **10% 流量**（30-60 分钟）
   - 主链路：Open-Meteo
   - 监控：`providerMeta.dataQuality`、5xx 比例、平均响应时延
   - 放量条件：错误率与基线持平，无异常告警

2. **50% 流量**（2-4 小时）
   - 继续观察 `usedFallback` 占比与 `fallbackReason`
   - 放量条件：`provider=openmeteo` 占比 > 99%，无持续超时

3. **100% 流量**
   - 开启全量
   - 保持 emergency fallback 开关默认关闭，仅故障时人工打开

## 回滚策略

### 快速回滚（配置级）
- 开启 `ENABLE_WINDY_EMERGENCY_FALLBACK=true`
- 确保 `FALLBACK_WEATHER_PROVIDER=windy`
- 如主链路持续故障，可临时切主：`PRIMARY_WEATHER_PROVIDER=windy`

### 回滚触发条件
- 5xx 错误率连续 5 分钟高于阈值
- 关键 API p95 延迟持续高于阈值
- `dataQuality=degraded` 异常激增

### 回滚后验证
- `/api/weather/forecast` 返回 200
- `providerMeta` 字段完整（name/dataQuality/degradedReason）
- 关键页面可正常查询与渲染
