import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(process.cwd());

const REQUIRED_TESTS = [
  'tests/unit/i18n/primaryLocalesCompleteness.test.js',
  'tests/unit/i18n/staticPagesAudit.test.js',
  'tests/unit/i18n/dynamicCopyAudit.test.js',
  'tests/unit/i18n-hardcoded-zh.test.js',
  'tests/unit/i18n/noHardcodedHomeMenuChinese.test.js',
  'tests/unit/i18n/englishQuality.test.js',
  'tests/unit/i18n/japaneseQuality.test.js',
  'tests/unit/i18n/koreanQuality.test.js',
  'tests/unit/i18n/spanishQuality.test.js',
  'tests/unit/services/ShareCardGenerator.test.js'
];

describe('requirement 47.8 i18n regression suite coverage', () => {
  test('required i18n regression guards exist and are documented', () => {
    const doc = fs.readFileSync(path.join(ROOT, 'docs/i18n-regression-suite.md'), 'utf8');

    for (const rel of REQUIRED_TESTS) {
      expect(fs.existsSync(path.join(ROOT, rel))).toBe(true);
      expect(doc).toContain(rel);
    }
  });

  test('share card generator keeps dynamic-copy i18n coverage', () => {
    const source = fs.readFileSync(path.join(ROOT, 'tests/unit/services/ShareCardGenerator.test.js'), 'utf8');
    expect(source).toContain('uses provided i18n translations for share card text');
    expect(source).toContain('Good conditions translated');
    expect(source).toContain('Fire Cloud Forecast Share');
  });
});
