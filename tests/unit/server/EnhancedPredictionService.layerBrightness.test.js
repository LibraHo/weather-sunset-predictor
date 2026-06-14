describe('EnhancedPredictionService layer brightness integration', () => {
  let service;

  beforeAll(async () => {
    service = await import('../../../server/services/EnhancedPredictionService.js');
  });

  test('exposes layer brightness and lets air rendering suppress dim high-cloud false positives', () => {
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
      cap: null
    }));
    expect(result.layerBrightness.brightnessMultiplier).toBeGreaterThan(0);
    expect(result.layerBrightness.brightnessMultiplier).toBe(1);
    expect(result.breakdown.airTransmissionFactor).toBeLessThan(0.75);
    expect(result.breakdown.renderingFactor).toBeLessThan(0.7);
    expect(result.layerBrightnessAdjustment).toEqual(expect.objectContaining({
      applied: true,
      multiplier: result.layerBrightness.brightnessMultiplier
    }));
    expect(result.layerBrightness.formula).toBe('sum_layer_carrier_brightness');
    expect(result.breakdown.layerContributionFormula).toBe('sum_layer_carrier_brightness');
    expect(result.layerBrightness.layerContributions.length).toBeGreaterThan(0);
    expect(result.breakdown.weightedCarrierScore).toBe(result.breakdown.baseScore);
    expect(result.breakdown.baseScore).toBeCloseTo(
      result.layerBrightness.layerContributions.reduce((sum, item) => sum + item.score, 0),
      1
    );
    const expectedScore = result.breakdown.baseScore * result.breakdown.renderingFactor;
    expect(result.score).toBeCloseTo(expectedScore, 1);
    expect(result.breakdown.layerBrightness).toBe(result.layerBrightness);
  });
});
