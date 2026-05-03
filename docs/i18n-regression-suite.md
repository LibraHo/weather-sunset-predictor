# i18n Regression Suite — Requirement 47.8

Date: 2026-05-03

This suite documents and guards the automated i18n coverage that now protects the primary languages (`en-US`, `ja-JP`, `ko-KR`, `es-ES`).

## Required guards

| Requirement area | Test file |
| --- | --- |
| Key completeness / key drift | `tests/unit/i18n/primaryLocalesCompleteness.test.js` |
| Static pages with visible CJK are audited | `tests/unit/i18n/staticPagesAudit.test.js` |
| Dynamic source CJK inventory is audited | `tests/unit/i18n/dynamicCopyAudit.test.js` |
| Main/index hardcoded Chinese guard | `tests/unit/i18n-hardcoded-zh.test.js` |
| Home menu i18n guard | `tests/unit/i18n/noHardcodedHomeMenuChinese.test.js` |
| English quality / no Chinese fallback | `tests/unit/i18n/englishQuality.test.js` |
| Japanese quality / fallback residue guard | `tests/unit/i18n/japaneseQuality.test.js` |
| Korean quality / fallback residue guard | `tests/unit/i18n/koreanQuality.test.js` |
| Spanish quality / fallback residue guard | `tests/unit/i18n/spanishQuality.test.js` |
| Share card dynamic copy uses provided i18n | `tests/unit/services/ShareCardGenerator.test.js` |

## Notes

- Static standalone page conversion and browser screenshots remain in 47.9.
- This requirement is the automated safety net: new key drift, new unaudited CJK static/dynamic surfaces, and known fallback residue patterns should fail tests before merge.
