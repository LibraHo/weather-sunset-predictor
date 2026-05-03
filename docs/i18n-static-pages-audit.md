# i18n Static Pages Audit — Requirement 47.2

Date: 2026-05-03

Scope:
- `index.html`
- `public/api-apply.html`
- `public/admin/index.html`
- `public/gallery.html`
- `public/raster-debug.html`

## Findings

| Page | User-facing surface | Current i18n state | Decision / reason |
| --- | --- | --- | --- |
| `index.html` | Main product entry | Mostly uses `data-i18n`; some legacy Chinese fallback remains for initial render / map labels / allowed brand text | Keep guarded by `tests/unit/i18n-hardcoded-zh.test.js`; future new visible text must use `data-i18n` or locale keys. |
| `public/api-apply.html` | API access / API application docs | Standalone zh-CN static page with user-facing Chinese copy | Needs follow-up conversion to locale-driven text in 47.4–47.8. Until converted, this page is explicitly tracked as known debt so new unreviewed static pages cannot sneak in. |
| `public/admin/index.html` | Admin console shell | zh-CN admin surface protected by admin auth | Allowed temporarily as operator/admin UI; if public-facing admin docs or self-service admin UI are expanded, convert to locale keys first. |
| `public/gallery.html` | Share map standalone page | Minimal zh-CN UI around map sharing | Needs follow-up conversion or reuse of main locale runtime before 47.9 screenshot validation. |
| `public/raster-debug.html` | Internal raster debug tool | Developer/debug surface, not primary user path | Allowed as internal/debug page; if exposed in navigation later, it must be converted to i18n first. |

## Guardrail

`tests/unit/i18n/staticPagesAudit.test.js` enforces that every static HTML page containing CJK user-visible text is represented in this audit with a decision. This does not complete all translation work; it prevents silent expansion of unaudited static-page Chinese while 47.4–47.9 continue.
