/**
 * PredictionController 单元测试
 *
 * 测试预测控制器的功能，包括：
 * - 预测卡片点击事件绑定
 * - 预测详情展开和收起
 * - 详情内容渲染
 */

import PredictionController from '../../../src/controllers/PredictionController.js';

// Mock StorageService
const mockStorageService = {
  getAPIKey: () => 'test-api-key',
  getCachedWeatherData: () => null,
  setCachedWeatherData: () => {},
  getRecentSearches: () => [],
  addRecentSearch: () => {},
  clearRecentSearches: () => {},
  getFavorites: () => [],
  addFavorite: () => {},
  removeFavorite: () => {},
  isFavorite: () => false,
  getNotificationSettings: () => ({ enabled: false }),
  setNotificationSettings: () => {}
};

describe('PredictionController', () => {
  let predictionController;

  beforeEach(() => {
    // 设置 DOM 环境
    document.body.innerHTML = `
      <div id="forecast-timeline">
        <div class="forecast-item" data-index="0">
          <span class="forecast-date">2024-01-01</span>
          <span class="forecast-score">85</span>
        </div>
        <div class="forecast-item" data-index="1">
          <span class="forecast-date">2024-01-02</span>
          <span class="forecast-score">70</span>
        </div>
        <div class="forecast-item" data-index="2">
          <span class="forecast-date">2024-01-03</span>
          <span class="forecast-score">60</span>
        </div>
      </div>
      <div id="error-message" class="error-message hidden"></div>
    `;

    // 创建控制器实例
    predictionController = new PredictionController(mockStorageService);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('构造函数', () => {
    test('应该正确初始化控制器', () => {
      expect(predictionController.storageService).toBe(mockStorageService);
      expect(predictionController.predictions).toEqual([]);
      expect(predictionController.expandedPredictionIndex).toBeNull();
      expect(predictionController.predictionService).toBeTruthy();
    });
  });

  describe('bindPredictionCardEvents', () => {
    test('应该为所有预测卡片绑定点击事件', () => {
      // 创建模拟预测数据
      const mockPredictions = [
        { date: '2024-01-01', score: 85, temperature: 20 },
        { date: '2024-01-02', score: 70, temperature: 18 },
        { date: '2024-01-03', score: 60, temperature: 22 }
      ];

      predictionController.predictions = mockPredictions;
      predictionController.bindPredictionCardEvents();

      const forecastItems = document.querySelectorAll('.forecast-item');
      
      // 验证所有卡片都有 tabindex 和 role 属性
      forecastItems.forEach(item => {
        expect(item.getAttribute('tabindex')).toBe('0');
        expect(item.getAttribute('role')).toBe('button');
        expect(item.getAttribute('aria-expanded')).toBe('false');
      });
    });

    test('当没有预测卡片时应该正常处理', () => {
      document.body.innerHTML = '<div id="forecast-timeline"></div>';
      
      // 不应该抛出错误
      expect(() => {
        predictionController.bindPredictionCardEvents();
      }).not.toThrow();
    });
  });

  describe('handlePredictionCardClick', () => {
    beforeEach(() => {
      // 设置模拟预测数据
      predictionController.predictions = [
        {
          date: '2024-01-01',
          score: 85,
          temperature: 20,
          humidity: 65,
          cloudCover: 50,
          windSpeed: 10,
          pressure: 1013,
          visibility: 15,
          sunsetTime: '2024-01-01T18:30:00',
          factors: {
            cloudScore: 8.5,
            humidityScore: 7.0,
            visibilityScore: 9.0
          }
        },
        {
          date: '2024-01-02',
          score: 70,
          temperature: 18,
          humidity: 70,
          cloudCover: 60
        }
      ];
    });

    test('应该展开未展开的预测卡片', () => {
      predictionController.bindPredictionCardEvents();
      predictionController.handlePredictionCardClick(0);

      expect(predictionController.expandedPredictionIndex).toBe(0);
      
      const forecastItem = document.querySelectorAll('.forecast-item')[0];
      expect(forecastItem.classList.contains('expanded')).toBe(true);
      expect(forecastItem.getAttribute('aria-expanded')).toBe('true');
    });

    test('应该收起已展开的预测卡片', () => {
      predictionController.bindPredictionCardEvents();
      
      // 先展开
      predictionController.handlePredictionCardClick(0);
      expect(predictionController.expandedPredictionIndex).toBe(0);
      
      // 再收起
      predictionController.handlePredictionCardClick(0);
      expect(predictionController.expandedPredictionIndex).toBeNull();
    });

    test('展开新卡片时应该收起之前展开的卡片', () => {
      predictionController.bindPredictionCardEvents();
      
      // 展开第一个卡片
      predictionController.handlePredictionCardClick(0);
      expect(predictionController.expandedPredictionIndex).toBe(0);
      
      // 展开第二个卡片
      predictionController.handlePredictionCardClick(1);
      expect(predictionController.expandedPredictionIndex).toBe(1);
      
      // 第一个卡片应该被收起
      const firstItem = document.querySelectorAll('.forecast-item')[0];
      expect(firstItem.classList.contains('expanded')).toBe(false);
    });

    test('当没有预测数据时应该显示错误', () => {
      predictionController.predictions = [];
      
      // 应该不会抛出错误，而是优雅地处理
      expect(() => {
        predictionController.handlePredictionCardClick(0);
      }).not.toThrow();
      
      // expandedPredictionIndex 应该保持为 null
      expect(predictionController.expandedPredictionIndex).toBeNull();
    });

    test('当索引无效时应该记录错误', () => {
      // 应该不会抛出错误，而是优雅地处理
      expect(() => {
        predictionController.handlePredictionCardClick(-1);
      }).not.toThrow();
      
      expect(() => {
        predictionController.handlePredictionCardClick(999);
      }).not.toThrow();
      
      // expandedPredictionIndex 应该保持为 null
      expect(predictionController.expandedPredictionIndex).toBeNull();
    });
  });

  describe('renderPredictionDetails', () => {
    test('应该渲染完整的预测详情', () => {
      const prediction = {
        score: 75,
        quality: 'excellent',
        sunsetTime: new Date('2024-01-01T18:30:00'),
        factors: {
          cloudCover: { value: 50, score: 80 },
          humidity: { value: 65, score: 70 },
          visibility: { value: 15, score: 90 },
          lowClouds: { value: 10, score: 85 }
        }
      };

      const html = predictionController.renderPredictionDetails(prediction);

      // 验证包含所有关键元素
      expect(html).toContain('详细气象数据');
      expect(html).toContain('总评分');
      expect(html).toContain('65%');
      expect(html).toContain('50%');
      expect(html).toContain('15.0 km');
      expect(html).toContain('10%');
    });

    test('应该处理部分数据缺失的情况', () => {
      const prediction = {
        score: 60,
        factors: {
          cloudCover: { value: 50, score: 80 },
          humidity: { value: 65, score: 70 }
          // 其他字段缺失
        }
      };

      const html = predictionController.renderPredictionDetails(prediction);

      // 应该包含存在的数据
      expect(html).toContain('65%');
      expect(html).toContain('50%');

      // 不应该包含缺失的数据
      expect(html).not.toContain('能见度');
      expect(html).not.toContain('低云');
    });

    test('当预测对象为空时应该返回错误消息', () => {
      const html = predictionController.renderPredictionDetails(null);
      expect(html).toContain('无法加载预测详情');
    });
  });

  describe('renderDetailItem', () => {
    test('应该正确渲染详情项', () => {
      const html = predictionController.renderDetailItem('🌡️', '温度', '20°C');

      expect(html).toContain('🌡️');
      expect(html).toContain('温度');
      expect(html).toContain('20°C');
      expect(html).toContain('detail-item');
      expect(html).toContain('detail-icon');
      expect(html).toContain('detail-label');
      expect(html).toContain('detail-value');
    });
  });

  describe('formatSunsetTime', () => {
    test('应该正确格式化日期对象', () => {
      const date = new Date('2024-01-01T18:30:00');
      const formatted = predictionController.formatSunsetTime(date);
      expect(formatted).toBe('18:30');
    });

    test('应该正确格式化日期字符串', () => {
      const formatted = predictionController.formatSunsetTime('2024-01-01T18:30:00');
      expect(formatted).toBe('18:30');
    });

    test('应该处理无效的日期', () => {
      const formatted = predictionController.formatSunsetTime('invalid-date');
      expect(formatted).toBe('invalid-date');
    });

    test('应该在小时和分钟前补零', () => {
      const date = new Date('2024-01-01T09:05:00');
      const formatted = predictionController.formatSunsetTime(date);
      expect(formatted).toBe('09:05');
    });
  });

  describe('expandPredictionDetails', () => {
    test('应该创建并显示详情容器', () => {
      const prediction = {
        temperature: 20,
        humidity: 65,
        cloudCover: 50
      };

      predictionController.predictions = [prediction];
      predictionController.bindPredictionCardEvents();
      predictionController.expandPredictionDetails(0, prediction);

      const forecastItem = document.querySelectorAll('.forecast-item')[0];
      const detailsContainer = forecastItem.querySelector('.prediction-details');

      expect(detailsContainer).not.toBeNull();
      expect(forecastItem.classList.contains('expanded')).toBe(true);
      expect(forecastItem.getAttribute('aria-expanded')).toBe('true');
    });
  });

  describe('collapsePredictionDetails', () => {
    test('应该移除详情容器', (done) => {
      const prediction = {
        temperature: 20,
        humidity: 65
      };

      predictionController.predictions = [prediction];
      predictionController.bindPredictionCardEvents();
      
      // 先展开
      predictionController.expandPredictionDetails(0, prediction);
      
      // 再收起
      predictionController.collapsePredictionDetails(0);

      const forecastItem = document.querySelectorAll('.forecast-item')[0];
      expect(forecastItem.classList.contains('expanded')).toBe(false);
      expect(forecastItem.getAttribute('aria-expanded')).toBe('false');

      // 等待动画完成后验证元素被移除
      setTimeout(() => {
        const detailsContainer = forecastItem.querySelector('.prediction-details');
        expect(detailsContainer).toBeNull();
        done();
      }, 350);
    });
  });



  describe('北京晚霞方向展示', () => {
    test('北京场景下晚霞卡片应显示太阳方位角方向（不依赖高分）', () => {
      const sunsetTime = new Date('2024-06-21T19:45:00+08:00');
      const prediction = {
        score: 25,
        quality: 'fair',
        sunsetTime,
        type: 'sunset',
        goldenHour: null,
        blueHour: null,
        sunAzimuth: 296,
        cloudLayers: null,
        factors: {
          cloudCover: { value: 45 },
          humidity: { value: 65 },
          visibility: { value: 12 },
          lowClouds: { value: 20 }
        },
        getOptimalViewingWindow: () => ({
          start: new Date(sunsetTime.getTime() - 30 * 60 * 1000),
          end: new Date(sunsetTime.getTime() + 30 * 60 * 1000)
        }),
        shouldShowAzimuth: () => true,
        getAzimuthDirection: () => '西北偏西'
      };

      const html = predictionController.renderSinglePrediction(
        prediction,
        '🌅',
        '晚霞',
        '日落时间',
        '北京',
        'sunset'
      );

      expect(html).toContain('北京');
      expect(html).toContain('🧭');
      expect(html).toContain('西北偏西 (296°)');
    });
  });
  describe('updatePredictionDisplay', () => {
    test('应该存储预测数据并绑定事件', () => {
      const mockPredictions = [
        {
          date: new Date('2024-01-01'),
          score: 85,
          quality: 'excellent',
          sunsetTime: new Date('2024-01-01T18:30:00'),
          sunriseTime: new Date('2024-01-01T06:30:00'),
          type: 'sunset',
          factors: {
            cloudCover: { value: 50, score: 80 },
            humidity: { value: 60, score: 70 },
            visibility: { value: 15, score: 90 },
            lowClouds: { value: 20, score: 75 }
          }
        },
        {
          date: new Date('2024-01-02'),
          score: 70,
          quality: 'good',
          sunsetTime: new Date('2024-01-02T18:30:00'),
          sunriseTime: new Date('2024-01-02T06:30:00'),
          type: 'sunset',
          factors: {
            cloudCover: { value: 60, score: 70 },
            humidity: { value: 65, score: 65 },
            visibility: { value: 12, score: 80 },
            lowClouds: { value: 30, score: 60 }
          }
        }
      ];

      // 记录绑定前的状态
      const initialPredictions = predictionController.predictions;

      predictionController.updatePredictionDisplay(mockPredictions);

      // 验证预测数据已存储
      expect(predictionController.predictions).toEqual(mockPredictions);
      expect(predictionController.predictions).not.toBe(initialPredictions);

      // 验证事件已绑定（通过检查DOM元素的属性）
      const forecastItems = document.querySelectorAll('.forecast-item');
      if (forecastItems.length > 0) {
        expect(forecastItems[0].getAttribute('tabindex')).toBe('0');
        expect(forecastItems[0].getAttribute('role')).toBe('button');
      }
    });
  });
});
