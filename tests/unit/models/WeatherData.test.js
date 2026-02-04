/**
 * WeatherData单元测试 - 边缘情况和健壮性测试
 *
 * 测试场景：
 * - 极端温度值（-60°C, 60°C）
 * - 边界湿度（0%, 100%）
 * - 云量分层不一致
 * - 无效数据（null, undefined, 负数）
 * - 缺失字段处理
 *
 * 需求：数据模型健壮性
 */

import WeatherData from '@models/WeatherData.js';

describe('WeatherData - 边缘测试', () => {

  describe('极端温度值测试', () => {
    test('应该接受-60°C的极端低温', () => {
      const data = new WeatherData(
        Date.now(),
        -60,  // 极端低温
        50,
        30,
        10,
        1013,
        10
      );
      expect(data.isValid()).toBe(true);
      expect(data.isFieldValid('temp')).toBe(true);
      expect(data.getValidationErrors()).toHaveLength(0);
    });

    test('应该接受60°C的极端高温', () => {
      const data = new WeatherData(
        Date.now(),
        60,  // 极端高温
        50,
        30,
        10,
        1013,
        10
      );
      expect(data.isValid()).toBe(true);
      expect(data.isFieldValid('temp')).toBe(true);
    });

    test('应该拒绝-61°C（超出下限）', () => {
      const data = new WeatherData(
        Date.now(),
        -61,  // 超出下限
        50,
        30,
        10,
        1013,
        10
      );
      expect(data.isValid()).toBe(false);
      expect(data.isFieldValid('temp')).toBe(false);
      expect(data.getValidationErrors()).toContain('温度必须在-60°C到60°C之间');
    });

    test('应该拒绝61°C（超出上限）', () => {
      const data = new WeatherData(
        Date.now(),
        61,  // 超出上限
        50,
        30,
        10,
        1013,
        10
      );
      expect(data.isValid()).toBe(false);
      expect(data.isFieldValid('temp')).toBe(false);
    });

    test('应该拒绝-100°C（超出下限）', () => {
      const data = new WeatherData(
        Date.now(),
        -100,  // 超出下限
        50,
        30,
        10,
        1013,
        10
      );
      expect(data.isValid()).toBe(false);
      expect(data.isFieldValid('temp')).toBe(false);
    });
  });

  describe('边界湿度测试', () => {
    test('应该接受0%湿度（下限）', () => {
      const data = new WeatherData(
        Date.now(),
        20,
        0,  // 湿度下限
        30,
        10,
        1013,
        10
      );
      expect(data.isValid()).toBe(true);
      expect(data.isFieldValid('humidity')).toBe(true);
    });

    test('应该接受100%湿度（上限）', () => {
      const data = new WeatherData(
        Date.now(),
        20,
        100,  // 湿度上限
        30,
        10,
        1013,
        10
      );
      expect(data.isValid()).toBe(true);
      expect(data.isFieldValid('humidity')).toBe(true);
    });

    test('应该拒绝-1%湿度（负数）', () => {
      const data = new WeatherData(
        Date.now(),
        20,
        -1,  // 负湿度
        30,
        10,
        1013,
        10
      );
      expect(data.isValid()).toBe(false);
      expect(data.isFieldValid('humidity')).toBe(false);
      expect(data.getValidationErrors()).toContain('湿度必须在0%到100%之间');
    });

    test('应该拒绝101%湿度（超出上限）', () => {
      const data = new WeatherData(
        Date.now(),
        20,
        101,  // 超出上限
        30,
        10,
        1013,
        10
      );
      expect(data.isValid()).toBe(false);
      expect(data.isFieldValid('humidity')).toBe(false);
    });
  });

  describe('云量分层不一致测试', () => {
    test('应该允许云量分层与总云量不一致（实际场景）', () => {
      // 注意：WeatherData类当前不验证分层云量与总云量的一致性
      // 这可能是合理的，因为它们来自不同的测量方式
      const data = new WeatherData(
        Date.now(),
        20,
        50,
        50,  // 总云量50%
        10,
        1013,
        10,
        60,  // 低云60%（>总云量）
        0,
        0,
        20,  // 高云20%
        15   // 中云15%
      );
      // 当前实现不验证这种不一致性
      expect(data.isValid()).toBe(true);
    });

    test('应该接受所有分层云量都为100%的情况', () => {
      const data = new WeatherData(
        Date.now(),
        20,
        50,
        100,  // 总云量100%
        10,
        1013,
        10,
        100,  // 低云100%
        0,
        0,
        100,  // 高云100%
        100   // 中云100%
      );
      expect(data.isValid()).toBe(true);
    });

    test('应该接受所有分层云量都为0%的情况', () => {
      const data = new WeatherData(
        Date.now(),
        20,
        50,
        0,  // 总云量0%
        10,
        1013,
        10,
        0,  // 低云0%
        0,
        0,
        0,  // 高云0%
        0   // 中云0%
      );
      expect(data.isValid()).toBe(true);
    });
  });

  describe('无效数据处理', () => {
    test('应该拒绝负温度', () => {
      const data = new WeatherData(
        Date.now(),
        -101,  // 超出下限
        50,
        30,
        10,
        1013,
        10
      );
      expect(data.isValid()).toBe(false);
      expect(data.getValidationErrors().length).toBeGreaterThan(0);
    });

    test('应该拒绝负湿度', () => {
      const data = new WeatherData(
        Date.now(),
        20,
        -10,
        30,
        10,
        1013,
        10
      );
      expect(data.isValid()).toBe(false);
      expect(data.getValidationErrors()).toContain('湿度必须在0%到100%之间');
    });

    test('应该拒绝负云量', () => {
      const data = new WeatherData(
        Date.now(),
        20,
        50,
        -5,
        10,
        1013,
        10
      );
      expect(data.isValid()).toBe(false);
      expect(data.getValidationErrors()).toContain('云量必须在0%到100%之间');
    });

    test('应该拒绝负风速', () => {
      const data = new WeatherData(
        Date.now(),
        20,
        50,
        30,
        -10,
        1013,
        10
      );
      expect(data.isValid()).toBe(false);
      expect(data.getValidationErrors()).toContain('风速必须在0到500 km/h之间');
    });

    test('应该拒绝零或负时间戳', () => {
      const data1 = new WeatherData(
        0,  // 零时间戳
        20,
        50,
        30,
        10,
        1013,
        10
      );
      expect(data1.isValid()).toBe(false);
      expect(data1.getValidationErrors()).toContain('时间戳必须是正数');

      const data2 = new WeatherData(
        -1000,  // 负时间戳
        20,
        50,
        30,
        10,
        1013,
        10
      );
      expect(data2.isValid()).toBe(false);
    });

    test('应该拒绝超出范围的气压', () => {
      const data1 = new WeatherData(
        Date.now(),
        20,
        50,
        30,
        10,
        799,  // 低于下限
        10
      );
      expect(data1.isValid()).toBe(false);
      expect(data1.getValidationErrors()).toContain('气压必须在800到1100 hPa之间');

      const data2 = new WeatherData(
        Date.now(),
        20,
        50,
        30,
        10,
        1101,  // 高于上限
        10
      );
      expect(data2.isValid()).toBe(false);
    });

    test('应该拒绝超出范围的能见度', () => {
      const data1 = new WeatherData(
        Date.now(),
        20,
        50,
        30,
        10,
        1013,
        -1  // 负能见度
      );
      expect(data1.isValid()).toBe(false);
      expect(data1.getValidationErrors()).toContain('能见度必须在0到50 km之间');

      const data2 = new WeatherData(
        Date.now(),
        20,
        50,
        30,
        10,
        1013,
        51  // 超出上限
      );
      expect(data2.isValid()).toBe(false);
    });
  });

  describe('风向边界测试', () => {
    test('应该接受0度风向（正北）', () => {
      const data = new WeatherData(
        Date.now(),
        20,
        50,
        30,
        10,
        1013,
        10,
        0,
        0,
        0  // 风向0度
      );
      expect(data.isValid()).toBe(true);
      expect(data.isFieldValid('windDirection')).toBe(true);
    });

    test('应该接受360度风向（正北，同0度）', () => {
      const data = new WeatherData(
        Date.now(),
        20,
        50,
        30,
        10,
        1013,
        10,
        0,
        0,
        360  // 风向360度
      );
      expect(data.isValid()).toBe(true);
      expect(data.isFieldValid('windDirection')).toBe(true);
    });

    test('应该接受180度风向（正南）', () => {
      const data = new WeatherData(
        Date.now(),
        20,
        50,
        30,
        10,
        1013,
        10,
        0,
        0,
        180  // 风向180度
      );
      expect(data.isValid()).toBe(true);
    });

    test('应该拒绝-1度风向', () => {
      const data = new WeatherData(
        Date.now(),
        20,
        50,
        30,
        10,
        1013,
        10,
        0,
        0,
        -1  // 无效风向
      );
      expect(data.isValid()).toBe(false);
      expect(data.isFieldValid('windDirection')).toBe(false);
      expect(data.getValidationErrors()).toContain('风向必须在0到360度之间');
    });

    test('应该拒绝361度风向', () => {
      const data = new WeatherData(
        Date.now(),
        20,
        50,
        30,
        10,
        1013,
        10,
        0,
        0,
        361  // 无效风向
      );
      expect(data.isValid()).toBe(false);
    });
  });

  describe('降水量边界测试', () => {
    test('应该接受0mm降水量', () => {
      const data = new WeatherData(
        Date.now(),
        20,
        50,
        30,
        10,
        1013,
        10,
        0,
        0  // 无降水
      );
      expect(data.isValid()).toBe(true);
      expect(data.isFieldValid('precipitation')).toBe(true);
    });

    test('应该接受500mm降水量（极端降水）', () => {
      const data = new WeatherData(
        Date.now(),
        20,
        50,
        30,
        10,
        1013,
        10,
        0,
        500  // 极端降水
      );
      expect(data.isValid()).toBe(true);
    });

    test('应该拒绝负降水量', () => {
      const data = new WeatherData(
        Date.now(),
        20,
        50,
        30,
        10,
        1013,
        10,
        0,
        -1  // 负降水量
      );
      expect(data.isValid()).toBe(false);
      expect(data.getValidationErrors()).toContain('降水量必须在0到500 mm之间');
    });
  });

  describe('多层验证错误测试', () => {
    test('应该报告所有验证错误', () => {
      const data = new WeatherData(
        -100,  // 无效时间戳
        -101,  // 无效温度
        150,   // 无效湿度
        -5,    // 无效云量
        -10,   // 无效风速
        700,   // 无效气压
        -1     // 无效能见度
      );

      const errors = data.getValidationErrors();
      expect(errors.length).toBeGreaterThan(0);
      expect(errors).toContain('时间戳必须是正数');
      expect(errors).toContain('温度必须在-60°C到60°C之间');
      expect(errors).toContain('湿度必须在0%到100%之间');
      expect(errors).toContain('云量必须在0%到100%之间');
      expect(errors).toContain('风速必须在0到500 km/h之间');
      expect(errors).toContain('气压必须在800到1100 hPa之间');
      expect(errors).toContain('能见度必须在0到50 km之间');
    });
  });

  describe('JSON序列化测试', () => {
    test('应该正确序列化为JSON', () => {
      const data = new WeatherData(
        1640000000000,
        25.5,
        65,
        40,
        15,
        1013,
        10,
        20,
        0,
        180,
        30,
        25
      );

      const json = data.toJSON();
      expect(json).toEqual({
        timestamp: 1640000000000,
        temp: 25.5,
        humidity: 65,
        cloudCover: 40,
        windSpeed: 15,
        pressure: 1013,
        visibility: 10,
        lowClouds: 20,
        precipitation: 0,
        windDirection: 180,
        highClouds: 30,
        midClouds: 25
      });
    });

    test('应该从JSON正确反序列化', () => {
      const json = {
        timestamp: 1640000000000,
        temp: 25.5,
        humidity: 65,
        cloudCover: 40,
        windSpeed: 15,
        pressure: 1013,
        visibility: 10,
        lowClouds: 20,
        precipitation: 0,
        windDirection: 180,
        highClouds: 30,
        midClouds: 25
      };

      const data = WeatherData.fromJSON(json);
      expect(data.timestamp).toBe(1640000000000);
      expect(data.temp).toBe(25.5);
      expect(data.humidity).toBe(65);
      expect(data.cloudCover).toBe(40);
      expect(data.isValid()).toBe(true);
    });

    test('fromJSON应该使用默认值处理缺失字段', () => {
      const json = {
        timestamp: 1640000000000,
        temp: 25,
        humidity: 50,
        cloudCover: 30,
        windSpeed: 10,
        pressure: 1013,
        visibility: 10
        // 缺失可选字段
      };

      const data = WeatherData.fromJSON(json);
      expect(data.lowClouds).toBe(0);
      expect(data.precipitation).toBe(0);
      expect(data.windDirection).toBe(0);
      expect(data.highClouds).toBe(0);
      expect(data.midClouds).toBe(0);
      expect(data.isValid()).toBe(true);
    });
  });

  describe('字段验证测试', () => {
    test('isFieldValid应该拒绝无效字段名', () => {
      const data = new WeatherData(
        Date.now(),
        20,
        50,
        30,
        10,
        1013,
        10
      );

      expect(data.isFieldValid('invalidField')).toBe(false);
      expect(data.isFieldValid('')).toBe(false);
      expect(data.isFieldValid(null)).toBe(false);
      expect(data.isFieldValid(undefined)).toBe(false);
    });

    test('isFieldValid应该独立验证每个字段', () => {
      const data = new WeatherData(
        Date.now(),
        150,  // 无效温度
        50,
        30,
        10,
        1013,
        10
      );

      expect(data.isValid()).toBe(false);
      expect(data.isFieldValid('temp')).toBe(false);
      expect(data.isFieldValid('humidity')).toBe(true);  // 其他字段有效
      expect(data.isFieldValid('cloudCover')).toBe(true);
    });
  });
});
