import { jest } from '@jest/globals';
import { TextEncoder, TextDecoder } from 'node:util';
import express from 'express';

if (!global.TextEncoder) {
  global.TextEncoder = TextEncoder;
}

if (!global.TextDecoder) {
  global.TextDecoder = TextDecoder;
}

import weatherRouter from '../../../server/routes/weather.js';
import orchestrator from '../../../server/services/ProviderOrchestrator.js';

describe('weather route - remove X-Windy-API-Key passthrough', () => {
  const original = orchestrator.fetchWeatherData;

  afterEach(() => {
    orchestrator.fetchWeatherData = original;
  });

  test('should call orchestrator with 4 args even if X-Windy-API-Key is provided', async () => {
    const spy = jest.fn(async () => ({
      hours: 24,
      data: [],
      providerMeta: { name: 'openmeteo', dataQuality: 'excellent' }
    }));
    orchestrator.fetchWeatherData = spy;

    const app = express();
    app.use('/api/weather', weatherRouter);

    const supertestModule = await import('supertest');
    const request = supertestModule.default || supertestModule;

    await request(app)
      .get('/api/weather/forecast?lat=39.9&lon=116.4&hours=24')
      .set('X-Windy-API-Key', 'should-be-ignored')
      .expect(200);

    expect(spy).toHaveBeenCalledTimes(1);
    // 当前业务逻辑已改为 4 参数（含 model），断言对齐实际行为
    expect(spy.mock.calls[0]).toHaveLength(4);
    expect(spy.mock.calls[0].slice(0, 3)).toEqual([39.9, 116.4, 24]);
  });
});
