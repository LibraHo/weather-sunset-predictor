describe('LayerBrightnessService', () => {
  let service;

  beforeAll(async () => {
    service = await import('../../../server/services/LayerBrightnessService.js');
  });

  test('keeps light-path brightness separate from gray-veil air transmission', () => {
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

    expect(result.effectiveBrightness).toBeGreaterThanOrEqual(42);
    expect(result.brightnessMultiplier).toBe(1);
    expect(result.factors.airTransmission).toBeLessThan(0.72);
    expect(result.dimEvidence).toEqual(expect.arrayContaining([
      'high_aod',
      'high_water_vapour',
      'diffuse_dominant_light'
    ]));
    expect(result.cap).toBeNull();
    expect(result.reason).toBe('layer_brightness_sufficient_with_dim_evidence');
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

  test('keeps low clouds out of carrier contributions and uses them only as brightness blockage', () => {
    const result = service.scoreLayerBrightness({
      type: 'sunset',
      timeAnalysis: { elevation: -1 },
      weatherData: {
        lowClouds: 35,
        midClouds: 48,
        highClouds: 42,
        cloudCover: 70,
        visibility: 22,
        humidity: 48
      },
      lightPathScore: { score: 92 },
      renderingFactor: { factor: 1 },
      cloudThickness: { modifier: 1 },
      carrierScore: { score: 68, activeCarrier: 'cloud' }
    });

    expect(result.layerContributions.map(item => item.key)).not.toContain('low');
    expect(result.layers.low).toBe(35);
    expect(result.factors.lowBlockFactor).toBeLessThan(1);
  });

  test('compares solar-direction high cloud as an independent carrier without adding it', () => {
    const withoutRemote = service.scoreLayerBrightness({
      type: 'sunset',
      timeAnalysis: { elevation: -1 },
      weatherData: {
        lowClouds: 0,
        midClouds: 0,
        highClouds: 36.75,
        cloudCover: 37,
        visibility: 18,
        humidity: 55,
        directRadiation: 10,
        diffuseRadiation: 18,
        shortwaveRadiation: 35
      },
      lightPathScore: { score: 96 },
      renderingFactor: { factor: 1 },
      cloudThickness: { modifier: 1 },
      carrierScore: { score: 73.4, activeCarrier: 'cloud' }
    });

    const withRemote = service.scoreLayerBrightness({
      type: 'sunset',
      timeAnalysis: { elevation: -1 },
      weatherData: {
        lowClouds: 0,
        midClouds: 0,
        highClouds: 36.75,
        cloudCover: 37,
        visibility: 18,
        humidity: 55,
        directRadiation: 10,
        diffuseRadiation: 18,
        shortwaveRadiation: 35
      },
      lightPathScore: { score: 96 },
      renderingFactor: { factor: 1 },
      cloudThickness: { modifier: 1 },
      carrierScore: { score: 73.4, activeCarrier: 'cloud' },
      remoteLayerCarriers: {
        applied: true,
        remoteHighCarrier: 22,
        remoteMidCarrier: 0,
        remoteLowBlock: 0,
        metrics: { high: 43, mid: 0 }
      }
    });

    expect(withRemote.layerContributions.map(item => item.key)).toContain('remoteHigh');
    expect(withRemote.layerContributions.map(item => item.key)).not.toContain('remoteMid');
    expect(withRemote.weightedCarrierScore).toBe(withoutRemote.weightedCarrierScore);
    expect(withRemote.layers.remoteHigh).toBe(43);
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

  test('adds a continuous bonus only when three independent illuminated carriers are strong', () => {
    const common = {
      type: 'sunrise',
      timeAnalysis: { elevation: -1 },
      weatherData: { lowClouds: 0, midClouds: 100, highClouds: 100, cloudCover: 100 },
      lightPathScore: { score: 100 },
      lightPathGate: { gate: 1 },
      renderingFactor: { factor: 1 },
      cloudThickness: { modifier: 1 },
      carrierScore: { score: 80, activeCarrier: 'cloud' }
    };
    const single = service.scoreLayerBrightness(common);
    const multiple = service.scoreLayerBrightness({
      ...common,
      directionalCurtainCarrier: { metrics: { upperSignal: 100 } },
      visibleSectorCarrier: { applied: true, score: 62, metrics: { upperSignal: 84 } }
    });

    expect(single.synergy.bonus).toBe(0);
    expect(multiple.synergy).toEqual(expect.objectContaining({
      bestScore: 85,
      secondScore: 72,
      thirdScore: 62
    }));
    expect(multiple.synergy.bonus).toBeGreaterThan(0);
    expect(multiple.weightedCarrierScore).toBeGreaterThan(single.weightedCarrierScore);
    expect(multiple.weightedCarrierScore).toBeGreaterThanOrEqual(94);
    expect(multiple.weightedCarrierScore).toBeLessThanOrEqual(96);
  });
});
