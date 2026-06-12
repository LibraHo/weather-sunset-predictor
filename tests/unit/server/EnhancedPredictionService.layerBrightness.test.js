describe('EnhancedPredictionService layer brightness integration', () => {
  let service;

  beforeAll(async () => {
    service = await import('../../../server/services/EnhancedPredictionService.js');
  });

  test('exposes layer brightness and caps dim high-cloud false positives', () => {
    const result = service.calculateEnhancedPrediction(
      {
        cloudCover: 76.6,
        humidity: 48.6,
        visibility: 20,
        lowCloudCover: 0,
        temp: 27.34,
        windSpeed: 3.6,
        windDirection: 160,
        pressure: 999.31,
        precipitation: 0.1,
        recentPrecipitation6h: 0.9,
        recentRainHours: 6,
        lowClouds: 0,
        midClouds: 23.9,
        highClouds: 77.5,
        shortwaveRadiation: 35.3,
        directRadiation: 4.66,
        diffuseRadiation: 30.64,
        waterVapourColumn: 36.57,
        aerosolOpticalDepth: 0.442,
        dust: 15.9,
        pm2_5: 47.58,
        pm10: 55.71,
        aqi: 120.5
      },
      new Date('2026-06-12T11:42:00.000Z'),
      39.9042,
      116.4074,
      'sunset',
      {
        remoteCloudData: {
          source: 'test',
          samples: [
            { distanceKm: 10, lowCloud: 0, midCloud: 24, highCloud: 95, totalCloud: 95, precipitation: 0 },
            { distanceKm: 25, lowCloud: 0, midCloud: 25, highCloud: 92, totalCloud: 92, precipitation: 0 },
            { distanceKm: 50, lowCloud: 5, midCloud: 32, highCloud: 90, totalCloud: 90, precipitation: 0 },
            { distanceKm: 75, lowCloud: 3, midCloud: 30, highCloud: 88, totalCloud: 88, precipitation: 0 },
            { distanceKm: 100, lowCloud: 4, midCloud: 28, highCloud: 86, totalCloud: 86, precipitation: 0 }
          ]
        }
      }
    );

    expect(result.layerBrightness).toEqual(expect.objectContaining({
      applied: true,
      cap: 52
    }));
    expect(result.layerBrightnessAdjustment).toEqual(expect.objectContaining({
      applied: true,
      score: 52
    }));
    expect(result.score).toBeLessThanOrEqual(52);
    expect(result.breakdown.layerBrightness).toBe(result.layerBrightness);
  });
});
