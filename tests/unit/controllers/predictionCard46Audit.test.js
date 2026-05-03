import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(process.cwd());

const requiredSurfaces = [
  'renderSinglePrediction()',
  'buildForecastViewModel()',
  'renderCloudConditionCard()',
  'buildAnalysisGroups()',
  'renderAnalysisCard()',
  'WeatherController.renderRadarCompass()',
  '#radar-compass-sunrise',
  '#radar-compass-sunset',
  'styles/main.css',
  'tests/unit/controllers/PredictionController.test.js'
];

describe('requirement 46.1 prediction card audit coverage', () => {
  test('audit records rendering surfaces and must-not-break boundaries', () => {
    const doc = fs.readFileSync(path.join(ROOT, 'docs/prediction-card-46-audit.md'), 'utf8');

    for (const surface of requiredSurfaces) {
      expect(doc).toContain(surface);
    }

    expect(doc).toContain('score breakdown');
    expect(doc).toContain('IANA timezone');
    expect(doc).toContain('Do not hide/remove radar on failure');
    expect(doc).toContain('dark glass / sunset orange-gold / blue-purple sky token system');
  });
});
