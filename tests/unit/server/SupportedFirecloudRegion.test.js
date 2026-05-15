import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { isSupportedFirecloudRegion } = require('../../../server/utils/SupportedFirecloudRegion.js');

describe('SupportedFirecloudRegion', () => {
  test('keeps China, Japan, and South Korea enabled', () => {
    expect(isSupportedFirecloudRegion(39.9042, 116.4074)).toBe(true); // Beijing
    expect(isSupportedFirecloudRegion(31.2304, 121.4737)).toBe(true); // Shanghai
    expect(isSupportedFirecloudRegion(35.6762, 139.6503)).toBe(true); // Tokyo
    expect(isSupportedFirecloudRegion(37.5665, 126.9780)).toBe(true); // Seoul
  });

  test('keeps not-yet-supported East Asia countries disabled', () => {
    expect(isSupportedFirecloudRegion(39.0392, 125.7625)).toBe(false); // Pyongyang
  });

  test('does not treat unsupported South Asia as firecloud map coverage', () => {
    expect(isSupportedFirecloudRegion(28.6139, 77.2090)).toBe(false); // New Delhi
    expect(isSupportedFirecloudRegion(19.0760, 72.8777)).toBe(false); // Mumbai
    expect(isSupportedFirecloudRegion(27.7172, 85.3240)).toBe(false); // Kathmandu
    expect(isSupportedFirecloudRegion(23.8103, 90.4125)).toBe(false); // Dhaka
  });
});
