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
      // getSunsetTime 返回 Date 且使用 new Date(year, month, day, hours, minutes)
      // 因此 getHours() 受运行时时区影响（当前 UTC+8 与北京一致）
      // UTC 11:46 = 19:46 CST
      expect(sunsetTime.getUTCHours()).toBeGreaterThanOrEqual(10);
      expect(sunsetTime.getUTCHours()).toBeLessThanOrEqual(13);
    });

    test('应该为纽约计算合理的日落时间', () => {
      // 纽约坐标：40.7128°N, -74.0060°W
      const date = new Date('2024-06-21'); // 夏至
      const lat = 40.7128;
      const lon = -74.0060;

      const sunsetTime = service.getSunsetTime(date, lat, lon);

      expect(sunsetTime).toBeInstanceOf(Date);
      // 纽约夏至日落约 20:30 EDT (UTC-4) = 00:30 UTC 次日
      expect(sunsetTime.getUTCHours()).toBeGreaterThanOrEqual(0);
      expect(sunsetTime.getUTCHours()).toBeLessThanOrEqual(4);
    });

    test('应该为悉尼计算合理的日落时间', () => {
      // 悉尼坐标：-33.8688°S, 151.2093°E
      // 南半球夏至（12月），悉尼日落约 19:xx AEDT (UTC+11) = 09:xx UTC
      const date = new Date('2024-12-21'); // 南半球夏至
      const lat = -33.8688;
      const lon = 151.2093;

      const sunsetTime = service.getSunsetTime(date, lat, lon);

      expect(sunsetTime).toBeInstanceOf(Date);
      // UTC 大约 09:06
      expect(sunsetTime.getUTCHours()).toBeGreaterThanOrEqual(7);
      expect(sunsetTime.getUTCHours()).toBeLessThanOrEqual(11);
    });

    test('冬季日落时间应该早于夏季', () => {
      const lat = 39.9042;
      const lon = 116.4074;

      const summerDate = new Date('2024-06-21'); // 夏至
      const winterDate = new Date('2024-12-21'); // 冬至

      const summerSunset = service.getSunsetTime(summerDate, lat, lon);
      const winterSunset = service.getSunsetTime(winterDate, lat, lon);

      // 冬季日落应该早于夏季（运行时时区 UTC+8 与北京一致，getHours 有效）
      expect(winterSunset.getHours()).toBeLessThan(summerSunset.getHours());
    });

    test('应该处理赤道附近的位置', () => {
      // 新加坡坐标：1.3521°N, 103.8198°E
      const date = new Date('2024-06-21');
      const lat = 1.3521;
      const lon = 103.8198;

      const sunsetTime = service.getSunsetTime(date, lat, lon);

      expect(sunsetTime).toBeInstanceOf(Date);
      // 新加坡赤道附近日落约 19:12 SGT (UTC+8) = 11:12 UTC
      expect(sunsetTime.getUTCHours()).toBeGreaterThanOrEqual(10);
      expect(sunsetTime.getUTCHours()).toBeLessThanOrEqual(13);
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

  // ========== 统一评分（_calculateUnifiedScore）测试 ==========

  describe('_calculateUnifiedScore', () => {
    test('理想火烧云场景应该进入高分或顶级档', () => {
      // 高云 50% + 中云 40% + 低云 < 10% + 能见度高 + 湿度适中
      const weatherData = {
        highClouds: 50,
        midClouds: 40,
        lowClouds: 5,
        visibility: 25,
        humidity: 50
      };
      const result = service._calculateUnifiedScore(weatherData);
      expect(result.score).toBeGreaterThanOrEqual(70);
      expect(['good', 'excellent']).toContain(result.quality);
    });

    test('晴天无云应该得中低分', () => {
      const weatherData = {
        highClouds: 0,
        midClouds: 0,
        lowClouds: 0,
        visibility: 20,
        humidity: 50
      };
      const result = service._calculateUnifiedScore(weatherData);
      // 缺少云层载体，分数应 < 50
      expect(result.score).toBeLessThan(50);
      expect(result.quality).toBe('poor');
    });

    test('暴雨场景应该得低分', () => {
      const weatherData = {
        highClouds: 30,
        midClouds: 50,
        lowClouds: 60,
        visibility: 5,
        humidity: 90,
        precipitation: 5
      };
      const result = service._calculateUnifiedScore(weatherData);
      expect(result.score).toBeLessThan(30);
      expect(result.quality).toBe('poor');
    });

    test('厚低云场景应该触发惩罚', () => {
      const weatherData = {
        highClouds: 30,
        midClouds: 20,
        lowClouds: 70,
        visibility: 10,
        humidity: 60
      };
      const result = service._calculateUnifiedScore(weatherData);
      // lowClouds=70 >= 40, lowCloudPenalty = 0.5
      expect(result.breakdown.lowCloudPenalty).toBeLessThan(0.6);
      expect(result.score).toBeLessThan(40);
    });

    test('三层云立体分布应该获得层多样性加分', () => {
      const weatherData = {
        highClouds: 30,
        midClouds: 30,
        lowClouds: 15,
        visibility: 20,
        humidity: 50
      };
      const result = service._calculateUnifiedScore(weatherData);
      // layerCount = 3 (all > 10)
      expect(result.breakdown.layerDiversity.layerCount).toBe(3);
      expect(result.breakdown.layerDiversity.score).toBe(15);
    });

    test('应该处理缺失字段（默认值）', () => {
      const result = service._calculateUnifiedScore({});
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    test('应该返回正确的 breakdown 结构', () => {
      const result = service._calculateUnifiedScore({
        highClouds: 50,
        midClouds: 30,
        lowClouds: 10,
        visibility: 20,
        humidity: 50,
        precipitation: 0
      });
      expect(result.breakdown).toHaveProperty('cloudStructure');
      expect(result.breakdown).toHaveProperty('transparency');
      expect(result.breakdown).toHaveProperty('layerDiversity');
      expect(result.breakdown).toHaveProperty('baseScore');
      expect(result.breakdown).toHaveProperty('lowCloudPenalty');
      expect(result.breakdown).toHaveProperty('precipPenalty');
      expect(result.breakdown).toHaveProperty('finalScore');
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

    test('应该根据评分正确分类为"高分"', () => {
      // 理想天气条件：高云适中 + 低云少 + 能见度高 + 湿度适中 + 无降水
      const weatherData = {
        highClouds: 50,
        midClouds: 40,
        lowClouds: 5,
        cloudCover: 50,
        humidity: 50,
        visibility: 30
      };
      const date = new Date('2024-06-21');
      const lat = 39.9042;
      const lon = 116.4074;

      const prediction = service.calculatePrediction(weatherData, date, lat, lon);

      expect(prediction.score).toBeGreaterThanOrEqual(70);
      expect(['good', 'excellent']).toContain(prediction.quality);
      expect(['高分', '顶级']).toContain(prediction.getQualityLabel());
    });

    test('应该根据评分正确分类为"可观赏"', () => {
      // 中等天气条件
      const weatherData = {
        highClouds: 20,
        midClouds: 30,
        lowClouds: 20,
        cloudCover: 35,
        visibility: 12,
        humidity: 70
      };
      const date = new Date('2024-06-21');
      const lat = 39.9042;
      const lon = 116.4074;

      const prediction = service.calculatePrediction(weatherData, date, lat, lon);

      expect(prediction.score).toBeGreaterThanOrEqual(40);
      expect(prediction.score).toBeLessThan(70);
      expect(prediction.quality).toBe('fair');
      expect(prediction.getQualityLabel()).toBe('可观赏');
    });

    test('应该根据评分正确分类为"低概率"', () => {
      // 较差天气条件
      const weatherData = {
        highClouds: 5,
        midClouds: 10,
        lowClouds: 80,
        cloudCover: 10,
        humidity: 90,
        visibility: 3
      };
      const date = new Date('2024-06-21');
      const lat = 39.9042;
      const lon = 116.4074;

      const prediction = service.calculatePrediction(weatherData, date, lat, lon);

      expect(prediction.score).toBeLessThan(40);
      expect(prediction.quality).toBe('poor');
      expect(prediction.getQualityLabel()).toBe('低概率');
    });

    test('应该包含所有因素的详细得分', () => {
      const weatherData = {
        highClouds: 40,
        midClouds: 30,
        lowClouds: 10,
        cloudCover: 50,
        humidity: 60,
        visibility: 20
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

    test('应该反映统一评分的结果', () => {
      const weatherData = {
        highClouds: 50,
        midClouds: 40,
        lowClouds: 5,
        cloudCover: 50,
        humidity: 50,
        visibility: 20
      };
      const date = new Date('2024-06-21');
      const lat = 39.9042;
      const lon = 116.4074;

      // 验证 calculatePrediction 使用 _calculateUnifiedScore 的结果
      const unified = service._calculateUnifiedScore(weatherData);
      const prediction = service.calculatePrediction(weatherData, date, lat, lon);

      // score 和 quality 应与统一评分对齐
      expect(prediction.quality).toBe(unified.quality);
      expect(Math.abs(prediction.score - Math.round(unified.score))).toBeLessThanOrEqual(1);
    });

    test('应该处理缺失的lowCloudCover字段', () => {
      const weatherData = {
        cloudCover: 50,
        humidity: 60,
        visibility: 20
        // 没有 lowCloudCover
      };
      const date = new Date('2024-06-21');
      const lat = 39.9042;
      const lon = 116.4074;

      const prediction = service.calculatePrediction(weatherData, date, lat, lon);

      expect(prediction).toBeDefined();
    });

    test('应该处理缺失的气象参数（使用默认值）', () => {
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
        lowCloudCover: 10,
        timezone: 'Asia/Shanghai'
      };
      const date = new Date('2024-06-21');
      const lat = 39.9042;
      const lon = 116.4074;

      const prediction = service.calculatePrediction(weatherData, date, lat, lon);

      expect(prediction.sunsetTime).toBeInstanceOf(Date);
      const targetHour = Number(new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Shanghai',
        hour: '2-digit',
        hour12: false
      }).format(prediction.sunsetTime));
      expect(targetHour).toBeGreaterThanOrEqual(18);
      expect(targetHour).toBeLessThanOrEqual(21);
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
      expect(window.referenceTime).toEqual(prediction.sunsetTime);

      // 验证时间窗口是日落前后30分钟
      const expectedStart = new Date(prediction.sunsetTime.getTime() - 30 * 60 * 1000);
      const expectedEnd = new Date(prediction.sunsetTime.getTime() + 30 * 60 * 1000);

      expect(window.start.getTime()).toBe(expectedStart.getTime());
      expect(window.end.getTime()).toBe(expectedEnd.getTime());
    });
  });
});

describe('SunsetPredictionService timezone display invariants', () => {
  test('北京日出应按目标地点 Asia/Shanghai 显示，而不是用户所在时区', () => {
    const service = new SunsetPredictionService();
    const sunrise = service.getSunriseTime(
      new Date('2026-04-25T00:00:00Z'),
      39.9042,
      116.4074,
      { timezone: 'Asia/Shanghai' }
    );

    const beijingTime = new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(sunrise);
    const qatarTime = new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Qatar',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(sunrise);

    expect(beijingTime).toMatch(/^05:/);
    expect(qatarTime).toMatch(/^00:/);
  });


  test('槟城应使用马来西亚法定时区 UTC+8，而不是经度推算 UTC+7', () => {
    const service = new SunsetPredictionService();
    const date = new Date('2026-04-25T00:00:00Z');
    const penangLon = 100.3288;

    expect(service._getTargetTimezoneOffsetHours(date, penangLon, 'Asia/Kuala_Lumpur')).toBe(8);
    expect(service._getTargetTimezoneOffsetHours(date, penangLon)).toBe(7);

    const sunrise = service.getSunriseTime(date, 5.4164, penangLon, {
      timezone: 'Asia/Kuala_Lumpur'
    });

    const legalDisplay = new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Kuala_Lumpur', hour: '2-digit', minute: '2-digit', hour12: false
    }).format(sunrise);
    const longitudeFallbackDisplay = new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false
    }).format(sunrise);

    expect(legalDisplay).not.toBe(longitudeFallbackDisplay);
  });

  test('新疆城市应使用中国法定时区 Asia/Shanghai，而不是按经度推算', () => {
    const service = new SunsetPredictionService();
    const date = new Date('2026-04-25T00:00:00Z');
    const urumqiLon = 87.6168;

    expect(service._getTargetTimezoneOffsetHours(date, urumqiLon, 'Asia/Shanghai')).toBe(8);
    expect(service._getTargetTimezoneOffsetHours(date, urumqiLon)).toBe(6);

    const sunrise = service.getSunriseTime(date, 43.8256, urumqiLon, {
      timezone: 'Asia/Shanghai'
    });

    const legalDisplay = new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hour12: false
    }).format(sunrise);
    const longitudeFallbackDisplay = new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Etc/GMT-6', hour: '2-digit', minute: '2-digit', hour12: false
    }).format(sunrise);

    expect(legalDisplay).not.toBe(longitudeFallbackDisplay);
  });


  test('拉萨也应使用中国法定时区 Asia/Shanghai，而不是按经度推算', () => {
    const service = new SunsetPredictionService();
    const date = new Date('2026-04-25T00:00:00Z');
    const lhasaLon = 91.1322;

    expect(service._getTargetTimezoneOffsetHours(date, lhasaLon, 'Asia/Shanghai')).toBe(8);
    expect(service._getTargetTimezoneOffsetHours(date, lhasaLon)).toBe(6);

    const sunrise = service.getSunriseTime(date, 29.65, lhasaLon, {
      timezone: 'Asia/Shanghai'
    });

    const legalDisplay = new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hour12: false
    }).format(sunrise);
    const longitudeFallbackDisplay = new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Etc/GMT-6', hour: '2-digit', minute: '2-digit', hour12: false
    }).format(sunrise);

    expect(legalDisplay).not.toBe(longitudeFallbackDisplay);
  });
});
