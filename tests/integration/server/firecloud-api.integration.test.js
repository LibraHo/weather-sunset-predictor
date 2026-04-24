import { jest } from '@jest/globals';
import express from 'express';
import { TextEncoder, TextDecoder } from 'node:util';

if (!global.TextEncoder) {
  global.TextEncoder = TextEncoder;
}

if (!global.TextDecoder) {
  global.TextDecoder = TextDecoder;
}

describe('FireCloud API Integration', () => {
  let app;
  let request;
  let fireCloudServicePrototype;
  let mockGenerateOverlay;
  let mockHealthCheck;
  let mockClearCache;
  let originalGenerateOverlay;
  let originalHealthCheck;
  let originalClearCache;
  let fireCloudTileServicePrototype;
  let mockGetGrid;
  let mockGetTilePng;
  let originalGetGrid;
  let originalGetTilePng;

  beforeAll(async () => {
    const supertestModule = await import('supertest');
    const FireCloudServiceModule = await import('../../../server/services/FireCloudService.js');
    const FireCloudTileServiceModule = await import('../../../server/services/FireCloudTileService.js');

    request = supertestModule.default || supertestModule;

    const FireCloudService = FireCloudServiceModule.default || FireCloudServiceModule;
    fireCloudServicePrototype = FireCloudService.prototype;

    originalGenerateOverlay = fireCloudServicePrototype.generateOverlay;
    originalHealthCheck = fireCloudServicePrototype.healthCheck;
    originalClearCache = fireCloudServicePrototype.clearCache;

    mockGenerateOverlay = jest.fn();
    mockHealthCheck = jest.fn();
    mockClearCache = jest.fn();

    fireCloudServicePrototype.generateOverlay = mockGenerateOverlay;
    fireCloudServicePrototype.healthCheck = mockHealthCheck;
    fireCloudServicePrototype.clearCache = mockClearCache;

    const FireCloudTileService = FireCloudTileServiceModule.default || FireCloudTileServiceModule;
    fireCloudTileServicePrototype = FireCloudTileService.prototype;
    originalGetGrid = fireCloudTileServicePrototype.getGrid;
    originalGetTilePng = fireCloudTileServicePrototype.getTilePng;
    mockGetGrid = jest.fn();
    mockGetTilePng = jest.fn();
    fireCloudTileServicePrototype.getGrid = mockGetGrid;
    fireCloudTileServicePrototype.getTilePng = mockGetTilePng;

    const firecloudRouterModule = await import('../../../server/routes/firecloud.js');
    const firecloudRouter = firecloudRouterModule.default || firecloudRouterModule;

    app = express();
    app.use(express.json());
    app.use('/api/firecloud', firecloudRouter);
  });


  beforeEach(() => {
    mockGenerateOverlay.mockImplementation(async (lat, lon, radius, type) => ({
      image: 'data:image/png;base64,mock-overlay',
      bounds: {
        north: lat + 0.5,
        south: lat - 0.5,
        east: lon + 0.5,
        west: lon - 0.5
      },
      radius,
      type,
      timestamp: 1700000000000
    }));

    mockHealthCheck.mockImplementation(async () => ({
      status: 'ok',
      scriptExists: true,
      scriptPath: '/mock/path/gfs_processor.py',
      cacheSize: 1,
      timestamp: 1700000000000
    }));

    mockClearCache.mockImplementation(async () => undefined);

    mockGetGrid.mockImplementation(async ({ bbox, zoom, time, type }) => ({
      type: 'FeatureCollection',
      meta: { bbox, zoom, time, type },
      values: [[88, 90], [76, 82]]
    }));

    mockGetTilePng.mockImplementation(async () => Buffer.from('mock-tile'));
  });

  afterAll(() => {
    if (fireCloudServicePrototype) {
      fireCloudServicePrototype.generateOverlay = originalGenerateOverlay;
      fireCloudServicePrototype.healthCheck = originalHealthCheck;
      fireCloudServicePrototype.clearCache = originalClearCache;
    }
    if (fireCloudTileServicePrototype) {
      fireCloudTileServicePrototype.getGrid = originalGetGrid;
      fireCloudTileServicePrototype.getTilePng = originalGetTilePng;
    }
  });

  describe('GET /api/firecloud/overlay', () => {
    test('returns overlay result for valid params', async () => {
      const res = await request(app)
        .get('/api/firecloud/overlay')
        .query({ lat: '39.9', lon: '116.4', radius: '200', type: 'sunset' })
        .expect(200);

      expect(res.body).toHaveProperty('image');
      expect(res.body).toHaveProperty('bounds');
      expect(res.body).toHaveProperty('timestamp', 1700000000000);
      expect(mockGenerateOverlay).toHaveBeenCalledWith(39.9, 116.4, 200, 'sunset');
    });

    test('rejects missing lat/lon with 400', async () => {
      const res = await request(app)
        .get('/api/firecloud/overlay')
        .query({ lat: '39.9' })
        .expect(400);

      expect(res.body).toMatchObject({
        error: '缺少必需参数'
      });
    });

    test('rejects invalid radius range with 400', async () => {
      const res = await request(app)
        .get('/api/firecloud/overlay')
        .query({ lat: '39.9', lon: '116.4', radius: '20', type: 'sunset' })
        .expect(400);

      expect(res.body.error).toBe('无效的半径');
    });

    test('maps TIMEOUT error to 504', async () => {
      mockGenerateOverlay.mockRejectedValueOnce(
        Object.assign(new Error('timeout'), { code: 'TIMEOUT', details: 'processing timeout' })
      );

      const res = await request(app)
        .get('/api/firecloud/overlay')
        .query({ lat: '39.9', lon: '116.4', radius: '200', type: 'sunset' })
        .expect(504);

      expect(res.body.error).toBe('TIMEOUT');
      expect(res.body.details).toBe('processing timeout');
    });
  });

  describe('GET /api/firecloud/health', () => {
    test('returns service health payload', async () => {
      const res = await request(app)
        .get('/api/firecloud/health')
        .expect(200);

      expect(res.body.status).toBe('ok');
      expect(res.body.scriptExists).toBe(true);
      expect(mockHealthCheck).toHaveBeenCalled();
    });
  });

  describe('POST /api/firecloud/cache/clear', () => {
    test('clears cache and returns success response', async () => {
      const res = await request(app)
        .post('/api/firecloud/cache/clear')
        .send({})
        .expect(200);

      expect(res.body).toEqual({ success: true, message: '缓存已清除' });
      expect(mockClearCache).toHaveBeenCalled();
    });
  });

  describe('GET /api/firecloud/grid', () => {
    test('returns grid data for valid bbox', async () => {
      const res = await request(app)
        .get('/api/firecloud/grid')
        .query({ bbox: '100,20,120,40', zoom: '6', time: '1700000000000' })
        .expect(200);

      expect(res.body.type).toBe('FeatureCollection');
      expect(mockGetGrid).toHaveBeenCalledWith({
        bbox: '100,20,120,40',
        zoom: 6,
        time: 1700000000000,
        type: 'sunset'
      });
    });

    test('rejects missing bbox', async () => {
      const res = await request(app)
        .get('/api/firecloud/grid')
        .expect(400);

      expect(res.body.error).toBe('缺少必需参数');
    });
  });

  describe('GET /api/firecloud/tiles/:z/:x/:y.png', () => {
    test('returns png tile', async () => {
      const res = await request(app)
        .get('/api/firecloud/tiles/6/52/24.png')
        .query({ time: '1700000000000' })
        .expect(200);

      expect(res.headers['content-type']).toContain('image/png');
      expect(mockGetTilePng).toHaveBeenCalledWith({ z: 6, x: 52, y: 24, time: 1700000000000, type: 'sunset' });
      expect(Buffer.isBuffer(res.body)).toBe(true);
    });
  });
});
