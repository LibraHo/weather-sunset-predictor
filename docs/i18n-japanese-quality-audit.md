# Japanese i18n Quality Audit — Requirement 47.5

Date: 2026-05-03

Scope:
- `src/locales/ja-JP.js`
- Primary user paths represented in locale keys: home navigation, prediction/result cards, share/share-card copy, settings, favorites/history, errors, weather/map labels.

## Checks completed

- `ja-JP` key structure is locked to `zh-CN` by `tests/unit/i18n/primaryLocalesCompleteness.test.js`.
- Primary feature labels are Japanese and do not fallback to English/Chinese on the checked paths:
  - `app.subtitle`: `夕焼け雲のベストタイミングを予測`
  - `home.tabs.apiAccess`: `API接続`
  - `home.tabs.shareMap`: `共有マップ`
  - `share.title`: `予測を共有`
  - `share.nativeShare`: `その他の共有方法`
  - `settings.mapTileProvider`: `地図ベースマップ`
- Fixed obvious mixed-language/Chinese residue:
  - `焼き雲の最佳タイミングを予測` → `夕焼け雲のベストタイミングを予測`
  - Share panel labels no longer use English fallback (`Share Prediction`, `Save Image`, `More Share`, etc.).

## Remaining follow-up

Long-copy mobile layout and real-page rendering still belong to 47.9 Playwright/screenshot validation. Static standalone pages are still tracked as conversion debt by 47.2/47.8.
