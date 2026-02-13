import WeatherController from '../../../src/controllers/WeatherController.js';

describe('WeatherController - 24小时温度连续化', () => {
  let controller;

  beforeEach(() => {
    controller = Object.create(WeatherController.prototype);
  });

  test('应该将3小时间隔数据插值为连续24小时，避免温度折线异常跳变', () => {
    const baseTs = new Date('2026-01-01T00:00:00Z').getTime();

    const raw = Array.from({ length: 16 }, (_, i) => ({
      timestamp: baseTs + (i * 3 * 60 * 60 * 1000),
      temp: i * 3,
      humidity: 50,
      cloudCover: 30,
      windSpeed: 10,
      pressure: 1000
    })).reverse(); // 故意打乱顺序，验证会先排序

    const hourly = controller.buildContinuous24HourData(raw, 'today');

    expect(hourly).toHaveLength(24);

    // 每一小时温度应单调上升（线性插值）
    for (let i = 1; i < hourly.length; i++) {
      expect(hourly[i].temp).toBeGreaterThanOrEqual(hourly[i - 1].temp);
      expect(hourly[i].timestamp - hourly[i - 1].timestamp).toBe(60 * 60 * 1000);
    }

    // 检查插值点：第1小时应接近1°C
    expect(hourly[1].temp).toBeCloseTo(1, 5);
    // 第23小时应接近23°C
    expect(hourly[23].temp).toBeCloseTo(23, 5);
  });

  test('tomorrow 应从第25个小时开始构建24小时数据', () => {
    const baseTs = new Date('2026-01-01T00:00:00Z').getTime();
    const raw = Array.from({ length: 72 }, (_, i) => ({
      timestamp: baseTs + (i * 60 * 60 * 1000),
      temp: i,
      humidity: 60,
      cloudCover: 20,
      windSpeed: 8,
      pressure: 1005
    }));

    const tomorrow = controller.buildContinuous24HourData(raw, 'tomorrow');

    expect(tomorrow).toHaveLength(24);
    expect(tomorrow[0].timestamp).toBe(baseTs + (24 * 60 * 60 * 1000));
    expect(tomorrow[0].temp).toBeCloseTo(24, 5);
    expect(tomorrow[23].temp).toBeCloseTo(47, 5);
  });
});
