import {
  DEFAULT_PROFILE_CLOUDS,
  simulateFireCloudProfile,
} from '../../../src/services/FireCloudProfileSimulator.js';

describe('FireCloudProfileSimulator', () => {
  test('only shadows clouds inside the blocker shadow band', () => {
    const result = simulateFireCloudProfile({
      mode: 'sunrise',
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
          id: 'far-low',
          label: '70km low haze',
          distanceKm: 70,
          baseHeightM: 1200,
          topHeightM: 2200,
          coverage: 58,
          opticalDepth: 0.34,
        },
        {
          id: 'far-high',
          label: '70km high canvas',
          distanceKm: 72,
          baseHeightM: 6200,
          topHeightM: 7600,
          coverage: 58,
          opticalDepth: 0.34,
        },
      ],
    });

    expect(result.sun).toMatchObject({
      solarElevationDeg: 2.2,
      mode: 'sunrise',
    });
    expect(result.clouds).toHaveLength(3);
    expect(result.clouds[0]).toMatchObject({
      id: 'near-low',
      status: 'blocking',
      distanceKm: 12,
      baseHeightM: 250,
      topHeightM: 900,
    });
    expect(result.clouds[1]).toMatchObject({
      id: 'far-low',
      status: 'shadowed',
      blockedBy: 'near-low',
    });
    expect(result.clouds[2].id).toBe('far-high');
    expect(result.clouds[2].status).not.toBe('shadowed');
    expect(result.summary.blockedCount).toBe(1);
  });

  test('uses opposite light travel order for sunrise and sunset', () => {
    const clouds = [
      {
        id: 'west-low-wall',
        label: 'west low blocker',
        distanceKm: 15,
        baseHeightM: 250,
        topHeightM: 1200,
        coverage: 90,
        opticalDepth: 0.95,
      },
      {
        id: 'east-low-wall',
        label: 'east low blocker',
        distanceKm: 135,
        baseHeightM: 250,
        topHeightM: 1200,
        coverage: 90,
        opticalDepth: 0.95,
      },
      {
        id: 'middle-low',
        label: 'middle low cloud',
        distanceKm: 70,
        baseHeightM: 1300,
        topHeightM: 2200,
        coverage: 50,
        opticalDepth: 0.35,
      },
    ];

    const sunrise = simulateFireCloudProfile({ mode: 'sunrise', solarElevationDeg: 0.8, clouds });
    const sunset = simulateFireCloudProfile({ mode: 'sunset', solarElevationDeg: 0.8, clouds });
    const sunriseMiddle = sunrise.clouds.find(cloud => cloud.id === 'middle-low');
    const sunsetMiddle = sunset.clouds.find(cloud => cloud.id === 'middle-low');

    expect(sunriseMiddle.blockedBy).toBe('west-low-wall');
    expect(sunsetMiddle.blockedBy).toBe('east-low-wall');
  });

  test('uses cloud width when estimating low-angle shadow reach', () => {
    const makeClouds = (blockerWidthKm) => [
      {
        id: 'west-low-wall',
        label: 'wide or narrow west low blocker',
        distanceKm: 30,
        baseHeightM: 250,
        topHeightM: 900,
        coverage: 90,
        widthKm: blockerWidthKm,
        opticalDepth: 1,
      },
      {
        id: 'east-mid-cloud',
        label: 'east mid height cloud',
        distanceKm: 70,
        baseHeightM: 2500,
        topHeightM: 3200,
        coverage: 50,
        widthKm: 8,
        opticalDepth: 0.35,
      },
    ];

    const narrow = simulateFireCloudProfile({
      mode: 'sunrise',
      solarElevationDeg: 1.8,
      clouds: makeClouds(2),
    });
    const wide = simulateFireCloudProfile({
      mode: 'sunrise',
      solarElevationDeg: 1.8,
      clouds: makeClouds(80),
    });

    expect(narrow.clouds.find(cloud => cloud.id === 'east-mid-cloud').status).not.toBe('shadowed');
    expect(wide.clouds.find(cloud => cloud.id === 'east-mid-cloud')).toMatchObject({
      status: 'shadowed',
      blockedBy: 'west-low-wall',
    });
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
    expect(result.clouds[0].illumination).toBeGreaterThanOrEqual(0.5);
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
      Number.isFinite(cloud.widthKm) &&
      cloud.widthKm >= 2 &&
      cloud.topHeightM > cloud.baseHeightM
    )).toBe(true);
  });
});
