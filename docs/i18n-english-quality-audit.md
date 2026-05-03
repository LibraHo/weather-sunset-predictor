# English i18n Quality Audit — Requirement 47.4

Date: 2026-05-03

Scope:
- `src/locales/en-US.js`
- Primary user paths represented in locale keys: home navigation, methodology, prediction/result cards, share/share-card copy, settings, favorites/history, errors, weather/map labels.

## Checks completed

- `en-US` key structure is already locked to `zh-CN` by `tests/unit/i18n/primaryLocalesCompleteness.test.js`.
- `en-US` values contain no CJK characters, so English does not visibly fall back to Chinese locale copy.
- Primary feature labels are human-readable English:
  - `home.tabs.apiAccess`: `API Access`
  - `home.tabs.shareMap`: `Share Map`
  - `prediction.canvas.aerosol`: `Aerosol`
  - `share.nativeShare`: `More sharing options`
  - `settings.mapTileProvider`: `Map Basemap`
- Code/API terms use consistent English casing for API, OpenAPI, Token, Bearer, JSON, curl-style examples where represented in locale or docs.

## Remaining follow-up

Standalone static pages such as `public/api-apply.html` are still zh-CN static HTML and are tracked by 47.2/47.8 as conversion debt. This 47.4 audit guarantees the current English locale itself does not fallback to Chinese and keeps important feature-path copy natural.
