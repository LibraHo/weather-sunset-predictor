/**
 * LightPath V2 集成测试 - 增强预测接口输出完整性
 * 需求：35，任务：58.2
 */

import express from 'express';
import { TextEncoder, TextDecoder } from 'node:util';

if (!global.TextEncoder) {
  global.TextEncoder = TextEncoder;
}
if (!global.TextDecoder) {
  global.TextDecoder = TextDecoder;
}

describe('LightPath V2 集成测试 - /api/prediction/enhanced', () => {
  let app;
  let request;

  const basePayload = {
    date: '2024-06-21T11:00:00Z', // UTC 11:00 = 北京 19:00，日落时间
    lat: 39.9042,
    lon: 116.4074,
    type: 'sunset'
  };

  beforeAll(async () => {
    const predictionRouterModule = await import('../../../server/routes/prediction.js');
    const supertestModule = await import('supertest');
    const predictionRouter = predictionRouterModule.default || predictionRouterModule;
    request = supertestModule.default || supertestModule;

    app = express();
    app.use(express.json());
    app.use('/api/prediction', predictionRouter);
  });

  // 1. 返回结构中 lightPathAnalysis 包含必要字段
  test('lightPathAnalysis 包含 score、occlusionProbability、samples、capReason、explain', async () => {
    const res = await request(app)
      .post('/api/prediction/enhanced')
      .send({
        ...basePayload,
        weatherData: {
          cloudCover: 40,
          lowClouds: 10,
          midClouds: 20,
          highClouds: 30,
          cloudBaseHeight: 2000,
          humidity: 60,
          visibility: 20,
          precipitation: 0,
          convPrecip: 0
        }
      })
      .expect(200);

    expect(res.body.success).toBe(true);
    const lp = res.body.data.lightPathAnalysis;
    expect(lp).toBeDefined();
    expect(lp).toHaveProperty('score');
    expect(lp).toHaveProperty('occlusionProbability');
    expect(lp).toHaveProperty('samples');
    expect(lp).toHaveProperty('capReason');
    expect(lp).toHaveProperty('explain');
    expect(Array.isArray(lp.samples)).toBe(true);
    expect(lp.samples.length).toBeGreaterThanOrEqual(3);
  });

  // 2. samples 每项包含必要字段
  test('samples 每项包含 distanceKm、cloudBaseHeight、criticalElevation、block', async () => {
    const res = await request(app)
      .post('/api/prediction/enhanced')
      .send({
        ...basePayload,
        weatherData: {
          cloudCover: 40,
          lowClouds: 10,
          midClouds: 20,
          highClouds: 30,
          cloudBaseHeight: 2000,
          humidity: 60,
          visibility: 20,
          precipitation: 0,
          convPrecip: 0
        }
      })
      .expect(200);

    const samples = res.body.data.lightPathAnalysis.samples;
    expect(samples.length).toBeGreaterThanOrEqual(3);
    for (const sample of samples) {
      expect(sample).toHaveProperty('distanceKm');
      expect(sample).toHaveProperty('cloudBaseHeight');
      expect(sample).toHaveProperty('criticalElevation');
      expect(sample).toHaveProperty('block');
    }
  });

  // 3. cloudCover=100 → score <= 40，capReason 不为 null
  test('cloudCover=100 时 lightPathAnalysis.score <= 40，capReason 不为 null', async () => {
    const res = await request(app)
      .post('/api/prediction/enhanced')
      .send({
        ...basePayload,
        weatherData: {
          cloudCover: 100,
          lowClouds: 100,
          midClouds: 80,
          highClouds: 60,
          cloudBaseHeight: 700,
          humidity: 90,
          visibility: 5,
          precipitation: 0,
          convPrecip: 0,
          weatherCode: 3
        }
      })
      .expect(200);

    const lp = res.body.data.lightPathAnalysis;
    expect(lp.score).toBeLessThanOrEqual(40);
    expect(lp.capReason).not.toBeNull();
  });

  // 4. cloudCover=0 → 晴天高分 >= 60
  test('cloudCover=0 时 lightPathAnalysis.score >= 60（晴天高分）', async () => {
    const res = await request(app)
      .post('/api/prediction/enhanced')
      .send({
        ...basePayload,
        weatherData: {
          cloudCover: 0,
          lowClouds: 0,
          midClouds: 0,
          highClouds: 0,
          cloudBaseHeight: 5000,
          humidity: 30,
          visibility: 30,
          precipitation: 0,
          convPrecip: 0
        }
      })
      .expect(200);

    const lp = res.body.data.lightPathAnalysis;
    expect(lp.score).toBeGreaterThanOrEqual(60);
  });

  // 5. lightPath.score 范围在 0-100 之间
  test('lightPathAnalysis.score 范围在 0-100 之间', async () => {
    const testCases = [
      { cloudCover: 0, lowClouds: 0, midClouds: 0, highClouds: 0, cloudBaseHeight: 5000, precipitation: 0, convPrecip: 0 },
      { cloudCover: 50, lowClouds: 40, midClouds: 50, highClouds: 20, cloudBaseHeight: 1500, precipitation: 0, convPrecip: 0 },
      { cloudCover: 100, lowClouds: 100, midClouds: 80, highClouds: 60, cloudBaseHeight: 700, precipitation: 0, convPrecip: 0 }
    ];

    for (const weatherData of testCases) {
      const res = await request(app)
        .post('/api/prediction/enhanced')
        .send({ ...basePayload, weatherData })
        .expect(200);

      const score = res.body.data.lightPathAnalysis.score;
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });
});
