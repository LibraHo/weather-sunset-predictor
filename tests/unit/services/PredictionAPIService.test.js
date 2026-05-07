/**
 * PredictionAPIService 单元测试
 *
 * 测试前端预测 API 客户端
 *
 * 需求：22 (Phase 5 - 前端代码清理)
 */

import { jest } from '@jest/globals';
import PredictionAPIService from '../../../src/services/PredictionAPIService.js';
import SunsetPrediction from '../../../src/models/SunsetPrediction.js';

describe('PredictionAPIService', () => {
  let predictionAPI;
  let mockFetch;

  beforeEach(() => {
    predictionAPI = new PredictionAPIService('http://localhost:3000');

    // Mock global fetch
    mockFetch = jest.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ========== 初始化测试 ==========

  describe('Constructor', () => {
    test('should create instance with default base URL', () => {
      const service = new PredictionAPIService();
      expect(service.baseURL).toBe('http://localhost:3000');
      expect(service.timeout).toBe(10000);
    });

    test('should create instance with custom base URL', () => {
      const service = new PredictionAPIService('http://api.example.com:8080');
      expect(service.baseURL).toBe('http://api.example.com:8080');
    });
  });

  // ========== calculate() 方法测试 ==========

  describe('calculate()', () => {
    const mockWeatherData = {
      cloudCover: 50,
      humidity: 60,
      visibility: 10,
      lowCloudCover: 30,
      highClouds: 40,
      midClouds: 50,
      lowClouds: 30
    };

    const mockDate = new Date('2024-06-21T18:00:00Z');
    const mockLat = 39.9;
    const mockLon = 116.4;

    const mockSuccessResponse = {
      success: true,
      data: {
        date: '2024-06-21T18:00:00Z',
        score: 75,
        quality: 'excellent',
        factors: {
          cloudCover: { value: 50, score: 80 },
          humidity: { value: 60, score: 70 }
        },
        sunsetTime: '2024-06-21T19:30:00Z',
        sunriseTime: '2024-06-21T05:00:00Z',
        type: 'sunset',
        goldenHour: {
          start: '2024-06-21T18:45:00Z',
          end: '2024-06-21T19:30:00Z'
        },
        blueHour: {
          start: '2024-06-21T19:30:00Z',
          end: '2024-06-21T20:00:00Z'
        },
        sunAzimuth: 290,
        cloudLayers: { high: 40, mid: 50, low: 30 }
      }
    };

    test('should successfully call backend API and return prediction', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSuccessResponse
      });

      const result = await predictionAPI.calculate(
        mockWeatherData,
        mockDate,
        mockLat,
        mockLon,
        'sunset'
      );

      // 验证返回类型
      expect(result).toBeInstanceOf(SunsetPrediction);
      expect(result.score).toBe(75);
      expect(result.quality).toBe('excellent');
      expect(result.type).toBe('sunset');

      // 验证 fetch 调用
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('http://localhost:3000/api/prediction/enhanced');
      expect(options.method).toBe('POST');
      expect(options.headers['Content-Type']).toBe('application/json');

      // 验证请求体
      const body = JSON.parse(options.body);
      expect(body.lat).toBe(mockLat);
      expect(body.lon).toBe(mockLon);
      expect(body.type).toBe('sunset');
      expect(body.referenceTime).toBe(mockDate.toISOString());
      expect(body.weatherData).toBeUndefined();
    });

    test('should handle date as Date object', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSuccessResponse
      });

      await predictionAPI.calculate(mockWeatherData, new Date('2024-06-21'), mockLat, mockLon);

      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.date).toContain('2024-06-21');
    });

    test('should handle date as string', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSuccessResponse
      });

      await predictionAPI.calculate(mockWeatherData, '2024-06-21T18:00:00Z', mockLat, mockLon);

      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.date).toBe('2024-06-21T18:00:00Z');
    });

    test('should use default type as sunset', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSuccessResponse
      });

      await predictionAPI.calculate(mockWeatherData, mockDate, mockLat, mockLon);

      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.type).toBe('sunset');
    });

    test('should throw error on API failure response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: false,
          error: { message: '服务器错误' }
        })
      });

      await expect(
        predictionAPI.calculate(mockWeatherData, mockDate, mockLat, mockLon)
      ).rejects.toThrow('后端预测 API 调用失败');
    });

    test('should throw error on HTTP error status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ error: { message: '服务器内部错误' } })
      });

      await expect(
        predictionAPI.calculate(mockWeatherData, mockDate, mockLat, mockLon)
      ).rejects.toThrow('后端预测 API 调用失败');
    });

    test('should throw error on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        predictionAPI.calculate(mockWeatherData, mockDate, mockLat, mockLon)
      ).rejects.toThrow('后端预测 API 调用失败');
    });

    test('should omit frontend weather data for backend closed-loop prediction', async () => {
      const minimalWeatherData = {
        cloudCover: 50,
        humidity: 60
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSuccessResponse
      });

      await predictionAPI.calculate(minimalWeatherData, mockDate, mockLat, mockLon);

      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.weatherData).toBeUndefined();
      expect(body.options).toBeUndefined();
      expect(body.lat).toBe(mockLat);
      expect(body.lon).toBe(mockLon);
    });
  });

  // ========== getSurrounding() 方法测试 ==========

  describe('getSurrounding()', () => {
    const mockLat = 39.9;
    const mockLon = 116.4;

    const mockSurroundingResponse = {
      success: true,
      data: {
        center: { lat: 39.9, lon: 116.4 },
        radius: 100,
        type: 'sunset',
        date: '2024-06-21T00:00:00Z',
        points: [
          {
            direction: 'N',
            name: '北',
            angle: 0,
            label: 'N',
            lat: 40.8,
            lon: 116.4,
            distance: 100,
            score: 75,
            quality: 'excellent',
            error: null
          },
          {
            direction: 'NE',
            name: '东北',
            angle: 45,
            label: 'NE',
            lat: 40.5,
            lon: 117.1,
            distance: 100,
            score: 82,
            quality: 'excellent',
            error: null
          }
        ],
        bestDirection: {
          direction: 'NE',
          name: '东北',
          score: 82,
          quality: 'excellent',
          location: { lat: 40.5, lon: 117.1 }
        },
        timestamp: Date.now()
      }
    };

    test('should successfully call surrounding API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSurroundingResponse
      });

      const result = await predictionAPI.getSurrounding(mockLat, mockLon);

      expect(result.center.lat).toBe(39.9);
      expect(result.center.lon).toBe(116.4);
      expect(result.radius).toBe(100);
      expect(result.points).toHaveLength(2);
      expect(result.bestDirection.direction).toBe('NE');

      // 验证 fetch 调用
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('http://localhost:3000/api/prediction/surrounding');
      expect(options.method).toBe('POST');
    });

    test('should use default parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSurroundingResponse
      });

      await predictionAPI.getSurrounding(mockLat, mockLon);

      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.radius).toBe(100);
      expect(body.type).toBe('sunset');
    });

    test('should accept custom radius', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSurroundingResponse
      });

      await predictionAPI.getSurrounding(mockLat, mockLon, 150, 'sunrise');

      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.radius).toBe(150);
      expect(body.type).toBe('sunrise');
    });

    test('should handle date parameter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSurroundingResponse
      });

      const date = new Date('2024-06-21');
      await predictionAPI.getSurrounding(mockLat, mockLon, 100, 'sunset', date);

      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.date).toContain('2024-06-21');
    });

    test('should throw error on API failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: false,
          error: { message: '周边预测失败' }
        })
      });

      await expect(
        predictionAPI.getSurrounding(mockLat, mockLon)
      ).rejects.toThrow('后端周边预测 API 调用失败');
    });

    test('should throw error on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      await expect(
        predictionAPI.getSurrounding(mockLat, mockLon)
      ).rejects.toThrow('后端周边预测 API 调用失败');
    });
  });

  // ========== checkHealth() 方法测试 ==========

  describe('checkHealth()', () => {
    test('should return true when API is healthy', async () => {
      // Mock AbortSignal.timeout if not available
      if (!AbortSignal.timeout) {
        global.AbortSignal = {
          ...global.AbortSignal,
          timeout: (ms) => {
            const controller = new AbortController();
            setTimeout(() => controller.abort(), ms);
            return controller.signal;
          }
        };
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'ok' })
      });

      const result = await predictionAPI.checkHealth();
      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/health',
        expect.objectContaining({ method: 'GET' })
      );
    });

    test('should return false when API returns error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      const result = await predictionAPI.checkHealth();
      expect(result).toBe(false);
    });

    test('should return false on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await predictionAPI.checkHealth();
      expect(result).toBe(false);
    });
  });

  // ========== _convertToPrediction() 方法测试 ==========

  describe('_convertToPrediction()', () => {
    test('should convert backend response to SunsetPrediction', () => {
      const backendData = {
        date: '2024-06-21T18:00:00Z',
        score: 80,
        quality: 'excellent',
        factors: { cloudCover: { value: 50, score: 85 } },
        sunsetTime: '2024-06-21T19:30:00Z',
        sunriseTime: '2024-06-21T05:00:00Z',
        type: 'sunset',
        goldenHour: {
          start: '2024-06-21T18:45:00Z',
          end: '2024-06-21T19:30:00Z'
        },
        blueHour: {
          start: '2024-06-21T19:30:00Z',
          end: '2024-06-21T20:00:00Z'
        },
        sunAzimuth: 285,
        cloudLayers: { high: 30, mid: 50, low: 20 }
      };

      const prediction = predictionAPI._convertToPrediction(backendData);

      expect(prediction).toBeInstanceOf(SunsetPrediction);
      expect(prediction.score).toBe(80);
      expect(prediction.quality).toBe('excellent');
      expect(prediction.type).toBe('sunset');
      expect(prediction.sunAzimuth).toBe(285);
      expect(prediction.cloudLayers).toEqual({ high: 30, mid: 50, low: 20 });

      // 验证日期转换
      expect(prediction.date).toBeInstanceOf(Date);
      expect(prediction.sunsetTime).toBeInstanceOf(Date);
      expect(prediction.goldenHour.start).toBeInstanceOf(Date);
    });
  });
});
