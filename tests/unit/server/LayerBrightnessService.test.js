describe('LayerBrightnessService', () => {
  let service;

  beforeAll(async () => {
    service = await import('../../../server/services/LayerBrightnessService.js');
  });

  test('multiplies diffuse gray-veil high cloud down even when the light path is open', () => {
    const result = service.scoreLayerBrightness({
      type: 'sunset',
      timeAnalysis: { elevation: -0.86 },
      weatherData: {
        lowClouds: 0,
        midClouds: 23.9,
        highClouds: 77.5,
        cloudCover: 76.6,
        visibility: 20,
        humidity: 48.6,
        aerosolOpticalDepth: 0.442,
        pm10: 55.71,
        waterVapourColumn: 36.57,
        directRadiation: 4.66,
        diffuseRadiation: 30.64,
        shortwaveRadiation: 35.3
      },
      lightPathScore: { score: 100 },
      renderingFactor: { factor: 0.9 },
      cloudThickness: { modifier: 1 },
      directionalCurtainCarrier: {
        metrics: { upperSignal: 100 }
      }
    });

    expect(result.effectiveBrightness).toBeGreaterThanOrEqual(18);
    expect(result.effectiveBrightness).toBeLessThan(30);
    expect(result.brightnessMultiplier).toBeGreaterThanOrEqual(0.4);
    expect(result.brightnessMultiplier).toBeLessThan(0.72);
    expect(result.cap).toBeNull();
    expect(result.reason).toBe('layer_brightness_weak');
  });

  test('does not cap bright clean upper-cloud cases', () => {
    const result = service.scoreLayerBrightness({
      type: 'sunset',
      timeAnalysis: { elevation: -1 },
      weatherData: {
        lowClouds: 0,
        midClouds: 48,
        highClouds: 42,
        cloudCover: 58,
        visibility: 24,
        humidity: 45,
        aerosolOpticalDepth: 0.18,
        pm10: 35,
        waterVapourColumn: 22,
        directRadiation: 38,
        diffuseRadiation: 24,
        shortwaveRadiation: 80
      },
      lightPathScore: { score: 95 },
      renderingFactor: { factor: 1.04 },
      cloudThickness: { modifier: 1.05 }
    });

    expect(result.effectiveBrightness).toBeGreaterThanOrEqual(42);
    expect(result.brightnessMultiplier).toBeGreaterThanOrEqual(1);
    expect(result.cap).toBeNull();
    expect(result.reason).toBe('layer_brightness_sufficient');
  });

  test('applies brightness as a multiplier instead of a cap', () => {
    const weak = { brightnessMultiplier: 0.5, effectiveBrightness: 21, reason: 'layer_brightness_weak' };

    expect(service.applyLayerBrightnessMultiplier(68, weak)).toEqual(expect.objectContaining({
      applied: true,
      score: 34,
      multiplier: 0.5,
      originalScore: 68
    }));

    expect(service.applyLayerBrightnessMultiplier(45, { brightnessMultiplier: 1, reason: 'layer_brightness_sufficient' })).toEqual(expect.objectContaining({
      applied: false,
      score: 45
    }));
  });

  test('unlit cloud layers zero out the score', () => {
    const result = service.scoreLayerBrightness({
      type: 'sunset',
      timeAnalysis: { elevation: -1 },
      weatherData: {
        lowClouds: 0,
        midClouds: 0,
        highClouds: 0,
        cloudCover: 0,
        visibility: 24,
        humidity: 45
      },
      lightPathScore: { score: 100 },
      renderingFactor: { factor: 1 },
      cloudThickness: { modifier: 1 }
    });

    expect(result.effectiveBrightness).toBe(0);
    expect(result.brightnessMultiplier).toBe(0);
    expect(result.reason).toBe('layer_brightness_unlit');
    expect(service.applyLayerBrightnessMultiplier(72, result)).toEqual(expect.objectContaining({
      applied: true,
      score: 0
    }));
  });
});
