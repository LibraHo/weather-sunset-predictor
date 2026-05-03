# Spanish i18n Quality Audit — Requirement 47.7

Date: 2026-05-03

Scope:
- `src/locales/es-ES.js`
- Primary user paths represented in locale keys: home navigation, prediction/result cards, share/share-card copy, settings, favorites/history, errors, weather/map labels.

## Checks completed

- `es-ES` key structure is locked to `zh-CN` by `tests/unit/i18n/primaryLocalesCompleteness.test.js`.
- Primary feature labels are Spanish and do not fallback to English/Chinese on the checked paths:
  - `app.subtitle`: `Predecir el mejor momento para nubes rojas`
  - `home.tabs.apiAccess`: `Acceso API`
  - `home.tabs.shareMap`: `Mapa compartido`
  - `share.title`: `Compartir predicción`
  - `share.nativeShare`: `Más opciones para compartir`
  - `settings.mapTileProvider`: `Mapa base`
- Fixed share-panel English fallback labels (`Share Prediction`, `Save Image`, `More Share`, etc.).

## Remaining follow-up

Long-copy mobile layout and real-page rendering still belong to 47.9 Playwright/screenshot validation. Static standalone pages are still tracked as conversion debt by 47.2/47.8.
