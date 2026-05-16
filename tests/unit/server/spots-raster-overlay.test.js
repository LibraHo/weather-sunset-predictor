import { renderRasterOverlayPng, scoreToRasterRgba } from '../../../server/routes/spots.js';

describe('spots raster overlay image', () => {
  test('renders transparent PNG heat layer from raster scores', () => {
    const png = renderRasterOverlayPng({
      width: 2,
      height: 2,
      noData: -1,
      values: [39, 45, 70, -1]
    }, 'sunset');

    expect(Buffer.isBuffer(png)).toBe(true);
    expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(png.length).toBeGreaterThan(60);
  });

  test('keeps low scores transparent and high scores tinted', () => {
    expect(scoreToRasterRgba(39, 'sunset')).toEqual({ r: 0, g: 0, b: 0, a: 0 });
    expect(scoreToRasterRgba(70, 'sunset')).toEqual({ r: 218, g: 78, b: 28, a: 0.55 });
  });
});
