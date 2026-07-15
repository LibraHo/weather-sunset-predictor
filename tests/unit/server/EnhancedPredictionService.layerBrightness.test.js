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
    expect(result.breakdown.renderingFactor).toBeLessThanOrEqual(0.72);
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

  test('Beijing open-path high-cloud sunset is not double-penalized by air rendering and transmission', () => {
    const result = service.calculateEnhancedPrediction(
      {
        cloudCover: 96.767,
        humidity: 43.6,
        visibility: 20,
        lowCloudCover: 0,
        temp: 25.35,
        windSpeed: 1.946,
        windDirection: 159,
        pressure: 1002.877,
        precipitation: 0,
        recentPrecipitation6h: 0,
        recentRainHours: 0,
        recentRainSignal: 0,
        lowClouds: 0,
        midClouds: 0,
        highClouds: 100,
        shortwaveRadiation: 43.933,
        directRadiation: 9.12,
        diffuseRadiation: 34.813,
        waterVapourColumn: 23.08,
        aerosolOpticalDepth: 0.298,
        dust: 55.933,
        pm2_5: 53.777,
        pm10: 85.353,
        aqi: 152
      },
      new Date('2026-06-21T11:46:00.000Z'),
      39.9042,
      116.4074,
      'sunset',
      {
        remoteCloudData: {
          source: 'calibration',
          samples: [
            { distanceKm: 10, lowCloud: 0, midCloud: 0, highCloud: 98, totalCloud: 96, precipitation: 0 },
            { distanceKm: 25, lowCloud: 0, midCloud: 0, highCloud: 98, totalCloud: 96, precipitation: 0 },
            { distanceKm: 50, lowCloud: 0, midCloud: 0, highCloud: 97, totalCloud: 95, precipitation: 0 },
            { distanceKm: 75, lowCloud: 0, midCloud: 0, highCloud: 96, totalCloud: 94, precipitation: 0 },
            { distanceKm: 100, lowCloud: 0, midCloud: 0, highCloud: 94, totalCloud: 92, precipitation: 0 }
          ]
        }
      }
    );

    expect(result.breakdown.baseScore).toBeGreaterThanOrEqual(70);
    expect(result.breakdown.baseRenderingFactor).toBeGreaterThanOrEqual(0.88);
    expect(result.breakdown.baseRenderingFactor).toBeLessThanOrEqual(0.95);
    expect(result.breakdown.airTransmissionFactor).toBeGreaterThanOrEqual(0.9);
    expect(result.breakdown.renderingFactor).toBeCloseTo(result.breakdown.baseRenderingFactor, 2);
    expect(result.score).toBeGreaterThanOrEqual(55);
    expect(result.score).toBeLessThanOrEqual(70);
  });

  test('PM-only haze with usable visibility softens Beijing upper-cloud carrier instead of hard-blocking it', () => {
    const result = service.calculateEnhancedPrediction(
      {
        cloudCover: 97.9,
        humidity: 83.9,
        visibility: 11.5,
        lowCloudCover: 13.1,
        precipitation: 0,
        recentPrecipitation6h: 0,
        recentRainHours: 0,
        recentRainSignal: 0,
        lowClouds: 13.1,
        midClouds: 17.4,
        highClouds: 92,
        shortwaveRadiation: 28.1,
        directRadiation: 2.4,
        diffuseRadiation: 25.7,
        waterVapourColumn: 42.87,
        aerosolOpticalDepth: 0.414,
        dust: 7.7,
        pm2_5: 137.06,
        pm10: 144.39,
        aqi: 161.4
      },
      new Date('2026-07-16T11:42:00.000Z'),
      39.9042,
      116.4074,
      'sunset',
      {
        remoteCloudData: {
          source: 'sunset_visible_sector_openmeteo',
          azimuth: 303,
          samples: [
            { distanceKm: 10, bearing: 303, lowCloud: 0, midCloud: 20.8, highCloud: 100, totalCloud: 80.3, precipitation: 0 },
            { distanceKm: 25, bearing: 303, lowCloud: 0, midCloud: 20.8, highCloud: 100, totalCloud: 80.3, precipitation: 0 },
            { distanceKm: 50, bearing: 303, lowCloud: 0, midCloud: 56.5, highCloud: 6.9, totalCloud: 40.6, precipitation: 0 },
            { distanceKm: 75, bearing: 303, lowCloud: 0, midCloud: 56.8, highCloud: 5.7, totalCloud: 20.8, precipitation: 0 },
            { distanceKm: 100, bearing: 303, lowCloud: 0, midCloud: 61.1, highCloud: 3.9, totalCloud: 43.4, precipitation: 0 }
          ]
        }
      }
    );

    expect(result.breakdown.carrierScore).toBeGreaterThanOrEqual(65);
    expect(result.scoringV2).toEqual(expect.objectContaining({
      applied: true,
      airMode: 'wet_haze_path_open_mid_rendering'
    }));
    expect(result.aerosolHazeCap).toEqual(expect.objectContaining({
      applied: false,
      reason: 'transparent_path_particulate_damping_only'
    }));
    expect(result.score).toBeGreaterThanOrEqual(45);
    expect(result.score).toBeLessThanOrEqual(60);
    expect(result.status).toBe('good_glow');
  });

});
