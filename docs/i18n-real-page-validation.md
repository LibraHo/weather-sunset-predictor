# i18n Real Page Validation — Requirement 47.9

Date: 2026-05-03

Real browser coverage is provided by Playwright tests, especially:

- `tests/e2e/primary-locale-layout.spec.js`
  - Runs `en-US`, `ja-JP`, `ko-KR`, `es-ES` on a mobile viewport.
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
- Local container execution is still blocked because Chromium cannot launch without system library `libnspr4.so`, and this container cannot install Debian packages.
- CI now installs Chromium system dependencies with `npx playwright install --with-deps chromium`.
- CI runs `npx playwright test tests/e2e/primary-locale-layout.spec.js --project=chromium` as the real-page acceptance gate.

## Deferred local/screenshot validation

CI now provides the browser gate, but local/screenshot validation remains deferred because this container cannot launch Chromium. Alex asked to leave this part marked for later and revisit it after returning to Beijing. The same command remains the manual reproduction command for any browser-capable host.
