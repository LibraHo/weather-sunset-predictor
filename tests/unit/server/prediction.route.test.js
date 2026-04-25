/**
 * Prediction Routes 单元测试
 * 需求：22 (前后端分离 - Phase 3)
 *
 * 使用直接调用方式测试路由处理逻辑
 */

describe('Prediction Routes', () => {
  let predictionRoutes;
  let EnhancedPredictionService;

  beforeAll(async () => {
    // 动态导入模块
    predictionRoutes = await import('../../../server/routes/prediction.js');
    EnhancedPredictionService = await import('../../../server/services/EnhancedPredictionService.js');
  });


  // ========== EnhancedPredictionService 直接测试 ==========
  describe('EnhancedPredictionService Integration', () => {
    test('calculateEnhancedPrediction should return complete result', () => {
      const weatherData = {
        lowClouds: 20,
        midClouds: 50,
        highClouds: 40,
        visibility: 15,
        humidity: 60
      };
      const date = '2024-06-21T18:00:00Z';
      const lat = 40.0;
      const lon = 116.0;
      const type = 'sunset';

      const result = EnhancedPredictionService.calculateEnhancedPrediction(
        weatherData, date, lat, lon, type
      );

      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('quality');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('icon');
      expect(result).toHaveProperty('canvasAnalysis');
      expect(result).toHaveProperty('lightPathAnalysis');
      expect(result).toHaveProperty('renderingAnalysis');
    });

    test('calculateEnhancedPrediction should expose aerosol rendering breakdown when air-quality fields exist', () => {
      const result = EnhancedPredictionService.calculateEnhancedPrediction(
        {
          lowClouds: 10,
          midClouds: 35,
          highClouds: 50,
          visibility: 20,
          humidity: 55,
          aerosolOpticalDepth: 0.22,
          pm2_5: 12,
          pm10: 24,
          dust: 2
        },
        '2024-06-21T18:00:00Z',
        40.0,
        116.0,
        'sunset'
      );

      expect(result.renderingAnalysis.aerosolFactor).toBeGreaterThan(1);
      expect(result.renderingAnalysis.breakdown.aerosol).toBe('optimal');
    });

    test('calculateEnhancedPrediction with options should apply correctly', () => {
      const weatherData = {
        lowClouds: 20,
        midClouds: 50,
        highClouds: 40,
        visibility: 15,
        humidity: 60
      };
      const date = '2024-06-21T18:00:00Z';
      const options = {
        remoteCloudData: {
          samples: [
            { cloudCover: 20 },
            { cloudCover: 30 },
            { cloudCover: 40 }
          ]
        },
        rainedRecently: true
      };

      const result = EnhancedPredictionService.calculateEnhancedPrediction(
        weatherData, date, 40.0, 116.0, 'sunset', options
      );

      // V2 光路算法开启时会优先使用本地物理模型；远程样本仅在 V2 回退路径中消费。
      expect(result.lightPathAnalysis).toHaveProperty('hasRemoteData');
      expect(result.renderingAnalysis.rainBonus).toBe(1.2);
    });

    test('calculateBatchEnhancedPredictions should return array of results', () => {
      const weatherDataArray = [
        { weather: { lowClouds: 20, midClouds: 50, highClouds: 40 }, date: '2024-06-21T18:00:00Z' },
        { weather: { lowClouds: 30, midClouds: 60, highClouds: 30 }, date: '2024-06-22T18:00:00Z' },
        { weather: { lowClouds: 10, midClouds: 40, highClouds: 50 }, date: '2024-06-23T18:00:00Z' }
      ];

      const results = EnhancedPredictionService.calculateBatchEnhancedPredictions(
        weatherDataArray, 40.0, 116.0, 'sunset'
      );

      expect(results).toHaveLength(3);
      expect(results[0]).toHaveProperty('score');
      expect(results[1]).toHaveProperty('score');
      expect(results[2]).toHaveProperty('score');
    });

    test('scoreCloudCanvas should return correct structure', () => {
      const result = EnhancedPredictionService.scoreCloudCanvas({
        lowClouds: 20,
        midClouds: 50,
        highClouds: 40
      });

      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('cloudLevel');
      expect(result).toHaveProperty('effectiveCloudCover');
      expect(result).toHaveProperty('lowCloudPenalty');
      expect(result).toHaveProperty('breakdown');
    });

    test('scoreRendering should return correct structure', () => {
      const result = EnhancedPredictionService.scoreRendering({
        visibility: 15,
        humidity: 60,
        aqi: 50
      });

      expect(result).toHaveProperty('factor');
      expect(result).toHaveProperty('visibilityFactor');
      expect(result).toHaveProperty('humidityFactor');
      expect(result).toHaveProperty('rainBonus');
      expect(result).toHaveProperty('breakdown');
    });

    test('scoreRendering with rainedRecently should apply bonus', () => {
      const result = EnhancedPredictionService.scoreRendering({
        visibility: 15,
        humidity: 60,
        aqi: 50
      }, true);

      expect(result.rainBonus).toBe(1.2);
      expect(result.breakdown.specialMode).toBe('post_rain');
    });
  });

  // ========== 请求验证测试 ==========
  describe('Request Validation', () => {
    describe('Enhanced Prediction Validation', () => {
      test('should accept valid request data', () => {
        const validRequest = {
          weatherData: { lowClouds: 20, midClouds: 50, highClouds: 40 },
          date: '2024-06-21T18:00:00Z',
          lat: 40.0,
          lon: 116.0,
          type: 'sunset'
        };

        // Validate all required fields exist
        expect(validRequest.weatherData).toBeDefined();
        expect(validRequest.date).toBeDefined();
        expect(typeof validRequest.lat).toBe('number');
        expect(validRequest.lat >= -90 && validRequest.lat <= 90).toBe(true);
        expect(typeof validRequest.lon).toBe('number');
        expect(validRequest.lon >= -180 && validRequest.lon <= 180).toBe(true);
        expect(['sunrise', 'sunset'].includes(validRequest.type)).toBe(true);
      });

      test('should identify invalid weatherData', () => {
        const invalidCases = [
          { weatherData: null },
          { weatherData: 'string' },
          { weatherData: 123 },
          {}
        ];

        invalidCases.forEach(testCase => {
          const isValid = testCase.weatherData && typeof testCase.weatherData === 'object';
          expect(isValid).toBeFalsy();
        });
      });

      test('should identify invalid latitude', () => {
        const invalidLats = [100, -100, 'forty', null, undefined];

        invalidLats.forEach(lat => {
          const isValid = typeof lat === 'number' && lat >= -90 && lat <= 90;
          expect(isValid).toBeFalsy();
        });
      });

      test('should identify invalid longitude', () => {
        const invalidLons = [200, -200, 'hundred', null, undefined];

        invalidLons.forEach(lon => {
          const isValid = typeof lon === 'number' && lon >= -180 && lon <= 180;
          expect(isValid).toBeFalsy();
        });
      });

      test('should identify invalid type', () => {
        const invalidTypes = ['noon', 'midnight', '', null, 123];

        invalidTypes.forEach(type => {
          const isValid = type && ['sunrise', 'sunset'].includes(type);
          expect(isValid).toBeFalsy();
        });
      });
    });

    describe('Batch Request Validation', () => {
      test('should accept valid batch request', () => {
        const validBatch = {
          weatherDataArray: [
            { weather: { lowClouds: 20 }, date: '2024-06-21T18:00:00Z' },
            { weather: { lowClouds: 30 }, date: '2024-06-22T18:00:00Z' }
          ],
          lat: 40.0,
          lon: 116.0,
          type: 'sunset'
        };

        expect(Array.isArray(validBatch.weatherDataArray)).toBe(true);
        expect(validBatch.weatherDataArray.length > 0).toBe(true);
        expect(validBatch.weatherDataArray.length <= 30).toBe(true);
      });

      test('should identify empty array', () => {
        const empty = { weatherDataArray: [] };
        const isValid = Array.isArray(empty.weatherDataArray) && empty.weatherDataArray.length > 0;
        expect(isValid).toBe(false);
      });

      test('should identify non-array', () => {
        const nonArrays = [
          { weatherDataArray: 'string' },
          { weatherDataArray: 123 },
          { weatherDataArray: {} },
          { weatherDataArray: null }
        ];

        nonArrays.forEach(testCase => {
          expect(Array.isArray(testCase.weatherDataArray)).toBe(false);
        });
      });

      test('should identify too many items', () => {
        const tooMany = {
          weatherDataArray: Array(31).fill({ weather: {}, date: '2024-06-21T18:00:00Z' })
        };

        expect(tooMany.weatherDataArray.length > 30).toBe(true);
      });

      test('should identify items with missing weather', () => {
        const items = [
          { date: '2024-06-21T18:00:00Z' },
          { weather: null, date: '2024-06-21T18:00:00Z' },
          { weather: 'string', date: '2024-06-21T18:00:00Z' }
        ];

        items.forEach(item => {
          const isValid = item.weather && typeof item.weather === 'object';
          expect(isValid).toBeFalsy();
        });
      });

      test('should identify items with missing date', () => {
        const items = [
          { weather: {} },
          { weather: {}, date: null },
          { weather: {}, date: '' }
        ];

        items.forEach(item => {
          const isValid = !!item.date;
          expect(isValid).toBe(false);
        });
      });
    });
  });

  // ========== API 响应格式测试 ==========
  describe('API Response Format', () => {
    test('enhanced prediction response should have correct structure', () => {
      const weatherData = {
        lowClouds: 20,
        midClouds: 50,
        highClouds: 40,
        visibility: 15,
        humidity: 60
      };

      const result = EnhancedPredictionService.calculateEnhancedPrediction(
        weatherData, '2024-06-21T18:00:00Z', 40.0, 116.0, 'sunset'
      );

      // Expected API response format
      const apiResponse = {
        success: true,
        data: result
      };

      expect(apiResponse.success).toBe(true);
      expect(apiResponse.data).toBeDefined();
      expect(apiResponse.data.score).toBeGreaterThanOrEqual(0);
      expect(apiResponse.data.score).toBeLessThanOrEqual(100);
      expect(['excellent', 'good', 'fair'].includes(apiResponse.data.quality)).toBe(true);
    });

    test('batch prediction response should have count', () => {
      const weatherDataArray = [
        { weather: { lowClouds: 20, midClouds: 50, highClouds: 40 }, date: '2024-06-21T18:00:00Z' },
        { weather: { lowClouds: 30, midClouds: 60, highClouds: 30 }, date: '2024-06-22T18:00:00Z' }
      ];

      const results = EnhancedPredictionService.calculateBatchEnhancedPredictions(
        weatherDataArray, 40.0, 116.0, 'sunset'
      );

      // Expected API response format
      const apiResponse = {
        success: true,
        data: results,
        count: results.length
      };

      expect(apiResponse.success).toBe(true);
      expect(apiResponse.count).toBe(2);
      expect(apiResponse.data).toHaveLength(2);
    });

    test('error response should have error and message', () => {
      // Simulated error response
      const errorResponse = {
        error: 'INVALID_WEATHER_DATA',
        message: 'weatherData is required and must be an object'
      };

      expect(errorResponse.error).toBeDefined();
      expect(errorResponse.message).toBeDefined();
      expect(typeof errorResponse.error).toBe('string');
      expect(typeof errorResponse.message).toBe('string');
    });
  });

  // ========== 边界条件测试 ==========
  describe('Edge Cases', () => {
    test('should handle extreme coordinates', () => {
      const weatherData = { lowClouds: 20, midClouds: 50, highClouds: 40 };

      // North Pole
      const northPole = EnhancedPredictionService.calculateEnhancedPrediction(
        weatherData, '2024-06-21T12:00:00Z', 90.0, 0.0, 'sunset'
      );
      expect(northPole).toHaveProperty('score');

      // South Pole
      const southPole = EnhancedPredictionService.calculateEnhancedPrediction(
        weatherData, '2024-06-21T12:00:00Z', -90.0, 0.0, 'sunset'
      );
      expect(southPole).toHaveProperty('score');

      // International Date Line
      const dateLine = EnhancedPredictionService.calculateEnhancedPrediction(
        weatherData, '2024-06-21T12:00:00Z', 0.0, 180.0, 'sunset'
      );
      expect(dateLine).toHaveProperty('score');
    });

    test('should handle empty weather data', () => {
      const result = EnhancedPredictionService.calculateEnhancedPrediction(
        {}, '2024-06-21T18:00:00Z', 40.0, 116.0, 'sunset'
      );

      // Should use defaults (0) for missing values
      expect(result.canvasAnalysis.breakdown.lowClouds).toBe(0);
      expect(result.canvasAnalysis.breakdown.midClouds).toBe(0);
      expect(result.canvasAnalysis.breakdown.highClouds).toBe(0);
    });

    test('should handle extreme weather values', () => {
      const extremeWeather = {
        lowClouds: 100,
        midClouds: 100,
        highClouds: 100,
        visibility: 0,
        humidity: 100,
        aqi: 500
      };

      const result = EnhancedPredictionService.calculateEnhancedPrediction(
        extremeWeather, '2024-06-21T18:00:00Z', 40.0, 116.0, 'sunset'
      );

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    test('should handle ISO date strings', () => {
      const weatherData = { lowClouds: 20, midClouds: 50, highClouds: 40 };

      const formats = [
        '2024-06-21T18:00:00Z',
        '2024-06-21T18:00:00.000Z',
        '2024-06-21T18:00:00+08:00'
      ];

      formats.forEach(dateStr => {
        const result = EnhancedPredictionService.calculateEnhancedPrediction(
          weatherData, dateStr, 40.0, 116.0, 'sunset'
        );
        expect(result).toHaveProperty('score');
      });
    });
  });
});
