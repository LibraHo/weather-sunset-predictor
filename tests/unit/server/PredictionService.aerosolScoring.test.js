import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const PredictionService = require('../../../server/services/PredictionService.js');

const baseWeather = {
  highClouds: 50,
  midClouds: 35,
  lowClouds: 10,
  visibility: 20,
  humidity: 55,
  precipitation: 0
};

describe('PredictionService aerosol scattering scoring', () => {
  let service;

  beforeEach(() => {
    service = new PredictionService();
  });

  test('missing aerosol data keeps existing score unchanged with factor 1', () => {
    const result = service.calculateScore(baseWeather);
    expect(result.breakdown.aerosolScattering.factor).toBe(1);
    expect(result.breakdown.aerosolScattering.level).toBe('unknown');
  });

  test('moderate AOD boosts scattering potential slightly', () => {
    const baseline = service.calculateScore(baseWeather);
    const result = service.calculateScore({ ...baseWeather, aerosolOpticalDepth: 0.22, pm2_5: 12, pm10: 24, dust: 2 });

    expect(result.breakdown.aerosolScattering.level).toBe('optimal');
    expect(result.breakdown.aerosolScattering.factor).toBeGreaterThan(1);
    expect(result.score).toBeGreaterThan(baseline.score);
  });

  test('high AOD plus poor visibility penalizes haze risk and forbids boost', () => {
    const result = service.calculateScore({
      ...baseWeather,
      visibility: 5,
      aerosolOpticalDepth: 0.8,
      pm2_5: 90,
      pm10: 180,
      dust: 120
    });

    expect(result.breakdown.aerosolScattering.factor).toBeLessThanOrEqual(0.85);
    expect(result.breakdown.aerosolScattering.level).toBe('low_visibility_haze');
    expect(result.breakdown.aerosolScattering.score).toBeLessThan(0);
  });
});
