import fs from 'fs';
import path from 'path';

const ROOT = path.resolve('.');
const CASE_DIR = path.join(ROOT, 'tests/fixtures/real-sunset-cases');

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

  beforeAll(async () => {
    EnhancedPredictionService = await import('../../../server/services/EnhancedPredictionService.js');
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
    for (const realCase of readCases()) {
      expect(realCase.id).toBeTruthy();
      expect(realCase.location.lat).toEqual(expect.any(Number));
      expect(realCase.location.lon).toEqual(expect.any(Number));
      expect(realCase.event.calculationTimeUtc).toBeTruthy();
      expect(realCase.feedback.summary).toBeTruthy();
      expect(realCase.feedback.subjectiveScore.min).toEqual(expect.any(Number));
      expect(realCase.feedback.subjectiveScore.max).toEqual(expect.any(Number));
      expect(realCase.input.weatherData).toEqual(expect.any(Object));
      expect(realCase.expectations.score.min).toEqual(expect.any(Number));
      expect(realCase.expectations.score.max).toEqual(expect.any(Number));
    }
  });
});
