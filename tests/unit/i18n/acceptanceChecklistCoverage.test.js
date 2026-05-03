import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(process.cwd());

const requiredEvidence = [
  'tests/unit/i18n/primaryLocalesCompleteness.test.js',
  'tests/unit/i18n/staticPagesAudit.test.js',
  'tests/unit/i18n/dynamicCopyAudit.test.js',
  'tests/unit/i18n/englishQuality.test.js',
  'tests/unit/i18n/japaneseQuality.test.js',
  'tests/unit/i18n/koreanQuality.test.js',
  'tests/unit/i18n/spanishQuality.test.js',
  'tests/e2e/primary-locale-layout.spec.js',
  'tests/unit/i18n/realPageValidationCoverage.test.js',
  'tests/unit/i18n/regressionSuiteCoverage.test.js'
];

describe('requirement 47 acceptance checklist coverage', () => {
  test('acceptance checklist maps each criterion to committed evidence', () => {
    const doc = fs.readFileSync(path.join(ROOT, 'docs/i18n-acceptance-checklist.md'), 'utf8');

    for (const evidence of requiredEvidence) {
      expect(fs.existsSync(path.join(ROOT, evidence))).toBe(true);
      expect(doc).toContain(evidence);
    }

    expect(doc).toContain('Translation key not found');
    expect(doc).toContain('Chinese residue');
    expect(doc).toContain('New user-visible copy');
    expect(doc).toContain('No tests found');
    expect(doc).toContain('libnspr4.so');
  });
});
