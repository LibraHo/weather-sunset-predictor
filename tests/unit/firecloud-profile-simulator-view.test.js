import { solarElevationFromTimeOffset } from '../../src/components/FireCloudProfileSimulatorView.js';

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
});
