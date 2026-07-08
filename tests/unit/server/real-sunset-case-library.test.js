import fs from 'fs';
import path from 'path';

const ROOT = path.resolve('.');
const CASE_DIR = path.join(ROOT, 'tests/fixtures/real-sunset-cases');
const EXPECTED_REAL_CASE_IDS = [
  '2026-05-10-summer-palace-sunset-open-path-golden-cloud-band',
  '2026-05-18-beijing-yuyuantan-sunset-rain-season-high-cloud-path',
  '2026-06-02-beijing-sunset-gray-mid-cloud-curtain',
  '2026-06-03-beijing-sunset-warm-scattering-path-open',
  '2026-06-04-beijing-sunset-solar-direction-mid-cloud-glow',
  '2026-06-05-beijing-sunset-gray-veil-full-upper-cloud',
  '2026-06-12-beijing-sunrise-success',
  '2026-06-13-beijing-sunset-rain-wet-veil-low-score',
  '2026-06-17-beijing-sunset-window-remote-high-carrier',
  '2026-07-07-beijing-sunset-wet-haze-open-path-mid-glow'
];

function readCases() {
  return fs.readdirSync(CASE_DIR)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => {
      const fullPath = path.join(CASE_DIR, file);
      return {
        file,
        ...JSON.parse(fs.readFileSync(fullPath, 'utf8'))
      };
    });
}

function getPath(target, dottedPath) {
  return dottedPath.split('.').reduce((value, key) => {
    if (value == null) return undefined;
    return value[key];
  }, target);
}

describe('real sunset feedback case library', () => {
  let EnhancedPredictionService;
  let realCases;

  beforeAll(async () => {
    EnhancedPredictionService = await import('../../../server/services/EnhancedPredictionService.js');
    realCases = readCases();
  });

  test.each(readCases())('$id replays within observed expectation', (realCase) => {
    const { input, event, location, expectations } = realCase;
    const result = EnhancedPredictionService.calculateEnhancedPrediction(
      input.weatherData,
      new Date(event.calculationTimeUtc),
      location.lat,
      location.lon,
      event.period,
      input.options || {}
    );

    expect(result.score).toBeGreaterThanOrEqual(expectations.score.min);
    expect(result.score).toBeLessThanOrEqual(expectations.score.max);

    if (expectations.statusAnyOf) {
      expect(expectations.statusAnyOf).toContain(result.status);
    }

    for (const expectation of expectations.contains || []) {
      const actual = getPath(result, expectation.path);
      expect(actual).toContain(expectation.value);
    }

    for (const expectation of expectations.equals || []) {
      const actual = getPath(result, expectation.path);
      expect(actual).toEqual(expectation.value);
    }

    for (const expectation of expectations.notAbove || []) {
      const actual = getPath(result, expectation.path);
      expect(actual).toBeLessThanOrEqual(expectation.value);
    }
  });

  test('each real case keeps enough metadata to explain future algorithm changes', () => {
    for (const realCase of realCases) {
      expect(realCase.id).toBeTruthy();
      expect(realCase.location.lat).toEqual(expect.any(Number));
      expect(realCase.location.lon).toEqual(expect.any(Number));
      expect(realCase.event.calculationTimeUtc).toBeTruthy();
      expect(realCase.feedback.summary).toBeTruthy();
      expect(realCase.feedback.subjectiveScore.min).toEqual(expect.any(Number));
      expect(realCase.feedback.subjectiveScore.max).toEqual(expect.any(Number));
      expect(realCase.capture.predictionReplay).toBe('enhanced_detail_calculateEnhancedPrediction');
      expect(realCase.input.weatherData).toEqual(expect.any(Object));
      const remoteSource = realCase.input.options?.remoteCloudData?.source || '';
      expect(remoteSource).not.toMatch(/gfs|cams|grid/i);
      expect(realCase.expectations.score.min).toEqual(expect.any(Number));
      expect(realCase.expectations.score.max).toEqual(expect.any(Number));
    }
  });

  test('replays the full historical calibration set', () => {
    expect(realCases.map((realCase) => realCase.id)).toEqual(EXPECTED_REAL_CASE_IDS);
  });

  test('Beijing rainy wet-veil sunset stays low under the base formula', () => {
    const beijingCase = realCases.find((realCase) => realCase.id === '2026-06-13-beijing-sunset-rain-wet-veil-low-score');
    expect(beijingCase).toBeTruthy();

    const result = EnhancedPredictionService.calculateEnhancedPrediction(
      beijingCase.input.weatherData,
      new Date(beijingCase.event.calculationTimeUtc),
      beijingCase.location.lat,
      beijingCase.location.lon,
      beijingCase.event.period,
      beijingCase.input.options || {}
    );

    expect(result.status).not.toBe('good_glow');
    expect(result.score).toBeLessThanOrEqual(25);
  });
});
