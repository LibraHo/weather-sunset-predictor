import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(process.cwd());

describe('requirement 47.9 real page validation coverage', () => {
  test('primary locale Playwright validation exists and is documented', () => {
    const specPath = path.join(ROOT, 'tests/e2e/primary-locale-layout.spec.js');
    const doc = fs.readFileSync(path.join(ROOT, 'docs/i18n-real-page-validation.md'), 'utf8');
    const spec = fs.readFileSync(specPath, 'utf8');

    expect(fs.existsSync(specPath)).toBe(true);
    expect(spec).toContain("'en-US'");
    expect(spec).toContain("'ja-JP'");
    expect(spec).toContain("'ko-KR'");
    expect(spec).toContain("'es-ES'");
    expect(spec).toContain('expectNoHorizontalOverflow');
    expect(spec).toContain('collectClippedText');
    expect(spec).toContain('/api-apply.html?lang=${locale}');

    expect(doc).toContain('npx playwright test tests/e2e/primary-locale-layout.spec.js --project=chromium');
    expect(doc).toContain('missing system library `libnspr4.so`');
    expect(doc).toContain('47.9 should only be marked fully complete after the command above runs');
  });
});
