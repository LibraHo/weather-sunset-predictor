/**
 * SunsetPredictionService 单元测试
 * 
 * 测试晚霞预测服务的基础功能
 */

import SunsetPredictionService from '../../../src/services/SunsetPredictionService.js';

describe('SunsetPredictionService', () => {
  let service;

  beforeEach(() => {
    service = new SunsetPredictionService();
  });

  describe('构造函数', () => {
    test('应该初始化权重配置', () => {
      expect(service.weights).toBeDefined();
      expect(service.weights.cloudCover).toBe(0.35);
      expect(service.weights.humidity).toBe(0.25);
      expect(service.weights.visibility).toBe(0.20);
      expect(service.weights.lowClouds).toBe(0.20);
    });

    test('权重总和应该为1.0', () => {
      const totalWeight = Object.values(service.weights).reduce((sum, w) => sum + w, 0);
      expect(totalWeight).toBeCloseTo(1.0, 5);
    });
  });

  describe('getSunsetTime', () => {
    test('应该为北京计算合理的日落时间', () => {
      // 北京坐标：39.9042°N, 116.4074°E
      const date = new Date('2024-06-21'); // 夏至
      const lat = 39.9042;
      const lon = 116.4074;

      const sunsetTime = service.getSunsetTime(date, lat, lon);

      expect(sunsetTime).toBeInstanceOf(Date);
      expect(sunsetTime.getHours()).toBeGreaterThanOrEqual(18);
      expect(sunsetTime.getHours()).toBeLessThanOrEqual(21);
    });

    test('应该为纽约计算合理的日落时间', () => {
      // 纽约坐标：40.7128°N, -74.0060°W
      const date = new Date('2024-06-21'); // 夏至
      const lat = 40.7128;
      const lon = -74.0060;

      const sunsetTime = service.getSunsetTime(date, lat, lon);

      expect(sunsetTime).toBeInstanceOf(Date);
      expect(sunsetTime.getHours()).toBeGreaterThanOrEqual(18);
      expect(sunsetTime.getHours()).toBeLessThanOrEqual(22);
    });

    test('应该为悉尼计算合理的日落时间', () => {
      // 悉尼坐标：-33.8688°S, 151.2093°E
      const date = new Date('2024-12-21'); // 南半球夏至
      const lat = -33.8688;
      const lon = 151.2093;

      const sunsetTime = service.getSunsetTime(date, lat, lon);

      expect(sunsetTime).toBeInstanceOf(Date);
      expect(sunsetTime.getHours()).toBeGreaterThanOrEqual(18);
      expect(sunsetTime.getHours()).toBeLessThanOrEqual(22);
    });

    test('冬季日落时间应该早于夏季', () => {
      const lat = 39.9042;
      const lon = 116.4074;

      const summerDate = new Date('2024-06-21'); // 夏至
      const winterDate = new Date('2024-12-21'); // 冬至

      const summerSunset = service.getSunsetTime(summerDate, lat, lon);
      const winterSunset = service.getSunsetTime(winterDate, lat, lon);

      // 冬季日落应该早于夏季
      expect(winterSunset.getHours()).toBeLessThan(summerSunset.getHours());
    });

    test('应该处理赤道附近的位置', () => {
      // 新加坡坐标：1.3521°N, 103.8198°E
      const date = new Date('2024-06-21');
      const lat = 1.3521;
      const lon = 103.8198;

      const sunsetTime = service.getSunsetTime(date, lat, lon);

      expect(sunsetTime).toBeInstanceOf(Date);
      expect(sunsetTime.getHours()).toBeGreaterThanOrEqual(17);
      expect(sunsetTime.getHours()).toBeLessThanOrEqual(20);
    });

    test('应该拒绝无效的日期', () => {
      expect(() => {
        service.getSunsetTime(null, 39.9042, 116.4074);
      }).toThrow('无效的日期对象');

      expect(() => {
        service.getSunsetTime(new Date('invalid'), 39.9042, 116.4074);
      }).toThrow('无效的日期对象');
    });

    test('应该拒绝无效的纬度', () => {
      const date = new Date('2024-06-21');

      expect(() => {
        service.getSunsetTime(date, -91, 116.4074);
      }).toThrow('纬度必须在-90到90之间');

      expect(() => {
        service.getSunsetTime(date, 91, 116.4074);
      }).toThrow('纬度必须在-90到90之间');

      expect(() => {
        service.getSunsetTime(date, 'invalid', 116.4074);
      }).toThrow('纬度必须在-90到90之间');
    });

    test('应该拒绝无效的经度', () => {
      const date = new Date('2024-06-21');

      expect(() => {
        service.getSunsetTime(date, 39.9042, -181);
      }).toThrow('经度必须在-180到180之间');

      expect(() => {
        service.getSunsetTime(date, 39.9042, 181);
      }).toThrow('经度必须在-180到180之间');

      expect(() => {
        service.getSunsetTime(date, 39.9042, 'invalid');
      }).toThrow('经度必须在-180到180之间');
    });

    test('应该处理极地地区（极昼/极夜）', () => {
      // 北极圈内的位置
      const date = new Date('2024-06-21'); // 夏至 - 极昼
      const lat = 80; // 北纬80度
      const lon = 0;

      const sunsetTime = service.getSunsetTime(date, lat, lon);

      // 极昼情况下应该返回接近午夜的时间
      expect(sunsetTime).toBeInstanceOf(Date);
    });

    test('返回的日期应该与输入日期在同一天', () => {
      const date = new Date('2024-06-21');
      const lat = 39.9042;
      const lon = 116.4074;

      const sunsetTime = service.getSunsetTime(date, lat, lon);

      expect(sunsetTime.getFullYear()).toBe(date.getFullYear());
      expect(sunsetTime.getMonth()).toBe(date.getMonth());
      // 日期可能相差1天（由于时区转换）
      expect(Math.abs(sunsetTime.getDate() - date.getDate())).toBeLessThanOrEqual(1);
    });
  });

  describe('scoreCloudCover', () => {
    test('应该在30-70%范围内给出高分', () => {
      // 最佳范围内的云量应该得到高分
      expect(service.scoreCloudCover(50)).toBeGreaterThan(90);
      expect(service.scoreCloudCover(40)).toBeGreaterThan(80);
      expect(service.scoreCloudCover(60)).toBeGreaterThan(80);
    });

    test('应该在范围外给出较低分', () => {
      // 范围外的云量应该得到较低分
      expect(service.scoreCloudCover(0)).toBeLessThan(50);
      expect(service.scoreCloudCover(100)).toBeLessThan(50);
      expect(service.scoreCloudCover(10)).toBeLessThan(70);
      expect(service.scoreCloudCover(90)).toBeLessThan(70);
    });

    test('应该返回0-100范围内的分数', () => {
      const testValues = [0, 25, 50, 75, 100];
      testValues.forEach(value => {
        const score = service.scoreCloudCover(value);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      });
    });

    test('应该处理无效输入', () => {
      expect(service.scoreCloudCover(-10)).toBe(0);
      expect(service.scoreCloudCover(110)).toBe(0);
      expect(service.scoreCloudCover('invalid')).toBe(0);
      expect(service.scoreCloudCover(null)).toBe(0);
    });

    test('50%云量应该得到最高分', () => {
      const score50 = service.scoreCloudCover(50);
      expect(service.scoreCloudCover(40)).toBeLessThanOrEqual(score50);
      expect(service.scoreCloudCover(60)).toBeLessThanOrEqual(score50);
      expect(service.scoreCloudCover(30)).toBeLessThan(score50);
      expect(service.scoreCloudCover(70)).toBeLessThan(score50);
    });
  });

  describe('scoreHumidity', () => {
    test('应该在30-70%范围内给出高分', () => {
      // 最佳范围内的湿度应该得到高分
      expect(service.scoreHumidity(50)).toBeGreaterThan(90);
      expect(service.scoreHumidity(40)).toBeGreaterThan(80);
      expect(service.scoreHumidity(60)).toBeGreaterThan(80);
    });

    test('应该在范围外给出较低分', () => {
      // 范围外的湿度应该得到较低分
      expect(service.scoreHumidity(0)).toBeLessThan(50);
      expect(service.scoreHumidity(100)).toBeLessThan(50);
      expect(service.scoreHumidity(10)).toBeLessThan(70);
      expect(service.scoreHumidity(90)).toBeLessThan(70);
    });

    test('应该返回0-100范围内的分数', () => {
      const testValues = [0, 25, 50, 75, 100];
      testValues.forEach(value => {
        const score = service.scoreHumidity(value);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      });
    });

    test('应该处理无效输入', () => {
      expect(service.scoreHumidity(-10)).toBe(0);
      expect(service.scoreHumidity(110)).toBe(0);
      expect(service.scoreHumidity('invalid')).toBe(0);
      expect(service.scoreHumidity(null)).toBe(0);
    });

    test('50%湿度应该得到最高分', () => {
      const score50 = service.scoreHumidity(50);
      expect(service.scoreHumidity(40)).toBeLessThanOrEqual(score50);
      expect(service.scoreHumidity(60)).toBeLessThanOrEqual(score50);
      expect(service.scoreHumidity(30)).toBeLessThan(score50);
      expect(service.scoreHumidity(70)).toBeLessThan(score50);
    });
  });

  describe('scoreVisibility', () => {
    test('能见度越高分数越高', () => {
      expect(service.scoreVisibility(20)).toBeGreaterThan(service.scoreVisibility(10));
      expect(service.scoreVisibility(30)).toBeGreaterThan(service.scoreVisibility(20));
      expect(service.scoreVisibility(10)).toBeGreaterThan(service.scoreVisibility(5));
    });

    test('应该返回0-100范围内的分数', () => {
      const testValues = [0, 5, 10, 20, 30, 50];
      testValues.forEach(value => {
        const score = service.scoreVisibility(value);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      });
    });

    test('0能见度应该得0分', () => {
      expect(service.scoreVisibility(0)).toBe(0);
    });

    test('高能见度应该接近100分', () => {
      expect(service.scoreVisibility(30)).toBeGreaterThan(85);
      expect(service.scoreVisibility(50)).toBeGreaterThan(95);
    });

    test('应该处理无效输入', () => {
      expect(service.scoreVisibility(-10)).toBe(0);
      expect(service.scoreVisibility('invalid')).toBe(0);
      expect(service.scoreVisibility(null)).toBe(0);
    });
  });

  describe('scoreLowClouds', () => {
    test('低层云越少分数越高', () => {
      expect(service.scoreLowClouds(0)).toBeGreaterThan(service.scoreLowClouds(20));
      expect(service.scoreLowClouds(20)).toBeGreaterThan(service.scoreLowClouds(40));
      expect(service.scoreLowClouds(40)).toBeGreaterThan(service.scoreLowClouds(60));
    });

    test('应该返回0-100范围内的分数', () => {
      const testValues = [0, 25, 50, 75, 100];
      testValues.forEach(value => {
        const score = service.scoreLowClouds(value);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      });
    });

    test('0%低层云应该得满分', () => {
      expect(service.scoreLowClouds(0)).toBe(100);
    });

    test('100%低层云应该得很低分', () => {
      expect(service.scoreLowClouds(100)).toBeLessThan(5);
    });

    test('应该处理无效输入', () => {
      expect(service.scoreLowClouds(-10)).toBe(0);
      expect(service.scoreLowClouds(110)).toBe(0);
      expect(service.scoreLowClouds('invalid')).toBe(0);
      expect(service.scoreLowClouds(null)).toBe(0);
    });
  });

  describe('calculatePrediction', () => {
    test('应该返回SunsetPrediction对象', () => {
      const weatherData = {
        cloudCover: 50,
        humidity: 60,
        visibility: 20,
        lowCloudCover: 10
      };
      const date = new Date('2024-06-21');
      const lat = 39.9042;
      const lon = 116.4074;

      const prediction = service.calculatePrediction(weatherData, date, lat, lon);

      expect(prediction).toBeDefined();
      expect(prediction.date).toEqual(date);
      expect(prediction.score).toBeGreaterThanOrEqual(0);
      expect(prediction.score).toBeLessThanOrEqual(100);
      expect(prediction.quality).toBeDefined();
      expect(prediction.factors).toBeDefined();
      expect(prediction.sunsetTime).toBeInstanceOf(Date);
    });

    test('应该根据评分正确分类为"优秀"', () => {
      // 理想天气条件：云量50%，湿度50%，高能见度，低层云少
      const weatherData = {
        cloudCover: 50,
        humidity: 50,
        visibility: 30,
        lowCloudCover: 5
      };
      const date = new Date('2024-06-21');
      const lat = 39.9042;
      const lon = 116.4074;

      const prediction = service.calculatePrediction(weatherData, date, lat, lon);

      expect(prediction.score).toBeGreaterThanOrEqual(70);
      expect(prediction.quality).toBe('excellent');
      expect(prediction.getQualityLabel()).toBe('优秀');
    });

    test('应该根据评分正确分类为"良好"', () => {
      // 中等天气条件
      const weatherData = {
        cloudCover: 35,
        humidity: 70,
        visibility: 12,
        lowCloudCover: 25
      };
      const date = new Date('2024-06-21');
      const lat = 39.9042;
      const lon = 116.4074;

      const prediction = service.calculatePrediction(weatherData, date, lat, lon);

      expect(prediction.score).toBeGreaterThanOrEqual(40);
      expect(prediction.score).toBeLessThan(70);
      expect(prediction.quality).toBe('good');
      expect(prediction.getQualityLabel()).toBe('良好');
    });

    test('应该根据评分正确分类为"一般"', () => {
      // 较差天气条件：云量极端，湿度极端，低能见度，高低层云
      const weatherData = {
        cloudCover: 10,
        humidity: 90,
        visibility: 3,
        lowCloudCover: 80
      };
      const date = new Date('2024-06-21');
      const lat = 39.9042;
      const lon = 116.4074;

      const prediction = service.calculatePrediction(weatherData, date, lat, lon);

      expect(prediction.score).toBeLessThan(40);
      expect(prediction.quality).toBe('fair');
      expect(prediction.getQualityLabel()).toBe('一般');
    });

    test('应该包含所有因素的详细得分', () => {
      const weatherData = {
        cloudCover: 50,
        humidity: 60,
        visibility: 20,
        lowCloudCover: 10
      };
      const date = new Date('2024-06-21');
      const lat = 39.9042;
      const lon = 116.4074;

      const prediction = service.calculatePrediction(weatherData, date, lat, lon);

      expect(prediction.factors.cloudCover).toBeDefined();
      expect(prediction.factors.cloudCover.value).toBe(50);
      expect(prediction.factors.cloudCover.score).toBeGreaterThan(0);

      expect(prediction.factors.humidity).toBeDefined();
      expect(prediction.factors.humidity.value).toBe(60);
      expect(prediction.factors.humidity.score).toBeGreaterThan(0);

      expect(prediction.factors.visibility).toBeDefined();
      expect(prediction.factors.visibility.value).toBe(20);
      expect(prediction.factors.visibility.score).toBeGreaterThan(0);

      expect(prediction.factors.lowClouds).toBeDefined();
      expect(prediction.factors.lowClouds.value).toBe(10);
      expect(prediction.factors.lowClouds.score).toBeGreaterThan(0);
    });

    test('应该正确计算加权总分', () => {
      const weatherData = {
        cloudCover: 50,
        humidity: 50,
        visibility: 20,
        lowCloudCover: 10
      };
      const date = new Date('2024-06-21');
      const lat = 39.9042;
      const lon = 116.4074;

      const prediction = service.calculatePrediction(weatherData, date, lat, lon);

      // 手动计算预期分数
      const cloudScore = service.scoreCloudCover(50);
      const humidityScore = service.scoreHumidity(50);
      const visibilityScore = service.scoreVisibility(20);
      const lowCloudsScore = service.scoreLowClouds(10);

      const expectedScore = Math.round(
        cloudScore * 0.35 +
        humidityScore * 0.25 +
        visibilityScore * 0.20 +
        lowCloudsScore * 0.20
      );

      expect(prediction.score).toBe(expectedScore);
    });

    test('应该处理缺失的lowCloudCover字段', () => {
      // 如果没有lowCloudCover，应该使用cloudCover作为替代
      const weatherData = {
        cloudCover: 50,
        humidity: 60,
        visibility: 20
        // 没有lowCloudCover
      };
      const date = new Date('2024-06-21');
      const lat = 39.9042;
      const lon = 116.4074;

      const prediction = service.calculatePrediction(weatherData, date, lat, lon);

      expect(prediction).toBeDefined();
      expect(prediction.factors.lowClouds.value).toBe(50); // 应该使用cloudCover
    });

    test('应该处理缺失的气象参数（使用默认值0）', () => {
      const weatherData = {}; // 空对象
      const date = new Date('2024-06-21');
      const lat = 39.9042;
      const lon = 116.4074;

      const prediction = service.calculatePrediction(weatherData, date, lat, lon);

      expect(prediction).toBeDefined();
      expect(prediction.score).toBeGreaterThanOrEqual(0);
      expect(prediction.score).toBeLessThanOrEqual(100);
    });

    test('应该拒绝无效的天气数据', () => {
      const date = new Date('2024-06-21');
      const lat = 39.9042;
      const lon = 116.4074;

      expect(() => {
        service.calculatePrediction(null, date, lat, lon);
      }).toThrow('无效的天气数据对象');

      expect(() => {
        service.calculatePrediction('invalid', date, lat, lon);
      }).toThrow('无效的天气数据对象');
    });

    test('应该拒绝无效的日期', () => {
      const weatherData = { cloudCover: 50, humidity: 60, visibility: 20 };
      const lat = 39.9042;
      const lon = 116.4074;

      expect(() => {
        service.calculatePrediction(weatherData, null, lat, lon);
      }).toThrow('无效的日期对象');

      expect(() => {
        service.calculatePrediction(weatherData, new Date('invalid'), lat, lon);
      }).toThrow('无效的日期对象');
    });

    test('应该拒绝无效的坐标', () => {
      const weatherData = { cloudCover: 50, humidity: 60, visibility: 20 };
      const date = new Date('2024-06-21');

      expect(() => {
        service.calculatePrediction(weatherData, date, -91, 116.4074);
      }).toThrow('纬度必须在-90到90之间');

      expect(() => {
        service.calculatePrediction(weatherData, date, 39.9042, 181);
      }).toThrow('经度必须在-180到180之间');
    });

    test('评分应该始终在0-100范围内', () => {
      // 测试极端天气条件
      const extremeConditions = [
        { cloudCover: 0, humidity: 0, visibility: 0, lowCloudCover: 100 },
        { cloudCover: 100, humidity: 100, visibility: 50, lowCloudCover: 0 },
        { cloudCover: 50, humidity: 50, visibility: 100, lowCloudCover: 0 }
      ];

      const date = new Date('2024-06-21');
      const lat = 39.9042;
      const lon = 116.4074;

      extremeConditions.forEach(weatherData => {
        const prediction = service.calculatePrediction(weatherData, date, lat, lon);
        expect(prediction.score).toBeGreaterThanOrEqual(0);
        expect(prediction.score).toBeLessThanOrEqual(100);
      });
    });

    test('应该包含日落时间', () => {
      const weatherData = {
        cloudCover: 50,
        humidity: 60,
        visibility: 20,
        lowCloudCover: 10
      };
      const date = new Date('2024-06-21');
      const lat = 39.9042;
      const lon = 116.4074;

      const prediction = service.calculatePrediction(weatherData, date, lat, lon);

      expect(prediction.sunsetTime).toBeInstanceOf(Date);
      expect(prediction.sunsetTime.getHours()).toBeGreaterThanOrEqual(18);
      expect(prediction.sunsetTime.getHours()).toBeLessThanOrEqual(21);
    });

    test('getOptimalViewingWindow应该返回日落前后30分钟', () => {
      const weatherData = {
        cloudCover: 50,
        humidity: 60,
        visibility: 20,
        lowCloudCover: 10
      };
      const date = new Date('2024-06-21');
      const lat = 39.9042;
      const lon = 116.4074;

      const prediction = service.calculatePrediction(weatherData, date, lat, lon);
      const window = prediction.getOptimalViewingWindow();

      expect(window.start).toBeInstanceOf(Date);
      expect(window.end).toBeInstanceOf(Date);
      expect(window.sunsetTime).toEqual(prediction.sunsetTime);

      // 验证时间窗口是日落前后30分钟
      const expectedStart = new Date(prediction.sunsetTime.getTime() - 30 * 60 * 1000);
      const expectedEnd = new Date(prediction.sunsetTime.getTime() + 30 * 60 * 1000);

      expect(window.start.getTime()).toBe(expectedStart.getTime());
      expect(window.end.getTime()).toBe(expectedEnd.getTime());
    });
  });
});
