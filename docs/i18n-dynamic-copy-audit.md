# i18n Dynamic Copy Audit — Requirement 47.3

Date: 2026-05-03

Scope:
- `src/controllers/**/*.js`
- `src/components/**/*.js`
- `src/services/**/*.js`
- `src/utils/**/*.js`

## Findings

| Area | Representative files | Current state | Decision / follow-up |
| --- | --- | --- | --- |
| Controllers | `FavoriteController.js`, `PredictionController.js`, `WeatherController.js`, `AppController.js` | Many user-facing strings already call `i18n.t(...)`, but several toast/status/fallback strings still contain direct zh-CN or `_uiText` fallback pairs. | Convert by feature path in 47.4–47.8; keep this audit as the inventory gate. |
| Components | `SettingsPanel.js`, `RadarCompass.js`, `ChinaMapCanvas.js`, `LanguageSelector.js` | Settings and radar/map labels still include dynamic zh-CN fallback strings or bilingual inline label maps. | Move settings/radar/map labels into locale keys before screenshot validation. |
| Services | `ShareCardGenerator.js`, `ChinaSpotsOverlay*.js`, `Mock*Service.js`, `GeocodingService.js`, `ToastService.js` | Share card mostly uses `this.t(...)`, but map overlays, mock/debug services, geocoding errors, toast close labels, and debug labels still contain direct zh-CN. | Prioritize user-visible share card, map overlay, geocoding/toast copy; mock/debug-only strings may remain documented if not user-facing. |
| Utilities | `LocationName.js` | Chinese municipality aliases are structured location data, not standalone UI copy; all other regions use the same generic locality/region compaction path. | Keep the alias data tracked here and cover global address formats in unit tests. |
| Utils | `ErrorHandler.js`, `GlobalErrorBoundary.js`, `UnitConverter.js`, `mainlandChinaRegion.js` | Error handling has user-facing zh-CN messages; several utils are comments/constants only. | Convert error pages/messages to i18n; comments/constants are non-blocking unless surfaced. |

## Guardrail

`tests/unit/i18n/dynamicCopyAudit.test.js` records the current set of source files that contain CJK in dynamic-code areas. It fails if a new controller/component/service/util file gains CJK without being added to this audit first. This is an audit gate, not the final translation conversion.

## Current CJK Source Inventory

- `src/components/ChinaMapCanvas.js`
- `src/components/LanguageSelector.js`
- `src/components/RadarCompass.js`
- `src/components/SettingsPanel.js`
- `src/controllers/AppController.js`
- `src/controllers/ChartRenderController.js`
- `src/controllers/FavoriteController.js`
- `src/controllers/PredictionController.js`
- `src/controllers/WeatherController.js`
- `src/services/BackendGeocodingService.js`
- `src/services/ChinaRasterOverlay.js`
- `src/services/ChinaRasterOverlayManager.js`
- `src/services/ChinaSpotsOverlay.js`
- `src/services/ChinaSpotsOverlayManager.js`
- `src/services/ConfigService.js`
- `src/services/EnhancedSunsetPredictionService.js`
- `src/services/FireCloudOverlayService.js`
- `src/services/GeocodingService.js`
- `src/services/GeocodingServiceFactory.js`
- `src/services/HeatmapLayer.js`
- `src/services/MockGeocodingService.js`
- `src/services/MockWindyAPIService.js`
- `src/services/MockWindyMapService.js`
- `src/services/NativeFireCloudRenderer.js`
- `src/services/NotificationService.js`
- `src/services/PredictionAPIService.js`
- `src/services/RadarChartService.js`
- `src/services/ShareCardGenerator.js`
- `src/services/StorageService.js`
- `src/services/SunsetPredictionService.js`
- `src/services/SurroundingPointsService.js`
- `src/services/ThemeService.js`
- `src/services/ToastService.js`
- `src/utils/LocationName.js`
- `src/services/WindyAPIService.js`
- `src/services/WindyMapService.js`
- `src/utils/ErrorHandler.js`
- `src/utils/GlobalErrorBoundary.js`
