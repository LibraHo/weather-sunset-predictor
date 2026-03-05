# 天气数据字段迁移清单（Windy → Open‑Meteo）

> 对应任务：49.1 / 49.2

## 1) Windy 字段与用途

| Windy 字段 | 用途 | Open‑Meteo 对应 | 状态 |
|---|---|---|---|
| `temp` | 温度展示、体感推导、评分输入 | `temperature_2m` | ✅ 直映射 |
| `rh` | 湿度展示、能见度估算辅助 | `relative_humidity_2m` | ✅ 直映射 |
| `wind` | 风速展示、评分输入 | `wind_speed_10m` | ✅ 直映射 |
| `pressure` | 气压展示、趋势判断 | `surface_pressure` | ✅ 直映射 |
| `lclouds` | 低云评分输入 | `cloud_cover_low` | ✅ 直映射 |
| `mclouds` | 中云评分输入 | `cloud_cover_mid` | ✅ 直映射 |
| `hclouds` | 高云评分输入 | `cloud_cover_high` | ✅ 直映射 |
| `convPrecip` | 对流降水子评分 | `precipitation`（近似） | ⚠️ 语义不完全一致 |
| `cape` | 不稳定能量子评分 | 无官方小时级直出字段 | ❌ 暂不可用 |

## 2) 迁移策略

- 第一阶段采用 **Open‑Meteo 单源**，将 `cape` 与 `convPrecip` 子评分能力做开关化。
- 当开关关闭或字段不可用时，响应 `providerMeta.degradedReason` 写入原因，保证总分可解释。
- `convPrecip` 默认关闭（避免将普通降水等价为对流降水）；`cape` 默认关闭（缺失原始字段）。

## 3) 开关约定（后端）

- `ENABLE_CAPE_SCORE`：默认 `false`
- `ENABLE_CONVECTIVE_PRECIP_SCORE`：默认 `false`

当任一开关为关闭态时，`providerMeta` 附加：

- `unsupportedFields`：增加对应字段
- `degradedReason`：增加 `cape scoring disabled by feature flag` / `convPrecip scoring disabled by feature flag`
