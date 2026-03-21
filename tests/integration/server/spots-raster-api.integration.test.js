/**
 * spots raster API 集成测试
 * 测试 /api/spots/china/raster 端点
 */

const express = require('express');
const request = require('supertest');
const spotsRouter = require('../../../server/routes/spots');

describe('POST /api/spots/china/raster', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/spots', spotsRouter);
  });

  describe('基本功能测试', () => {
    it('应该返回栅格数据结构', async () => {
      const response = await request(app)
        .get('/api/spots/china/raster')
        .expect('Content-Type', /json/);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('date');
      expect(response.body).toHaveProperty('updatedAt');
      expect(response.body).toHaveProperty('bbox');
      expect(response.body).toHaveProperty('resolution');
      expect(response.body).toHaveProperty('width');
      expect(response.body).toHaveProperty('height');
      expect(response.body).toHaveProperty('valueRange');
      expect(response.body).toHaveProperty('noData');
      expect(response.body).toHaveProperty('values');
      expect(response.body).toHaveProperty('meta');

      // 检查必需字段类型
      expect(typeof response.body.width).toBe('number');
      expect(typeof response.body.height).toBe('number');
      expect(Array.isArray(response.body.values)).toBe(true);
      expect(response.body.values.length).toBe(response.body.width * response.body.height);
    }, 30000);

    it('应该支持自定义 resolution 参数', async () => {
      const response = await request(app)
        .get('/api/spots/china/raster?resolution=1.0')
        .expect('Content-Type', /json/);

      expect(response.status).toBe(200);
      expect(response.body.resolution).toBe(1.0);
      expect(response.body.width).toBeLessThan(127); // 比 0.5 分辨率更粗
    }, 30000);

    it('应该支持 sunrise 和 sunset period', async () => {
      const responseSunset = await request(app)
        .get('/api/spots/china/raster?period=sunset')
        .expect('Content-Type', /json/);

      expect(responseSunset.status).toBe(200);
      expect(responseSunset.body.meta.period).toBe('sunset');

      const responseSunrise = await request(app)
        .get('/api/spots/china/raster?period=sunrise')
        .expect('Content-Type', /json/);

      expect(responseSunrise.status).toBe(200);
      expect(responseSunrise.body.meta.period).toBe('sunrise');
    }, 60000);
  });

  describe('参数验证测试', () => {
    it('应该拒绝无效的 resolution 参数', async () => {
      const response = await request(app)
        .get('/api/spots/china/raster?resolution=3.0')
        .expect('Content-Type', /json/);

      expect(response.status).toBe(400);
      expect(response.body.error).toHaveProperty('code');
      expect(response.body.error.code).toBe('INVALID_RESOLUTION');
    });

    it('应该拒绝无效的 period 参数', async () => {
      const response = await request(app)
        .get('/api/spots/china/raster?period=invalid')
        .expect('Content-Type', /json/);

      expect(response.status).toBe(400);
      expect(response.body.error).toHaveProperty('code');
      expect(response.body.error.code).toBe('INVALID_PERIOD');
    });

    it('应该拒绝 NaN 的 resolution 参数', async () => {
      const response = await request(app)
        .get('/api/spots/china/raster?resolution=abc')
        .expect('Content-Type', /json/);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_RESOLUTION');
    });
  });

  describe('数据格式测试', () => {
    it('应该返回正确的 bbox 结构', async () => {
      const response = await request(app)
        .get('/api/spots/china/raster')
        .expect('Content-Type', /json/);

      expect(response.body.bbox).toHaveProperty('west');
      expect(response.body.bbox).toHaveProperty('south');
      expect(response.body.bbox).toHaveProperty('east');
      expect(response.body.bbox).toHaveProperty('north');

      expect(response.body.bbox.west).toBeLessThan(response.body.bbox.east);
      expect(response.body.bbox.south).toBeLessThan(response.body.bbox.north);
    }, 30000);

    it('应该返回正确的 valueRange 数组', async () => {
      const response = await request(app)
        .get('/api/spots/china/raster')
        .expect('Content-Type', /json/);

      expect(Array.isArray(response.body.valueRange)).toBe(true);
      expect(response.body.valueRange).toHaveLength(2);
      expect(response.body.valueRange[0]).toBeLessThanOrEqual(response.body.valueRange[1]);
    }, 30000);

    it('values 数组应该包含有效的评分或 noData', async () => {
      const response = await request(app)
        .get('/api/spots/china/raster')
        .expect('Content-Type', /json/);

      const hasValidScore = response.body.values.some(v => v >= 0 && v <= 100);
      const hasNoData = response.body.values.includes(-1);

      expect(hasValidScore || hasNoData).toBe(true);
    }, 30000);
  });

  describe('meta 信息测试', () => {
    it('应该包含完整的 meta 信息', async () => {
      const response = await request(app)
        .get('/api/spots/china/raster')
        .expect('Content-Type', /json/);

      expect(response.body.meta).toHaveProperty('period');
      expect(response.body.meta).toHaveProperty('interpolation');
      expect(response.body.meta).toHaveProperty('idwPower');
      expect(response.body.meta).toHaveProperty('sourcePoints');
      expect(response.body.meta).toHaveProperty('cacheAge');

      expect(response.body.meta.interpolation).toBe('IDW');
      expect(response.body.meta.idwPower).toBe(2);
      expect(typeof response.body.meta.sourcePoints).toBe('number');
      expect(typeof response.body.meta.cacheAge).toBe('number');
    }, 30000);
  });
});
