import { jest } from '@jest/globals';
import FireCloudOverlayService from '../../../src/services/FireCloudOverlayService.js';

describe('FireCloudOverlayService', () => {
  let service;

  beforeEach(() => {
    service = new FireCloudOverlayService();
    document.body.innerHTML = '<div id="map-container"></div>';
    global.fetch = jest.fn();
    global.AbortSignal = { timeout: jest.fn(() => 'timeout-signal') };
    HTMLCanvasElement.prototype.getContext.mockImplementation(() => global.__canvasContext2DMock);
    HTMLCanvasElement.prototype.toDataURL.mockImplementation(() => 'data:image/png;base64,mock-overlay');
    global.__canvasContext2DMock.createRadialGradient.mockImplementation(() => ({ addColorStop: jest.fn() }));
  });

  test('fetchBackendOverlay 应使用正确 query 参数请求后端', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        image: 'data:image/png;base64,abc',
        bounds: { north: 41, south: 39, east: 117, west: 115 },
        timestamp: 123456
      })
    });

    const result = await service.fetchBackendOverlay({ lat: 40, lon: 116 }, 180, 'sunset');

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/firecloud/overlay?lat=40&lon=116&radius=180&type=sunset',
      expect.objectContaining({ method: 'GET', signal: 'timeout-signal' })
    );
    expect(result.metadata.source).toBe('gfs');
  });

  test('generateOverlay 在后端失败时应回退到前端 Canvas 方案', async () => {
    jest.spyOn(service, 'fetchBackendOverlay').mockRejectedValue(new Error('backend down'));

    const result = await service.generateOverlay(
      { lat: 39.9, lon: 116.4 },
      [{ lat: 39.95, lon: 116.45, score: 80 }],
      200,
      'sunset'
    );

    expect(service.fetchBackendOverlay).toHaveBeenCalled();
    expect(result.metadata.source).toBe('frontend');
    expect(result.dataUrl.startsWith('data:image/png')).toBe(true);
  });

  test('displayOnMap 应调用 mapService.addImageOverlay 并返回 true', () => {
    // Force image-overlay mode
    localStorage.setItem('firecloud_render_mode', 'image-overlay');

    const mapService = { addImageOverlay: jest.fn(() => ({ remove: jest.fn() })) };

    const ok = service.displayOnMap(
      mapService,
      { dataUrl: 'data:image/png;base64,abc', bounds: { north: 10, south: 9, east: 11, west: 8 } },
      document.getElementById('map-container')
    );

    expect(ok).toBe(true);
    expect(mapService.addImageOverlay).toHaveBeenCalled();
  });

  test('refresh 在地图存在时应重新生成并重新显示覆盖层', async () => {
    service.mapService = { addImageOverlay: jest.fn(() => ({ remove: jest.fn() })) };
    jest.spyOn(service, 'generateOverlay').mockResolvedValue({
      dataUrl: 'data:image/png;base64,new',
      bounds: { north: 1, south: -1, east: 1, west: -1 },
      metadata: { source: 'frontend' }
    });
    const displaySpy = jest.spyOn(service, 'displayOnMap').mockReturnValue(true);

    const ok = await service.refresh({ lat: 30, lon: 120 }, [{ lat: 30.5, lon: 120.5, score: 90 }], 200, 'sunrise');

    expect(ok).toBe(true);
    expect(service.generateOverlay).toHaveBeenCalled();
    expect(displaySpy).toHaveBeenCalled();
  });
});
