# Korean i18n Quality Audit — Requirement 47.6

Date: 2026-05-03

Scope:
- `src/locales/ko-KR.js`
- Primary user paths represented in locale keys: home navigation, prediction/result cards, share/share-card copy, settings, favorites/history, errors, weather/map labels.

## Checks completed

- `ko-KR` key structure is locked to `zh-CN` by `tests/unit/i18n/primaryLocalesCompleteness.test.js`.
- Primary feature labels are Korean and do not fallback to English/Chinese on the checked paths:
  - `app.subtitle`: `화염구름이 나타나는 최적의 시간 예측`
  - `home.tabs.apiAccess`: `API 연동`
  - `home.tabs.shareMap`: `공유 지도`
  - `share.title`: `예보 공유`
  - `share.nativeShare`: `다른 공유 방법`
  - `settings.mapTileProvider`: `지도 배경`
- Fixed share-panel English fallback labels (`Share Prediction`, `Save Image`, `More Share`, etc.).

## Remaining follow-up

Long-copy mobile layout and real-page rendering still belong to 47.9 Playwright/screenshot validation. Static standalone pages are still tracked as conversion debt by 47.2/47.8.
