import RadarCompass from '../../src/components/RadarCompass.js';

describe('RadarCompass FOV bearing projection', () => {
  test('derives left/right offsets from bearing-only visible-sector samples', () => {
    const radar = new RadarCompass();
    const field = radar._buildFovField({
      visibleSector: {
        mainBearing: 300,
        offsetsDeg: [-35, 0, 35],
        distancesKm: [50]
      },
      visibleSectorSamples: [
        { bearing: 280, distanceKm: 50, highCloud: 60 },
        { bearing: 320, distanceKm: 50, highCloud: 60 }
      ]
    }, []);

    expect(field.samples.map((sample) => sample.offsetDeg)).toEqual([-20, 20]);
    expect(field.samples[0].bearing).toBe(280);
    expect(field.samples[1].bearing).toBe(320);
  });

  test('renders a sunset bearing inset in the FOV radar', () => {
    const radar = new RadarCompass();
    const field = radar._buildFovField({
      predictionType: 'sunset',
      visibleSector: {
        mainBearing: 305,
        offsetsDeg: [-35, 0, 35],
        distancesKm: [25]
      },
      visibleSectorSamples: [
        { bearing: 305, distanceKm: 25, midCloud: 70 }
      ]
    }, []);
    const html = radar._buildFovAltitude(field, {
      bg: '#fff',
      border: 'rgba(0,0,0,0.1)',
      ring: 'rgba(100,130,180,0.25)',
      axisSub: 'rgba(100,130,180,0.16)',
      labelFill: '#263241',
      title: '#263241',
      subtitle: '#667085',
      legendBg: 'rgba(255,255,255,0.86)',
      center: 'rgba(249,115,22,0.95)',
      cloudHigh: 'rgba(218,226,238,0.72)',
      cloudMid: 'rgba(184,198,218,0.88)',
      cloudLow: 'rgba(138,156,186,0.95)'
    }, 'unit', {
      title: 'Field-of-View Cloud Radar',
      subtitle: 'Azimuth x sky altitude',
      center: 'Main path',
      left: 'Left sector',
      right: 'Right sector',
      altitude: 'Sky altitude',
      highDesc: 'High cloud',
      midDesc: 'Mid cloud',
      lowDesc: 'Low cloud',
      sunrise: 'Sunrise',
      sunset: 'Sunset'
    });

    expect(field.predictionType).toBe('sunset');
    expect(html).toContain('radar-fov-bearing-inset');
    expect(html).toContain('Sunset 305&deg;');
    expect(html).toContain('>305&deg;</text>');
    expect(html).not.toContain('position:absolute;right:10px;top:10px');
  });

  test('maps 10-100 percent cloud cover to visible monotonic FOV strength', () => {
    const radar = new RadarCompass();
    const low = radar._fovCoverStrength(10, 0.92);
    const mid = radar._fovCoverStrength(50, 0.92);
    const high = radar._fovCoverStrength(100, 0.92);

    expect(low).toBeGreaterThan(0.1);
    expect(mid).toBeGreaterThan(low);
    expect(high).toBe(1);
    expect(radar._fovCoverSpreadScale(90)).toBeGreaterThan(radar._fovCoverSpreadScale(10));
  });

  test('keeps FOV cloud samples local instead of filling the whole azimuth band', () => {
    const radar = new RadarCompass();
    const layer = { key: 'mid', heightKm: 4.2, altitudeSpread: 2.1, offsetSpread: 6.8, gamma: 0.92 };
    const sample = { offsetDeg: 0, altitudeDeg: 8, cover: 80, distanceKm: 50 };

    const center = radar._fovPatchContribution(0, 8, sample, layer);
    const sameAltitudeFarAzimuth = radar._fovPatchContribution(18, 8, sample, layer);
    const nearbyPeak = Math.max(
      radar._fovPatchContribution(1, 8, sample, layer),
      radar._fovPatchContribution(2, 8.5, sample, layer),
      radar._fovPatchContribution(3, 8.8, sample, layer)
    );

    expect(center).toBeGreaterThan(0.35);
    expect(nearbyPeak).toBeGreaterThan(0.35);
    expect(sameAltitudeFarAzimuth).toBe(0);
  });

  test('uses cover percentage for FOV cloud thickness without making weak clouds dominant', () => {
    const radar = new RadarCompass();
    const layer = { key: 'low', heightKm: 1.2, altitudeSpread: 1.35, offsetSpread: 5.6, gamma: 0.94 };
    const weak = { offsetDeg: 0, altitudeDeg: 4, cover: 10, distanceKm: 25 };
    const full = { ...weak, cover: 100 };

    expect(radar._fovPatchContribution(0, 4, weak, layer)).toBeLessThan(radar._fovPatchContribution(0, 4, full, layer));
    expect(radar._fovPatchContribution(5, 4, weak, layer)).toBeLessThan(radar._fovPatchContribution(5, 4, full, layer));
  });

  test('does not collapse mid and high clouds onto the provider cloud-base height', () => {
    const radar = new RadarCompass();
    const sample = { distanceKm: 50, cloudBaseHeight: 800 };

    const low = radar._sampleAltitudeDeg(sample, 'low', 1.2);
    const mid = radar._sampleAltitudeDeg(sample, 'mid', 4.2);
    const high = radar._sampleAltitudeDeg(sample, 'high', 9.0);

    expect(low).toBeLessThan(mid);
    expect(mid).toBeLessThan(high);
  });

  test('adds bounded visual jitter so FOV cloud anchors do not sit on a perfect grid', () => {
    const radar = new RadarCompass();
    const field = radar._buildFovField({
      visibleSector: {
        mainBearing: 305,
        offsetsDeg: [-35, -20, 0, 20, 35],
        distancesKm: [10, 25, 50, 75, 100]
      },
      visibleSectorSamples: [
        { bearing: 305, distanceKm: 50, midCloud: 80 }
      ]
    }, []);
    const layer = { key: 'mid', heightKm: 4.2 };
    const item = {
      offsetDeg: field.samples[0].offsetDeg,
      altitudeDeg: radar._sampleAltitudeDeg(field.samples[0], 'mid', 4.2),
      cover: 80,
      distanceKm: 50
    };
    const anchored = radar._withFovVisualAnchor(item, layer, field);

    expect(anchored.visualOffsetDeg).not.toBe(item.offsetDeg);
    expect(anchored.visualAltitudeDeg).not.toBe(item.altitudeDeg);
    expect(Math.abs(anchored.visualOffsetDeg)).toBeLessThanOrEqual(field.maxAbsOffset);
    expect(anchored.visualAltitudeDeg).toBeGreaterThanOrEqual(0);
    expect(anchored.visualAltitudeDeg).toBeLessThanOrEqual(field.maxAltitude);
  });

  test('uses projected screen spacing instead of physical distance spacing for FOV cloud kernels', () => {
    const radar = new RadarCompass();
    const field = radar._buildFovField({
      visibleSector: {
        mainBearing: 305,
        offsetsDeg: [0],
        distancesKm: [10, 25, 50, 75, 100]
      },
      visibleSectorSamples: [10, 25, 50, 75, 100].map((distanceKm) => ({
        bearing: 305,
        distanceKm,
        highCloud: 70
      }))
    }, []);
    const layer = { key: 'high', heightKm: 9.0, altitudeSpread: 3.1, offsetSpread: 6.8, gamma: 0.78 };
    const items = radar._buildFovLayerItems(field, layer);
    const near = items.find((item) => item.distanceKm === 10);
    const far = items.find((item) => item.distanceKm === 100);

    expect(near.altitudeDeg).toBeGreaterThan(far.altitudeDeg);
    expect(near.altitudeCellDeg).toBeGreaterThan(far.altitudeCellDeg);
    expect(radar._fovPatchContribution(near.visualOffsetDeg, near.visualAltitudeDeg + 1.2, near, layer)).toBeGreaterThan(0);
  });

  test('expands strong FOV samples into varied cloudlets instead of fixed-size grid marks', () => {
    const radar = new RadarCompass();
    const field = radar._buildFovField({
      visibleSector: {
        mainBearing: 305,
        offsetsDeg: [0],
        distancesKm: [25, 75]
      },
      visibleSectorSamples: [
        { bearing: 305, distanceKm: 25, midCloud: 88 },
        { bearing: 305, distanceKm: 75, midCloud: 88 }
      ]
    }, []);
    const layer = { key: 'mid', heightKm: 4.2, altitudeSpread: 1.9, offsetSpread: 5.7, gamma: 0.92 };
    const items = radar._buildFovLayerItems(field, layer);
    const offsets = new Set(items.map((item) => item.visualOffsetDeg.toFixed(2)));
    const sizes = new Set(items.map((item) => `${item.xScale.toFixed(2)}:${item.yScale.toFixed(2)}`));

    expect(items.length).toBeGreaterThan(field.samples.length);
    expect(offsets.size).toBeGreaterThan(field.samples.length);
    expect(sizes.size).toBeGreaterThan(2);
  });

  test('turns high cover FOV samples into continuous cloud curtains between samples', () => {
    const radar = new RadarCompass();
    const field = radar._buildFovField({
      visibleSector: {
        mainBearing: 305,
        offsetsDeg: [-30, -15, 0, 15, 30],
        distancesKm: [25, 50, 75]
      },
      visibleSectorSamples: [-30, -15, 0, 15, 30].flatMap((offset) => [25, 50, 75].map((distanceKm) => ({
        bearing: 305 + offset,
        distanceKm,
        lowCloud: 100
      })))
    }, []);
    const layer = { key: 'low', heightKm: 1.2, altitudeSpread: 1.2, offsetSpread: 5.1, gamma: 0.94 };
    const items = radar._buildFovLayerItems(field, layer);

    const betweenSamples = radar._fovLayerCurtainContribution(7.5, 3.2, items, layer);
    const upperSky = radar._fovLayerCurtainContribution(7.5, 23, items, layer);

    expect(betweenSamples.strength).toBeGreaterThan(0.13);
    expect(upperSky.strength).toBeLessThan(betweenSamples.strength);
  });

  test('does not create cloud curtains for weak FOV cover', () => {
    const radar = new RadarCompass();
    const layer = { key: 'mid', heightKm: 4.2, altitudeSpread: 1.9, offsetSpread: 5.7, gamma: 0.92 };
    const items = [
      { offsetDeg: -10, visualOffsetDeg: -10, altitudeDeg: 8, visualAltitudeDeg: 8, cover: 35, distanceKm: 50, offsetCellDeg: 15, altitudeCellDeg: 4 },
      { offsetDeg: 10, visualOffsetDeg: 10, altitudeDeg: 8, visualAltitudeDeg: 8, cover: 35, distanceKm: 50, offsetCellDeg: 15, altitudeCellDeg: 4 }
    ];

    expect(radar._fovLayerCurtainContribution(0, 8, items, layer).strength).toBe(0);
  });

  test('does not synthesize FOV samples from legacy directional cloud data', () => {
    const radar = new RadarCompass();
    const legacyDirections = [
      { dir: 'W', cloudLayers: { high: 80, mid: 40, low: 10 } },
      { dir: 'NW', cloudLayers: { high: 60, mid: 30, low: 20 } }
    ];
    const field = radar._buildFovField({
      visibleSector: {
        mainBearing: 305,
        offsetsDeg: [-35, 0, 35],
        distancesKm: [10, 25, 50]
      }
    }, radar._parse(legacyDirections));

    expect(field.samples).toEqual([]);
  });

});
