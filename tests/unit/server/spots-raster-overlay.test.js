import { jest } from '@jest/globals';
import { renderRasterOverlayPng, scoreToRasterRgba } from '../../../server/routes/spots.js';
import overlayImageService from '../../../server/services/ChinaRasterOverlayImageService.js';

const { ChinaRasterOverlayImageService } = overlayImageService;

describe('spots raster overlay image', () => {
  function readPngSize(buffer) {
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20)
    };
  }

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

  test('supersamples the overlay image so map scaling does not expose raw raster cells', () => {
    const png = renderRasterOverlayPng({
      width: 2,
      height: 2,
      noData: -1,
      values: [40, 50, 60, 70]
    }, 'sunset');

    expect(readPngSize(png)).toEqual({ width: 8, height: 8 });
  });

  test('keeps low scores transparent and high scores tinted', () => {
    expect(scoreToRasterRgba(39, 'sunset')).toEqual({ r: 0, g: 0, b: 0, a: 0 });
    expect(scoreToRasterRgba(70, 'sunset')).toEqual({ r: 218, g: 78, b: 28, a: 0.55 });
  });

  test('caches generated PNG overlays by raster data signature', async () => {
    const raster = {
      width: 2,
      height: 2,
      noData: -1,
      values: [40, 50, 60, 70],
      resolution: 0.5,
      updatedAt: '2026-05-31T05:00:00.000Z',
      generatedAt: '2026-05-31T05:01:00.000Z',
      _sourceSignature: 'grid-product-cache|ready'
    };
    const rasterService = {
      getRaster: jest.fn().mockResolvedValue(raster)
    };
    const service = new ChinaRasterOverlayImageService({ rasterService });

    const first = await service.getOverlayPng('sunset', 0.5);
    const second = await service.getOverlayPng('sunset', 0.5);

    expect(first).toBe(second);
    expect(Buffer.isBuffer(first.png)).toBe(true);
    expect(first.rasterUpdatedAt).toBe('2026-05-31T05:00:00.000Z');
    expect(rasterService.getRaster).toHaveBeenCalledTimes(2);
  });

  test('warmCache pre-generates the 0.5 degree overlay after data refresh', async () => {
    const rasterService = {
      getRaster: jest.fn().mockResolvedValue({
        width: 2,
        height: 2,
        noData: -1,
        values: [40, 50, 60, 70],
        resolution: 0.5,
        updatedAt: '2026-05-31T05:00:00.000Z',
        generatedAt: '2026-05-31T05:01:00.000Z',
        _sourceSignature: 'grid-product-cache|ready'
      })
    };
    const service = new ChinaRasterOverlayImageService({ rasterService });

    const warmed = await service.warmCache('sunrise');

    expect(warmed).toHaveLength(1);
    expect(warmed[0].period).toBe('sunrise');
    expect(warmed[0].resolution).toBe(0.5);
    expect(Buffer.isBuffer(warmed[0].png)).toBe(true);
    expect(rasterService.getRaster).toHaveBeenCalledWith('sunrise', 0.5);
  });
});
