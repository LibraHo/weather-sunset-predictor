import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(process.cwd());

describe('requirement 47.9 real page validation coverage', () => {
  test('supported locale Playwright validation exists and is documented', () => {
    const specPath = path.join(ROOT, 'tests/e2e/primary-locale-layout.spec.js');
    const doc = fs.readFileSync(path.join(ROOT, 'docs/i18n-real-page-validation.md'), 'utf8');
    const spec = fs.readFileSync(specPath, 'utf8');

    expect(fs.existsSync(specPath)).toBe(true);
    for (const locale of ['zh-CN', 'zh-TW', 'en-US', 'ja-JP', 'ko-KR', 'es-ES', 'fr-FR', 'vi-VN', 'it-IT', 'ar-SA']) {
      expect(spec).toContain(`'${locale}'`);
      expect(doc).toContain(`\`${locale}\``);
    }
    expect(spec).toContain('expectNoHorizontalOverflow');
    expect(spec).toContain('collectClippedText');
    expect(spec).toContain('/api-apply.html?lang=${locale}');

    expect(doc).toContain('npx playwright test tests/e2e/primary-locale-layout.spec.js --project=chromium');
    expect(doc).toContain('every supported locale');
    expect(doc).toContain('CI runs `npx playwright test tests/e2e/primary-locale-layout.spec.js --project=chromium`');
    expect(doc).toContain('npx playwright install chromium');
  });
});
