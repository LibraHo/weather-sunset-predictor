import {
  DEFAULT_PROFILE_CLOUDS,
  simulateFireCloudProfile,
} from '../../../src/services/FireCloudProfileSimulator.js';

describe('FireCloudProfileSimulator', () => {
  test('uses kilometer distance and meter cloud bounds to mark illuminated clouds', () => {
    const result = simulateFireCloudProfile({
      solarElevationDeg: 2.2,
      clouds: [
        {
          id: 'near-low',
          label: '12km low blocker',
          distanceKm: 12,
          baseHeightM: 250,
          topHeightM: 900,
          coverage: 88,
          opticalDepth: 0.92,
        },
        {
          id: 'far-high',
          label: '70km high canvas',
          distanceKm: 70,
          baseHeightM: 5200,
          topHeightM: 7600,
          coverage: 58,
          opticalDepth: 0.34,
        },
      ],
    });

    expect(result.sun).toMatchObject({
      solarElevationDeg: 2.2,
      mode: 'sunset',
    });
    expect(result.clouds).toHaveLength(2);
    expect(result.clouds[0]).toMatchObject({
      id: 'near-low',
      status: 'blocking',
      distanceKm: 12,
      baseHeightM: 250,
      topHeightM: 900,
    });
    expect(result.clouds[1]).toMatchObject({
      id: 'far-high',
      status: 'shadowed',
      blockedBy: 'near-low',
    });
    expect(result.summary.blockedCount).toBe(1);
  });

  test('colors thin upper clouds warm when the light path is open near sunset', () => {
    const result = simulateFireCloudProfile({
      solarElevationDeg: -1.2,
      clouds: [
        {
          id: 'thin-upper',
          label: '45km thin upper cloud',
          distanceKm: 45,
          baseHeightM: 6800,
          topHeightM: 8800,
          coverage: 46,
          opticalDepth: 0.24,
        },
      ],
    });

    expect(result.clouds[0].status).toBe('lit');
    expect(result.clouds[0].colorName).toBe('crimson pink');
    expect(result.clouds[0].illumination).toBeGreaterThan(0.5);
    expect(result.summary.litCount).toBe(1);
  });

  test('darkens thick high cloud even when geometry is reachable', () => {
    const result = simulateFireCloudProfile({
      solarElevationDeg: 1.5,
      clouds: [
        {
          id: 'thick-high',
          label: '55km thick high cloud',
          distanceKm: 55,
          baseHeightM: 6100,
          topHeightM: 9300,
          coverage: 92,
          opticalDepth: 1.25,
        },
      ],
    });

    expect(result.clouds[0].status).toBe('dimmed');
    expect(result.clouds[0].colorName).toBe('violet gray');
    expect(result.clouds[0].reason).toContain('optical depth');
  });

  test('marks clouds that stay dark through the full sunrise or sunset sweep', () => {
    const result = simulateFireCloudProfile({
      solarElevationDeg: 0.4,
      includeLifecycle: true,
      clouds: [
        {
          id: 'near-unreachable',
          label: 'near thick high cloud above most low-angle light',
          distanceKm: 6,
          baseHeightM: 9000,
          topHeightM: 11000,
          coverage: 95,
          opticalDepth: 1.6,
        },
      ],
    });

    const hiddenCloud = result.clouds.find(cloud => cloud.id === 'near-unreachable');
    expect(hiddenCloud.alwaysDark).toBe(true);
    expect(hiddenCloud.lifecycle.maxIllumination).toBeLessThanOrEqual(0.28);
    expect(result.summary.alwaysDarkCount).toBe(1);
  });

  test('ships useful default meter/kilometer profile clouds', () => {
    expect(DEFAULT_PROFILE_CLOUDS.length).toBeGreaterThanOrEqual(4);
    expect(DEFAULT_PROFILE_CLOUDS.every(cloud =>
      Number.isFinite(cloud.distanceKm) &&
      Number.isFinite(cloud.baseHeightM) &&
      Number.isFinite(cloud.topHeightM) &&
      cloud.topHeightM > cloud.baseHeightM
    )).toBe(true);
  });
});
