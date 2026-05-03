# Requirement 46.1 — Prediction Card Current-State Audit

Date: 2026-05-03

Scope: locate the current sunrise/sunset prediction cards, formation-condition analysis, cloud radar/compass rendering, CSS surfaces, and boundaries that later 46.x PRs must not break.

## Rendering entry points

| Surface | File / function | Notes |
| --- | --- | --- |
| Sunrise/sunset card composition | `src/controllers/PredictionController.js` → `renderSinglePrediction()` | Builds each `.prediction-card.prediction-app-card` with title, score/time summary, cloud summary, analysis card, and radar placeholder. |
| View-model assembly | `PredictionController.buildForecastViewModel()` | Pulls target timezone, main sunrise/sunset time, best viewing window, azimuth direction, score/quality, cloud layers, and analysis groups. |
| Dual-period render orchestration | `PredictionController.renderPredictionResults()` | Calls `renderSinglePrediction()` separately for sunrise and sunset cards. |
| Radar rerender after query/language change | `src/controllers/AppController.js` | Calls `weatherController.renderRadarCompass(location, 'sunrise')` and `'sunset'` after prediction rendering and language changes. |

## Current card hierarchy

Current DOM hierarchy emitted by `renderSinglePrediction()`:

1. `.phenomenon-title-card`
   - Date tag (`.phenomenon-date-tag`)
   - Type title (`朝霞/晚霞` or localized equivalent)
2. `.score-summary-card`
   - Left: large score gauge + clickable score breakdown popover (`renderScoreBreakdownPopover()`)
   - Right: sunrise/sunset time, best viewing window, optional direction/azimuth row
3. `.cloud-condition-card`
   - Three rows: high/mid/low cloud percentage and mini bar
4. `.analysis-card.app-analysis-card`
   - Grouped analysis sections: favorable / neutral / watch-outs
   - Conclusion banner at bottom
5. `#radar-compass-${type}`
   - Hidden placeholder until `WeatherController.renderRadarCompass()` populates it

## Formation-condition analysis

| Concern | Current implementation |
| --- | --- |
| Data extraction | `PredictionController.extractAnalysisWeather()` reads `cloudLayers`, factor values, breakdown high/mid/low cloud scores, visibility, humidity, and AOD. |
| Analysis grouping | `PredictionController.buildAnalysisGroups()` creates three groups: positive, neutral, warning. |
| Conclusion | `PredictionController.buildAnalysisConclusion()` derives a short conclusion from score and cloud layer count. |
| Rendering | `PredictionController.renderAnalysisCard()`, `renderAnalysisGroup()`, `renderAnalysisItem()`. |
| Current limitation | Content is grouped by condition category, not by explicit metric grid. Later 46.4 should move toward conclusion → metrics grid → 2–3 short explanations. |

## Cloud summary and radar/compass

| Surface | Current implementation | Must-not-break boundary |
| --- | --- | --- |
| Cloud layer summary | `PredictionController.renderCloudConditionCard()` | Preserve high/mid/low values and percentage formatting; no horizontal overflow on mobile. |
| Radar placeholder | `renderSinglePrediction()` emits `#radar-compass-sunrise` / `#radar-compass-sunset` | Keep IDs stable so `WeatherController.renderRadarCompass()` can find containers. |
| Radar fetch/render | `WeatherController.renderRadarCompass()` | Do not hide/remove radar on failure; it should show loading/error text and keep the container visible. |
| Radar component | `src/components/RadarCompass.js` | Treat as out of scope for card refactor unless explicitly required. |

## CSS surfaces

Primary card/layout CSS is in `styles/main.css`:

- `.prediction-app-card`, `.prediction-app-shell`
- `.phenomenon-title-card`, `.phenomenon-icon-tile`, `.phenomenon-date-tag`
- `.score-summary-card`, `.score-gauge-*`, `.score-breakdown-*`
- `.app-info-row`, `.app-main-time`
- `.cloud-condition-card`, `.cloud-condition-*`
- `.app-analysis-card`, `.analysis-group-*`, `.analysis-item-*`, `.conclusion-banner`
- `#radar-compass-*` styling via radar component/container rules

Existing CSS note: the file already has a `需求46 修正：只压缩 layout，不改色彩系统` section. Later visual PRs should preserve this constraint.

## Tests already covering these boundaries

- `tests/unit/controllers/PredictionController.test.js`
  - renders `app-analysis-card`, analysis groups, conclusion banner
  - renders cloud-condition card with high/mid/low values
  - keeps `radar-compass-sunset` placeholder present
  - verifies score breakdown popover interaction
- Existing weather/radar tests should be reused for `WeatherController.renderRadarCompass()` boundaries when layout changes touch the radar placeholder.

## 46.x implementation boundaries

1. Keep `#radar-compass-sunrise` and `#radar-compass-sunset` IDs stable.
2. Keep score breakdown trigger clickable and popover DOM available.
3. Use existing target-location IANA timezone formatting via `formatTime(..., targetTimezone)`; do not introduce countdown copy for sunrise/sunset.
4. Preserve the dark glass / sunset orange-gold / blue-purple sky token system; do not replace with an unrelated pink-purple palette.
5. Prefer DOM-level tests for card hierarchy and radar placeholder; use screenshot/Playwright only when browser dependencies are available.
