import {
  projectFacingSunCloud,
  solarElevationFromTimeOffset,
} from '../../src/components/FireCloudProfileSimulatorView.js';

describe('FireCloudProfileSimulatorView helpers', () => {
  test('maps sunset time so before sunset is higher and after sunset is lower', () => {
    expect(solarElevationFromTimeOffset(-40, 'sunset')).toBeGreaterThan(
      solarElevationFromTimeOffset(0, 'sunset')
    );
    expect(solarElevationFromTimeOffset(40, 'sunset')).toBeLessThan(
      solarElevationFromTimeOffset(0, 'sunset')
    );
  });

  test('maps sunrise time so before sunrise is lower and after sunrise is higher', () => {
    expect(solarElevationFromTimeOffset(-40, 'sunrise')).toBeLessThan(
      solarElevationFromTimeOffset(0, 'sunrise')
    );
    expect(solarElevationFromTimeOffset(40, 'sunrise')).toBeGreaterThan(
      solarElevationFromTimeOffset(0, 'sunrise')
    );
  });

  test('projects front-facing clouds with perspective and meter-level thickness', () => {
    const near = projectFacingSunCloud({
      id: 'near',
      distanceKm: 20,
      widthKm: 20,
      baseHeightM: 1000,
      topHeightM: 3000,
      coverage: 70,
    }, { width: 1080, height: 620, inset: 44 });
    const far = projectFacingSunCloud({
      id: 'far',
      distanceKm: 100,
      widthKm: 20,
      baseHeightM: 1000,
      topHeightM: 3000,
      coverage: 70,
    }, { width: 1080, height: 620, inset: 44 });
    const deep = projectFacingSunCloud({
      id: 'deep',
      distanceKm: 20,
      widthKm: 20,
      baseHeightM: 1000,
      topHeightM: 7000,
      coverage: 70,
    }, { width: 1080, height: 620, inset: 44 });

    expect(near.width).toBeGreaterThan(far.width);
    expect(deep.height).toBeGreaterThan(near.height);
    expect(near.x).toBeGreaterThanOrEqual(44);
    expect(near.x + near.width).toBeLessThanOrEqual(1080 - 44);
  });
});
