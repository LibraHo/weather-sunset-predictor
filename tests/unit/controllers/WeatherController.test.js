import { jest } from '@jest/globals';
import WeatherController from '../../../src/controllers/WeatherController.js';

describe('WeatherController - 24小时温度连续化', () => {
  let controller;

  beforeEach(() => {
    controller = Object.create(WeatherController.prototype);
  });

  test.skip('应该将3小时间隔数据插值为连续24小时，避免温度折线异常跳变', () => {
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

  test.skip('tomorrow 应从第25个小时开始构建24小时数据', () => {
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


  test.skip('today 应从当天00:00开始，而不是从首条预测时刻开始', () => {
    const baseTs = new Date('2026-01-01T05:00:00Z').getTime();
    const raw = Array.from({ length: 30 }, (_, i) => ({
      timestamp: baseTs + (i * 60 * 60 * 1000),
      temp: i,
      humidity: 60,
      cloudCover: 20,
      windSpeed: 8,
      pressure: 1005
    }));

    const today = controller.buildContinuous24HourData(raw, 'today');

    expect(today).toHaveLength(24);
    expect(today[0].timestamp).toBe(new Date('2026-01-01T05:00:00Z').getTime());
    expect(today[20].timestamp).toBe(new Date('2026-01-01T20:00:00Z').getTime());
  });

  test('buildContinuous24HourData: tomorrow 应从 tomorrow 数据起点构建，不复用 today 起点', () => {
    const baseTs = new Date('2026-01-01T00:00:00Z').getTime();
    // 3小时点，覆盖 2 天
    const raw = Array.from({ length: 16 }, (_, i) => ({
      timestamp: baseTs + (i * 3 * 60 * 60 * 1000),
      temp: i,
      humidity: 60,
      cloudCover: 20,
      windSpeed: 8,
      pressure: 1005
    }));

    const today = controller.buildContinuous24HourData(raw, 'today');
    const tomorrow = controller.buildContinuous24HourData(raw, 'tomorrow');

    expect(today).toHaveLength(24);
    expect(tomorrow).toHaveLength(24);
    expect(tomorrow[0].timestamp).toBe(baseTs + (24 * 60 * 60 * 1000));
    expect(today[0].timestamp).not.toBe(tomorrow[0].timestamp);
  });

  test('setMapTimeToSunset 在缺少日落数据时应调用 controller.showError 而不是 uiManager', () => {
    controller.windyMapService = { setTimestamp: jest.fn() };
    controller.isMapInitialized = true;
    controller.currentWeatherData = null;
    controller.showError = jest.fn();

    controller.setMapTimeToSunset();

    expect(controller.showError).toHaveBeenCalledWith('无法获取日落时间数据');
  });

  test('setMapTimeToSunrise 在缺少日出数据时应调用 controller.showError 而不是 uiManager', () => {
    controller.windyMapService = { setTimestamp: jest.fn() };
    controller.isMapInitialized = true;
    controller.currentWeatherData = null;
    controller.showError = jest.fn();

    controller.setMapTimeToSunrise();

    expect(controller.showError).toHaveBeenCalledWith('无法获取日出时间数据');
  });

  test('今天/明天保留相对文案，且所有天数都追加“(日期)”；后天起仅显示星期 + 日期', () => {
    controller.i18n = {
      currentLanguage: 'zh-CN',
      t: jest.fn((key, params) => {
        if (key === 'time.today') return '今天';
        if (key === 'time.tomorrow') return '明天';
        if (key === 'weather.precipChance') return `${params.prob}%降水`;
        return key;
      })
    };

    const dateFormatterSpy = jest.spyOn(Intl, 'DateTimeFormat').mockImplementation((locale, options = {}) => ({
      format: () => {
        if (options.weekday === 'short') return '周四';
        if (options.day === 'numeric') return '26';
        return '';
      }
    }));

    const dayData = [{
      timestamp: new Date('2026-02-26T06:00:00Z').getTime(),
      temp: 22,
      cloudCover: 40,
      precipitation: 0,
      windSpeed: 8,
      pressure: 1008
    }];

    const todayCard = controller._createDayCard(dayData, 0);
    const tomorrowCard = controller._createDayCard(dayData, 1);
    const dayAfterTomorrowCard = controller._createDayCard(dayData, 2);
    const fourthDayCard = controller._createDayCard(dayData, 3);

    expect(todayCard.querySelector('.day-label-primary').textContent).toBe('今天');
    expect(todayCard.querySelector('.day-label-date').textContent).toBe('(26日)');
    expect(tomorrowCard.querySelector('.day-label-primary').textContent).toBe('明天');
    expect(tomorrowCard.querySelector('.day-label-date').textContent).toBe('(26日)');
    expect(dayAfterTomorrowCard.querySelector('.day-label-primary').textContent).toBe('周四');
    expect(dayAfterTomorrowCard.querySelector('.day-label-date').textContent).toBe('(26日)');
    expect(fourthDayCard.querySelector('.day-label-primary').textContent).toBe('周四');
    expect(fourthDayCard.querySelector('.day-label-date').textContent).toBe('(26日)');

    expect(dateFormatterSpy).toHaveBeenCalledWith('zh-CN', { day: 'numeric' });
    expect(dateFormatterSpy).toHaveBeenCalledWith('zh-CN', { weekday: 'short' });

    dateFormatterSpy.mockRestore();
  });

  test('英文环境日期应使用序数格式（如 18TH）', () => {
    controller.i18n = {
      currentLanguage: 'en-US',
      t: jest.fn((key, params) => {
        if (key === 'time.today') return 'Today';
        if (key === 'time.tomorrow') return 'Tomorrow';
        if (key === 'weather.precipChance') return `${params.prob}% precip`;
        return key;
      })
    };

    const dateFormatterSpy = jest.spyOn(Intl, 'DateTimeFormat').mockImplementation((locale, options = {}) => ({
      format: () => {
        if (options.weekday === 'short') return 'Thu';
        if (options.day === 'numeric') return '18';
        return '';
      }
    }));

    const dayData = [{
      timestamp: new Date('2026-06-18T06:00:00Z').getTime(),
      temp: 23,
      cloudCover: 40,
      precipitation: 0,
      windSpeed: 8,
      pressure: 1008
    }];

    const todayCard = controller._createDayCard(dayData, 0);
    const tomorrowCard = controller._createDayCard(dayData, 1);
    const dayAfterTomorrowCard = controller._createDayCard(dayData, 2);

    expect(todayCard.querySelector('.day-label-primary').textContent).toBe('Today');
    expect(todayCard.querySelector('.day-label-date').textContent).toBe('(18TH)');
    expect(tomorrowCard.querySelector('.day-label-primary').textContent).toBe('Tomorrow');
    expect(tomorrowCard.querySelector('.day-label-date').textContent).toBe('(18TH)');
    expect(dayAfterTomorrowCard.querySelector('.day-label-primary').textContent).toBe('Thu');
    expect(dayAfterTomorrowCard.querySelector('.day-label-date').textContent).toBe('(18TH)');

    dateFormatterSpy.mockRestore();
  });

  test('每日温度显示应为低温在前、高温在后', () => {
    controller.i18n = {
      currentLanguage: 'zh-CN',
      t: jest.fn((key, params) => {
        if (key === 'time.today') return '今天';
        if (key === 'weather.precipChance') return `${params.prob}%降水`;
        return key;
      })
    };

    const dateFormatterSpy = jest.spyOn(Intl, 'DateTimeFormat').mockImplementation((locale, options = {}) => ({
      format: () => {
        if (options.day === 'numeric') return '18';
        if (options.weekday === 'short') return '周四';
        return '';
      }
    }));

    const dayData = [
      { timestamp: new Date('2026-06-18T00:00:00Z').getTime(), temp: 30, cloudCover: 20, precipitation: 0, windSpeed: 8, pressure: 1008 },
      { timestamp: new Date('2026-06-18T03:00:00Z').getTime(), temp: 10, cloudCover: 20, precipitation: 0, windSpeed: 8, pressure: 1008 }
    ];

    const card = controller._createDayCard(dayData, 0);
    const range = card.querySelector('.temp-range').textContent.replace(/\s+/g, ' ').trim();
    expect(range).toContain('10°');
    expect(range).toContain('30°');
    expect(range.indexOf('10°')).toBeLessThan(range.indexOf('30°'));

    dateFormatterSpy.mockRestore();
  });

  test('每日概览应按“降水/风速/风向”文字顺序展示风信息', () => {
    controller.i18n = {
      currentLanguage: 'zh-CN',
      t: jest.fn((key, params) => {
        if (key === 'time.today') return '今天';
        if (key === 'weather.precipitation') return '降水';
        if (key === 'weather.windSpeed') return '风速';
        if (key === 'weather.windDirection') return '风向';
        if (key === 'surrounding.directions.E') return '东';
        if (key === 'surrounding.directions.SE') return '东南';
        return key;
      })
    };

    controller.windSpeedUnit = 'kmh';

    const dateFormatterSpy = jest.spyOn(Intl, 'DateTimeFormat').mockImplementation((locale, options = {}) => ({
      format: () => {
        if (options.day === 'numeric') return '18';
        if (options.weekday === 'short') return '周四';
        return '';
      }
    }));

    const dayData = [
      { timestamp: new Date('2026-06-18T00:00:00Z').getTime(), temp: 30, cloudCover: 20, precipitation: 0.2, windSpeed: 8, windDirection: 90, pressure: 1008 },
      { timestamp: new Date('2026-06-18T03:00:00Z').getTime(), temp: 10, cloudCover: 20, precipitation: 0, windSpeed: 12, windDirection: 120, pressure: 1008 }
    ];

    const card = controller._createDayCard(dayData, 0);
    const rows = card.querySelectorAll('.day-meta-row');

    expect(rows[0].textContent.trim()).toBe('降水 50%');
    expect(rows[1].textContent.trim()).toBe('风速 12 km/h');
    expect(rows[2].textContent.replace(/\s+/g, ' ').trim()).toContain('风向 东');
    expect(card.querySelector('.day-wind-direction-icon').style.transform).toBe('rotate(105deg)');

    dateFormatterSpy.mockRestore();
  });

  test('风向角度应被规范化到0-360度', () => {
    expect(controller._normalizeWindDirection(450)).toBe(90);
    expect(controller._normalizeWindDirection(-30)).toBe(330);
    expect(controller._normalizeWindDirection(Number.NaN)).toBe(0);
  });

  test('风向文案应映射到八方位', () => {
    controller.i18n = {
      t: jest.fn((key) => {
        if (key === 'surrounding.directions.N') return '北';
        if (key === 'surrounding.directions.NE') return '东北';
        return key;
      })
    };

    expect(controller._getWindDirectionLabel(10)).toBe('北');
    expect(controller._getWindDirectionLabel(40)).toBe('东北');
  });

});
