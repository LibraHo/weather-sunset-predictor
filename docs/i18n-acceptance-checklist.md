# i18n Acceptance Checklist — Requirement 47

Date: 2026-05-03

This checklist maps the Requirement 47 acceptance criteria to committed automated guards and the one remaining browser-environment blocker.

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| `en-US/ja-JP/ko-KR/es-ES` and `zh-CN` user-visible key structures are consistent; no `Translation key not found`. | Covered | `tests/unit/i18n/primaryLocalesCompleteness.test.js` |
| Core pages do not show Chinese residue in the four primary languages, except allowed city/place/brand data. | Covered by automated audits and locale-quality guards | `tests/unit/i18n/staticPagesAudit.test.js`, `tests/unit/i18n/dynamicCopyAudit.test.js`, `tests/unit/i18n/englishQuality.test.js`, `tests/unit/i18n/japaneseQuality.test.js`, `tests/unit/i18n/koreanQuality.test.js`, `tests/unit/i18n/spanishQuality.test.js` |
| New user-visible copy must be synchronized across four languages; PRs missing any primary language are incomplete. | Covered by key completeness guard | `tests/unit/i18n/primaryLocalesCompleteness.test.js` |
| Mobile English/Japanese/Korean/Spanish long copy should not overflow or block primary actions. | Harness exists; browser execution blocked locally | `tests/e2e/primary-locale-layout.spec.js`, `tests/unit/i18n/realPageValidationCoverage.test.js`, `docs/i18n-real-page-validation.md` |
| Automated tests must actually run; `No tests found` is not accepted. | Covered | `tests/unit/i18n/regressionSuiteCoverage.test.js` requires all i18n guard files to exist; validation commands run concrete files. |

## Current blocker

The Playwright real-page validation command is documented and guarded, but cannot complete in this local container because Chromium system dependencies are unavailable (`libnspr4.so` missing) and the container cannot install Debian packages. Run the documented command on CI or a browser-capable host before marking 47.9 and the mobile-layout acceptance item fully complete:

```bash
npx playwright test tests/e2e/primary-locale-layout.spec.js --project=chromium
```
