import { jest } from '@jest/globals';
import SurroundingPointsService from '../../../src/services/SurroundingPointsService.js';
import WeatherData from '../../../src/models/WeatherData.js';

describe('SurroundingPointsService', () => {
  let service;

  beforeEach(() => {
    service = new SurroundingPointsService();
  });

  test('calculateSurroundingPoints 应返回8个方向且距离接近半径', () => {
    const points = service.calculateSurroundingPoints(39.9, 116.4, 100);

    expect(points).toHaveLength(8);
    expect(points.map((p) => p.direction)).toEqual(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']);

    expect(points.find((p) => p.direction === 'N').lat).toBeGreaterThan(39.9);
    expect(points.find((p) => p.direction === 'S').lat).toBeLessThan(39.9);
    expect(points.find((p) => p.direction === 'E').lon).toBeGreaterThan(116.4);
  });

  test('getSurroundingData 应并行获取并聚合8个方向数据', async () => {
    const weatherData = new WeatherData(new Date(), 20, 50, 6, 8, 0, 0, 30, 0, null, null, null);
    const fetcher = jest.fn(async () => weatherData);
    const predictor = jest.fn(() => ({ score: 88 }));

    const result = await service.getSurroundingData({ lat: 39.9, lon: 116.4, name: '北京' }, 120, fetcher, predictor);

    expect(fetcher).toHaveBeenCalledTimes(8);
    expect(predictor).toHaveBeenCalledTimes(8);
    expect(result.points).toHaveLength(8);
    expect(result.points.every((p) => p.error === null && p.score === 88)).toBe(true);
  });

  test('getSurroundingData 在单个方向失败时应隔离错误，不影响其余方向', async () => {
    const fetcher = jest.fn(async (location) => {
      if (location.name === '东') throw new Error('network failed');
      return new WeatherData(new Date(), 19, 48, 5, 7, 0, 0, 20, 0, null, null, null);
    });
    const predictor = jest.fn(() => ({ score: 75 }));

    const result = await service.getSurroundingData({ lat: 31.2, lon: 121.5, name: '上海' }, 100, fetcher, predictor);

    const failed = result.points.find((p) => p.name === '东');
    expect(failed.error).toBe('network failed');
    expect(result.points.filter((p) => p.error === null)).toHaveLength(7);
  });
});
