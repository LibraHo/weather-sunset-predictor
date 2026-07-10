import { jest } from '@jest/globals';

jest.unstable_mockModule('@/i18n.js', () => ({
  default: {
    t: jest.fn((key, params = {}) => {
      if (key === 'prediction.canvas.space') return '太空（无云）';
      if (key === 'prediction.canvas.overcast') return '阴天';
      if (params.value !== undefined) return `${key}:${params.value}`;
      return key;
    })
  }
}));

const { default: EnhancedSunsetPredictionService } = await import('@services/EnhancedSunsetPredictionService.js');

describe('EnhancedSunsetPredictionService coverage', () => {
  let service;

  beforeEach(() => {
    service = new EnhancedSunsetPredictionService();
    service.i18n = {
      t: jest.fn((key, params = {}) => {
        if (key === 'prediction.canvas.space') return '太空（无云）';
        if (key === 'prediction.canvas.overcast') return '阴天';
        if (params.value !== undefined) return `${key}:${params.value}`;
        return key;
      })
    };
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('constructor exposes expected model weights and solar window constants', () => {
    expect(service.SOLAR_ELEVATION_WINDOW).toMatchObject({
      SUNRISE_START: -6,
      SUNRISE_END: 5,
      SUNSET_START: -5,
      SUNSET_END: 6
    });
    expect(service.FINAL_WEIGHTS.CLOUD_CANVAS + service.FINAL_WEIGHTS.LIGHT_PATH).toBeCloseTo(1);
    expect(service.CLOUD_WEIGHTS.HIGH).toBeGreaterThan(service.CLOUD_WEIGHTS.LOW);
  });

  test('solar helpers return stable sunrise/sunset-oriented values', () => {
    const summerSunset = new Date('2026-06-21T11:00:00Z');
    const winterSunset = new Date('2026-12-21T09:00:00Z');

    expect(service.calculateSolarElevation(summerSunset, 39.9, 116.4)).toBeCloseTo(-0.83);
    expect(service.calculateSolarAzimuth(summerSunset, 39.9, 116.4)).toBeGreaterThanOrEqual(0);
    expect(service.calculateSolarAzimuth(summerSunset, 39.9, 116.4)).toBeLessThan(360);
    expect(service.calculateSolarAzimuth(winterSunset, 39.9, 116.4)).not.toBe(
      service.calculateSolarAzimuth(summerSunset, 39.9, 116.4)
    );
  });

  test('checkTimeWindow covers sunrise and sunset detection windows', () => {
    const date = new Date('2026-06-21T11:00:00Z');

    expect(service.checkTimeWindow(date, 39.9, 116.4, 'sunset')).toMatchObject({
      inWindow: true,
      isInDetectionWindow: true,
      optimalMoment: '烧中云爆发时刻（日落时分）'
    });
    expect(service.checkTimeWindow(date, 39.9, 116.4, 'sunrise')).toMatchObject({
      inWindow: true,
      optimalMoment: '朝霞中云爆发时刻（日出时分）'
    });
  });

  test('scoreCloudCanvas covers clear, ideal high-cloud, low-cloud penalty, and over-effective-cloud branches', () => {
    const clear = service.scoreCloudCanvas({ lowClouds: 0, midClouds: 0, highClouds: 0 });
    expect(clear.score).toBe(10);

    const ideal = service.scoreCloudCanvas({ lowClouds: 10, midClouds: 40, highClouds: 70 });
    expect(ideal.score).toBeGreaterThan(80);
    expect(ideal.lowCloudPenalty).toBe('1.00');

    const blocked = service.scoreCloudCanvas({ lowClouds: 90, midClouds: 50, highClouds: 20 });
    expect(Number(blocked.lowCloudPenalty)).toBeCloseTo(0.5);
    expect(blocked.score).toBeLessThan(ideal.score);

    const over = service.scoreCloudCanvas({ lowClouds: 0, midClouds: 120, highClouds: 120 });
    expect(over.score).toBe(0);
  });

  test('scoreLightPath uses remote data, caps bad weather, and falls back on remote errors', async () => {
    const remote = jest.fn()
      .mockResolvedValueOnce({ totalCloud: 5 })
      .mockResolvedValueOnce({ totalCloud: 90 });

    const result = await service.scoreLightPath({ cloudCover: 10 }, 270, remote);
    expect(remote).toHaveBeenCalledTimes(2);
    expect(result.nearPointScore).toBe('100.0');
    expect(result.farPointScore).toBe('0.0');
    expect(result.score).toBe(40);

    await expect(service.scoreLightPath({ cloudCover: 90 }, 270, null)).resolves.toMatchObject({
      score: 40,
      capReason: 'overcast_cap_40'
    });
    await expect(service.scoreLightPath({ precipitation: 1 }, 270, null)).resolves.toMatchObject({
      score: 50,
      capReason: 'precipitation_cap_50'
    });

    const failingRemote = jest.fn().mockRejectedValue(new Error('remote down'));
    const fallback = await service.scoreLightPath({ cloudCover: 0 }, 270, failingRemote);
    expect(fallback.score).toBe(100);
    expect(console.warn).toHaveBeenCalledWith('[EnhancedService] 无法获取远程云量数据，使用近似值');
  });

  test('_calculateLightPathScore covers clear, blocked, and interpolated cloud paths', () => {
    expect(service._calculateLightPathScore({ totalCloud: 0 })).toBe(100);
    expect(service._calculateLightPathScore({ totalCloud: 90 })).toBe(0);
    expect(service._calculateLightPathScore({ totalCloud: 45 })).toBeCloseTo(50);
    expect(service._calculateLightPathScore({})).toBe(100);
  });

  test('scoreRendering covers visibility, humidity, rain bonus, and pollution branches', () => {
    const excellent = service.scoreRendering({ visibility: 25, humidity: 20, aqi: 30 }, true);
    expect(excellent.visibilityFactor).toBe('1.10');
    expect(excellent.rainBonus).toBe('1.20');
    expect(excellent.factor).toBeCloseTo(1.32);
    expect(excellent.breakdown).toHaveProperty('specialMode');

    const poor = service.scoreRendering({ visibility: 5, humidity: 95, aqi: 180 }, true);
    expect(poor.visibilityFactor).toBe('0.85');
    expect(poor.humidityFactor).toBe('0.90');
    expect(poor.rainBonus).toBe('0.96');
    expect(poor.factor).toBeCloseTo(0.7344);
  });

  test('calculateFinalScore covers status thresholds and sunrise text replacement', () => {
    const render = { factor: 1 };
    const noCloud = service.calculateFinalScore(
      { score: 10, cloudLevel: '太空（无云）' },
      { score: 100 },
      render
    );
    expect(noCloud.icon).toBe('🌫️');
    expect(noCloud).toHaveProperty('description');

    const blocked = service.calculateFinalScore(
      { score: 60, cloudLevel: 'prediction.canvas.perfect' },
      { score: 20 },
      render
    );
    expect(blocked.score).toBeLessThan(40);
    expect(blocked.icon).toBe('🌫️');

    const legendarySunrise = service.calculateFinalScore(
      { score: 100, cloudLevel: 'prediction.canvas.perfect' },
      { score: 100 },
      { factor: 1.2 },
      'sunrise'
    );
    expect(legendarySunrise.score).toBe(100);
    expect(legendarySunrise.icon).toBe('🔥');
    expect(legendarySunrise.breakdown.baseScore).toBe('100.0');
  });

  test('calculateEnhancedPrediction integrates the full pipeline and quality labels', async () => {
    const remote = jest.fn()
      .mockResolvedValueOnce({ totalCloud: 20 })
      .mockResolvedValueOnce({ totalCloud: 30 });

    const prediction = await service.calculateEnhancedPrediction(
      { lowClouds: 5, midClouds: 50, highClouds: 80, visibility: 30, humidity: 40, aqi: 60 },
      new Date('2026-06-21T11:00:00Z'),
      39.9,
      116.4,
      'sunset',
      remote
    );

    expect(prediction.type).toBe('sunset');
    expect(prediction.score).toBeGreaterThan(80);
    expect(prediction.quality).toBe('excellent');
    expect(prediction.timeAnalysis.isInDetectionWindow).toBe(true);
    expect(prediction.canvasAnalysis.score).toBeGreaterThan(80);
    expect(prediction.lightPathAnalysis.score).toBeGreaterThan(70);
  });

  test('_getQualityLevel and private date helpers cover boundaries', () => {
    expect(service._getQualityLevel(85)).toBe('excellent');
    expect(service._getQualityLevel(80)).toBe('good');
    expect(service._getQualityLevel(50)).toBe('fair');
    expect(service._getQualityLevel(39)).toBe('poor');
    expect(service._getJulianDay(new Date('2026-01-01T00:00:00Z'))).toBeGreaterThan(2400000);
    expect(service._getHourAngle(new Date('2026-01-01T12:30:00Z'), 116)).toBeCloseTo(123.5);
  });
});
