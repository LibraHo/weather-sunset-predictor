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

Current local container result:
- `npx playwright install chromium` completed.
- `npx playwright test tests/e2e/primary-locale-layout.spec.js --project=chromium` is blocked in this container because Chromium cannot launch: missing system library `libnspr4.so`.
- `npx playwright install-deps chromium` also failed because the container user cannot elevate to install Debian packages.

## Remaining notes

This PR preserves and documents the Playwright real-page validation harness, but 47.9 should only be marked fully complete after the command above runs in an environment with Chromium system dependencies installed (CI runner or a browser-capable host). Further visual screenshot approval can be added when static API/gallery/admin pages are fully locale-driven rather than documented conversion debt.
