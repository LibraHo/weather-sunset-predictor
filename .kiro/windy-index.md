# Windy 相关代码索引

> 状态：Windy 已降级为 **emergency fallback**（默认关闭），主力数据源为 Open-Meteo。
> 本索引用于追踪所有涉及 Windy 的文件，以便未来决定彻底移除时快速定位。

---

## 后端代码

| 文件 | 说明 | 状态 |
|------|------|------|
| `server/services/windyService.js` | 原始 Windy Point Forecast API 封装 | ⚠️ 仅 fallback 使用 |
| `server/services/providers/WindyProviderAdapter.js` | Provider 适配器，供 Orchestrator 调用 | ⚠️ 仅 fallback 使用 |
| `server/services/providers/BaseWeatherProvider.js` | 含 Windy 相关基类逻辑 | ⚠️ 部分涉及 |
| `server/services/ProviderOrchestrator.js` | 注册 Windy 为 fallbackProvider，`ENABLE_WINDY_EMERGENCY_FALLBACK=true` 才启用 | ⚠️ 默认关闭 |
| `server/services/validators/ForecastSequenceValidator.js` | 含 Windy 数据兼容逻辑 | ⚠️ 间接涉及 |
| `server/routes/weather.js` | 曾透传 X-Windy-API-Key 头（已移除透传，仅保留兼容注释） | ✅ 已清理 |
| `server/index.js` | 启动时读取 WINDY_API_KEY 环境变量 | ⚠️ 涉及 |

## 前端代码

| 文件 | 说明 | 状态 |
|------|------|------|
| `src/services/WindyAPIService.js` | 前端直接调用 Windy API 的封装（旧模式） | ⚠️ 可能已废弃 |
| `src/services/WindyMapService.js` | Leaflet + Windy Map Forecast 地图集成 | ⚠️ 待确认是否仍在使用 |
| `src/services/MockWindyAPIService.js` | 测试用 Mock | ⚠️ 随主服务处理 |
| `src/services/MockWindyMapService.js` | 测试用 Mock | ⚠️ 随主服务处理 |
| `src/services/FireCloudOverlayService.js` | 依赖 WindyMap 叠加图层 | ⚠️ 待确认 |
| `src/services/OpenMeteoAPIService.js` | 含对比 Windy 的引用 | ⚠️ 间接涉及 |
| `src/services/StorageService.js` | 存储 windyApiKeyMode 等配置 | ⚠️ 间接涉及 |
| `src/controllers/WeatherController.js` | 含 Windy provider 切换逻辑 | ⚠️ 间接涉及 |
| `src/controllers/AppController.js` | 含 Windy 初始化引用 | ⚠️ 间接涉及 |
| `src/components/SettingsPanel.js` | Windy API Key 配置 UI | ⚠️ 待确认是否仍显示 |
| `src/locales/*.js` | 所有语言包含 windy 相关文案 | ⚠️ 间接涉及（8个文件） |

## 测试文件

### 单元测试

| 文件 | 说明 | 建议 |
|------|------|------|
| `tests/unit/services/WindyMapService.test.js` | 地图服务单元测试 | 随 WindyMapService 决定 |
| `tests/unit/server/weatherRoute.noWindyKey.test.js` | 验证不透传 Windy Key | ✅ 逻辑仍有效，保留 |
| `tests/unit/server/ProviderOrchestrator.test.js` | 含 windy fallback 场景 | ✅ 逻辑仍有效，保留 |
| `tests/unit/services/StorageService.test.js` | 含 windyApiKeyMode 存储测试 | ⚠️ 如移除设置 UI 则更新 |
| `tests/unit/utils/UnitConverter.test.js` | 含 'windy' 字符串边界测试 | ✅ 无关紧要，保留 |
| `tests/unit/controllers/WeatherController.test.js` | 含 Windy provider 切换测试 | ⚠️ 待检查 |

### 集成测试

| 文件 | 说明 | 建议 |
|------|------|------|
| `tests/integration/server/weather-api.integration.test.js` | 含 Windy API 集成场景 | ⚠️ 需检查是否依赖 Windy 为主 |
| `tests/integration/server/provider-switch.integration.test.js` | 测试切换到 Windy provider | ⚠️ 需更新：Windy 非默认主源 |
| `tests/integration/controller-interaction.test.js` | 含 Windy provider 交互 | ⚠️ 需检查 |

### 质量/属性测试

| 文件 | 说明 | 建议 |
|------|------|------|
| `tests/quality/dualReadComparison.js` | 对比 Windy 与 Open-Meteo 数据质量 | ⚠️ 参考用途，可保留 |
| `tests/quality/tasks4546Test.js` | 断言 fallbackProvider === 'windy' | ✅ 仍正确，保留 |
| `tests/property/api-service.property.test.js` | 含 Windy API 属性测试 | ⚠️ 需检查 |

---

## 环境变量

| 变量名 | 说明 |
|--------|------|
| `WINDY_API_KEY` | 系统默认 Windy API 密钥 |
| `ENABLE_WINDY_EMERGENCY_FALLBACK` | 设为 `true` 才启用 Windy fallback（默认关闭） |
| `FALLBACK_WEATHER_PROVIDER` | 默认值 `windy`，可覆盖为其他 provider |

---

## 当前决策

**保留 Windy 作为 emergency fallback，不移除。** 测试暂不动，仅 `provider-switch.integration.test.js` 需要更新以反映 Windy 非默认主源的现状（见 tasks.md W2）。
