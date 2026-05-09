# i18n Real Page Validation — Requirement 47.9

Date: 2026-05-03

Real browser coverage is provided by Playwright tests, especially:

- `tests/e2e/primary-locale-layout.spec.js`
  - Runs every supported locale on a mobile viewport: `zh-CN`, `zh-TW`, `en-US`, `ja-JP`, `ko-KR`, `es-ES`, `fr-FR`, `vi-VN`, `it-IT`, `ar-SA`.
  - Opens home/menu, methodology, and API access/application page paths.
  - Checks no horizontal overflow.
  - Checks visible text nodes/buttons/labels/cards are not clipped.
- `tests/e2e/home-navigation.spec.js`
  - Verifies the home menu, API access entry, and API page navigation.
- `tests/e2e/prediction-flow.spec.js` and `tests/e2e/weather-query-flow.spec.js`
  - Cover primary query/prediction user flows.

Validation command for real browser acceptance:

```bash
npx playwright test tests/e2e/primary-locale-layout.spec.js --project=chromium
```

Current validation path:
- CI installs Chromium system dependencies with `npx playwright install --with-deps chromium`.
- CI runs `npx playwright test tests/e2e/primary-locale-layout.spec.js --project=chromium` as the real-page acceptance gate.
- Local validation can use the same command after installing the Playwright Chromium browser with `npx playwright install chromium`.

## Local validation note

When the local Playwright browser cache is missing, run `npx playwright install chromium` first, then rerun the validation command above.
