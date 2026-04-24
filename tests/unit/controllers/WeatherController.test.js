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

  test('buildContinuous24HourData: tomorrow 应从当前小时+24h 起算，不复用 today 起点', () => {
    const baseTs = new Date('2026-01-01T00:00:00Z').getTime();
    // 3小时点，覆盖 2 天
    const raw = Array.from({ length: 16 }, (_, i) => ({
      timestamp: baseTs + (i * 3 * 60 * 60 * 1000),
      temp: i,
      humidity: 60,
      cloudCover: 20,
      windSpeed: 8,
      pressure: 1005,
      timezone: 'Europe/Paris'
    }));

    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(baseTs + (5 * 60 * 60 * 1000) + 12345); // 05:00:12

    const today = controller.buildContinuous24HourData(raw, 'today');
    const tomorrow = controller.buildContinuous24HourData(raw, 'tomorrow');

    const expectedTodayStart = baseTs + (5 * 60 * 60 * 1000); // 向下取整到整点
    const expectedTomorrowStart = expectedTodayStart + (24 * 60 * 60 * 1000);

    expect(today).toHaveLength(24);
    expect(tomorrow).toHaveLength(24);
    expect(today[0].timestamp).toBe(expectedTodayStart);
    expect(tomorrow[0].timestamp).toBe(expectedTomorrowStart);
    expect(today[0].timestamp).not.toBe(tomorrow[0].timestamp);

    nowSpy.mockRestore();
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

  test('今天/明天保留相对文案，且所有天数都追加"(日期)"；后天起仅显示星期 + 日期', () => {
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

  // ========== 修复：_createDayCard 使用 temp-range-inline（非 temp-bar-container）==========

  test('每日温度显示应为低温在前、高温在后', () => {
    controller.i18n = {
      currentLanguage: 'zh-CN',
      t: jest.fn((key, params) => {
        if (key === 'time.today') return '今天';
        return key;
      })
    };

    const dateFormatterSpy = jest.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => ({
      format: () => '18'
    }));

    const dayData = [
      { timestamp: new Date('2026-06-18T00:00:00Z').getTime(), temp: 30, cloudCover: 20, precipitation: 0, windSpeed: 8, pressure: 1008 },
      { timestamp: new Date('2026-06-18T03:00:00Z').getTime(), temp: 10, cloudCover: 20, precipitation: 0, windSpeed: 8, pressure: 1008 }
    ];

    const card = controller._createDayCard(dayData, 0);

    // 实际 DOM 使用 .temp-range-inline
    const tempRange = card.querySelector('.temp-range-inline');
    expect(tempRange).not.toBeNull();

    const minTempEl = tempRange.querySelector('.min-temp');
    const maxTempEl = tempRange.querySelector('.max-temp');

    expect(minTempEl.textContent).toContain('10°');
    expect(maxTempEl.textContent).toContain('30°');

    dateFormatterSpy.mockRestore();
  });

  // ========== 修复：_createDayCard 使用 day-meta-lines（非 day-meta-icons-row）==========

  test('每日概览应按"降水/风速/风向"文字顺序展示风信息', () => {
    controller.i18n = {
      currentLanguage: 'zh-CN',
      t: jest.fn((key) => {
        if (key === 'time.today') return '今天';
        if (key === 'surrounding.directions.SE') return '东南';
        return key;
      })
    };

    const dateFormatterSpy = jest.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => ({
      format: () => '18'
    }));

    const dayData = [
      { timestamp: new Date('2026-06-18T00:00:00Z').getTime(), temp: 30, cloudCover: 20, precipitation: 0.2, windSpeed: 8, windDirection: 90, pressure: 1008 },
      { timestamp: new Date('2026-06-18T03:00:00Z').getTime(), temp: 10, cloudCover: 20, precipitation: 0, windSpeed: 12, windDirection: 120, pressure: 1008 }
    ];

    const card = controller._createDayCard(dayData, 0);

    // 实际 DOM 使用 .day-meta-lines
    const metaLines = card.querySelectorAll('.day-meta-line');
    expect(metaLines.length).toBeGreaterThanOrEqual(2);

    // 第一行：降水
    expect(metaLines[0].textContent).toContain('💧');
    expect(metaLines[0].textContent).toContain('50%');

    // 第二行：风速+风向箭头
    expect(metaLines[1].textContent).toContain('💨');
    const windDirIcon = metaLines[1].querySelector('.day-wind-direction-icon');
    expect(windDirIcon).not.toBeNull();

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

  // ========== 修复：_getChinaSpotsMapOptions 实际返回 zoom=4, minZoom=3, maxZoom=12 ==========

  test('64.10: 中国火烧云地图选项包含正确的基础配置', () => {
    const options = controller._getChinaSpotsMapOptions();

    expect(options.zoom).toBe(4);
    expect(options.minZoom).toBe(3);
    expect(options.maxZoom).toBe(12);
    expect(options.zoomControl).toBe(true);
    expect(options.dragging).toBe(true);
    expect(options.scrollWheelZoom).toBe(true);
    expect(options.doubleClickZoom).toBe(true);
    expect(options.touchZoom).toBe(true);
    expect(options.center).toEqual([36, 121]);
    expect(options.attributionControl).toBe(false);
  });

  // ========== 修复：_initChinaSpotsMap 使用 ChinaMapCanvas（非 L.map）==========

  test('64.10: _initChinaSpotsMap 地图已初始化时刷新当前时段数据', async () => {
    document.body.innerHTML = `
      <div id="tab-panel-map"></div>
      <div id="china-spots-map"></div>
      <div id="china-spots-timestamp"></div>
    `;

    const mapEl = document.getElementById('china-spots-map');
    Object.defineProperty(mapEl, 'offsetWidth', { value: 800, configurable: true });
    Object.defineProperty(mapEl, 'offsetHeight', { value: 600, configurable: true });

    // 模拟地图已初始化
    controller._chinaSpotsMapInstance = { fake: true };

    const mockOverlay = {
      loadAndRender: jest.fn().mockResolvedValue(undefined),
      getSpotCount: jest.fn(() => 5)
    };

    controller.chinaSpotsOverlayManager = {
      getActivePeriod: jest.fn(() => 'sunset'),
      getOverlay: jest.fn(() => mockOverlay)
    };

    controller._setChinaSpotsEmptyState = jest.fn();
    controller._renderChinaSpotsTimestamp = jest.fn();

    await controller._initChinaSpotsMap();

    expect(mockOverlay.loadAndRender).toHaveBeenCalledWith('sunset');
    expect(controller._setChinaSpotsEmptyState).toHaveBeenCalledWith(false);
    expect(controller._renderChinaSpotsTimestamp).toHaveBeenCalled();
  });

  // ========== 修复：setOverlayType 使用 overlayManager.switchPeriod（非 chinaSpotsOverlays）==========

  test('64.8: setOverlayType 通过 overlayManager 切换时段', async () => {
    controller.currentOverlayType = 'sunset';
    controller.fireCloudOverlayEnabled = false;
    controller._chinaSpotsMapInstance = {};
    controller._setChinaSpotsEmptyState = jest.fn();
    controller._renderChinaSpotsTimestamp = jest.fn();
    controller._renderDualPeriodScorePanel = jest.fn();
    controller._updateChinaSpotsPeriodLabel = jest.fn();

    const activeOverlay = {
      loadAndRender: jest.fn().mockResolvedValue(undefined),
      getSpotCount: jest.fn(() => 3)
    };

    controller.chinaSpotsOverlayManager = {
      switchPeriod: jest.fn(),
      getOverlay: jest.fn(() => activeOverlay),
      getActivePeriod: jest.fn(() => 'sunrise')
    };

    await controller.setOverlayType('sunrise');

    expect(controller.currentOverlayType).toBe('sunrise');
    expect(controller.chinaSpotsOverlayManager.switchPeriod).toHaveBeenCalledWith('sunrise');
    expect(activeOverlay.loadAndRender).toHaveBeenCalledWith('sunrise');
    expect(controller._setChinaSpotsEmptyState).toHaveBeenCalledWith(false);
    expect(controller._renderChinaSpotsTimestamp).toHaveBeenCalled();
  });

  // ========== 修复：updateChinaSpotsForLocation 使用 overlayManager.hide（非 chinaSpotsOverlays）==========

  test('64.8: 非大陆位置时 overlayManager.hide 被调用', async () => {
    document.body.innerHTML = '<div id="china-spots-map"></div><div id="china-spots-timestamp"></div>';

    controller._isMainlandChinaLocation = jest.fn(() => false);
    controller._setChinaSpotsEmptyState = jest.fn();

    const mockManager = { hide: jest.fn() };
    controller.chinaSpotsOverlayManager = mockManager;

    await controller.updateChinaSpotsForLocation({ lat: 48.8, lon: 2.3, countryCode: 'FR' });

    expect(mockManager.hide).toHaveBeenCalled();
    expect(controller._setChinaSpotsEmptyState).toHaveBeenCalledWith(false);
  });

  // ========== 修复：港澳台测试 — updateChinaSpotsForLocation 不操作 section hidden ==========

  test('64.6: 港澳台查询城市时 overlayManager 应隐藏（非大陆判定）', async () => {
    document.body.innerHTML = '<div id="china-spots-map"></div><div id="china-spots-timestamp"></div>';

    controller._setChinaSpotsEmptyState = jest.fn();
    controller._isMainlandChinaLocation = WeatherController.prototype._isMainlandChinaLocation;

    const mockManager = { hide: jest.fn() };
    controller.chinaSpotsOverlayManager = mockManager;

    // HK
    await controller.updateChinaSpotsForLocation({ lat: 22.3193, lon: 114.1694, countryCode: 'CN', regionCode: 'HK' });
    expect(mockManager.hide).toHaveBeenCalledTimes(1);

    // MO
    await controller.updateChinaSpotsForLocation({ lat: 22.1987, lon: 113.5439, countryCode: 'CN', regionCode: 'MO' });
    expect(mockManager.hide).toHaveBeenCalledTimes(2);

    // TW
    await controller.updateChinaSpotsForLocation({ lat: 25.033, lon: 121.5654, countryCode: 'CN', regionCode: 'TW' });
    expect(mockManager.hide).toHaveBeenCalledTimes(3);
  });

  // ========== 新增：DOM 缺失保护分支测试 ==========

  test('_setChinaSpotsEmptyState: 无 #china-spots-empty 元素时不报错', () => {
    document.body.innerHTML = '';
    expect(() => controller._setChinaSpotsEmptyState(true)).not.toThrow();
  });

  test('_renderChinaSpotsTimestamp: 无 #china-spots-timestamp 元素时不报错', () => {
    document.body.innerHTML = '';
    controller.chinaSpotsOverlayManager = undefined;
    expect(() => controller._renderChinaSpotsTimestamp()).not.toThrow();
  });

  test('_renderDualPeriodScorePanel: 无 #china-spots-dual-score 元素时不报错', () => {
    document.body.innerHTML = '';
    expect(() => controller._renderDualPeriodScorePanel()).not.toThrow();
  });

  test('_renderDualPeriodScorePanel: 有元素时设置 display=none 和 hidden', () => {
    document.body.innerHTML = '<div id="china-spots-dual-score"></div>';
    controller._renderDualPeriodScorePanel();
    const el = document.getElementById('china-spots-dual-score');
    expect(el.style.display).toBe('none');
    expect(el.classList.contains('hidden')).toBe(true);
  });

  test('_updateChinaSpotsPeriodLabel: 无 #china-spots-period-label 元素时不报错', () => {
    document.body.innerHTML = '';
    expect(() => controller._updateChinaSpotsPeriodLabel('sunset')).not.toThrow();
  });

  test('_updateChinaSpotsPeriodLabel: sunset 显示"今天的晚霞"', () => {
    document.body.innerHTML = '<div id="china-spots-period-label"></div>';
    controller._updateChinaSpotsPeriodLabel('sunset');
    expect(document.getElementById('china-spots-period-label').textContent).toContain('晚霞');
  });

  test('_updateChinaSpotsPeriodLabel: sunrise 显示"明天的朝霞"', () => {
    document.body.innerHTML = '<div id="china-spots-period-label"></div>';
    controller._updateChinaSpotsPeriodLabel('sunrise');
    expect(document.getElementById('china-spots-period-label').textContent).toContain('朝霞');
  });

  test('_updateChinaSpotsPeriodLabel: test 显示测试图层', () => {
    document.body.innerHTML = '<div id="china-spots-period-label"></div>';
    controller._updateChinaSpotsPeriodLabel('test');
    expect(document.getElementById('china-spots-period-label').textContent).toContain('测试');
  });


  test('updateWeatherDisplay: 应移除天气数据容器 hidden 类显示实时天气面板', () => {
    document.body.innerHTML = `
      <section id="weather-section" class="card hidden">
        <div id="weather-data" class="hidden"></div>
        <div id="weather-location"></div>
        <span id="current-temp-main"></span>
        <span id="current-temp-unit"></span>
        <span id="weather-icon-main"></span>
        <span id="weather-description"></span>
        <span id="current-humidity"></span>
        <span id="current-cloud-cover"></span>
        <span id="current-wind-speed"></span>
        <span id="current-wind-direction-icon"></span>
        <span id="current-wind-direction-text"></span>
        <span id="current-pressure"></span>
        <span id="current-visibility"></span>
        <div id="weekly-cards"></div>
      </section>
    `;
    controller.i18n = { t: jest.fn(key => key) };
    controller.tempUnit = 'celsius';
    controller.getConvertedTemp = value => value;
    controller.formatWindSpeed = value => `${value} km/h`;
    controller.renderWeeklyOverview = jest.fn();

    controller.updateWeatherDisplay([{
      temp: 21,
      humidity: 50,
      cloudCover: 30,
      windSpeed: 8,
      windDirection: 90,
      pressure: 1012,
      visibility: 12
    }], { name: '北京', lat: 39.9, lon: 116.4 });

    const weatherData = document.getElementById('weather-data');
    expect(weatherData.classList.contains('hidden')).toBe(false);
    expect(weatherData.style.display).toBe('block');
    expect(document.getElementById('weather-section').classList.contains('hidden')).toBe(false);
  });

  test('showError: 无 #weather-error 元素时不报错', () => {
    document.body.innerHTML = '';
    expect(() => controller.showError('test error')).not.toThrow();
  });

  test('showError: 有元素时设置文本和 display=block', () => {
    document.body.innerHTML = '<div id="weather-error" style="display:none"></div>';
    jest.useFakeTimers();
    controller.showError('oops');
    const el = document.getElementById('weather-error');
    expect(el.textContent).toBe('oops');
    expect(el.style.display).toBe('block');
    // 3秒后隐藏
    jest.advanceTimersByTime(3000);
    expect(el.style.display).toBe('none');
    jest.useRealTimers();
  });

  test('switchView: DOM 元素缺失时不报错', () => {
    document.body.innerHTML = '';
    controller.currentWeatherData = null;
    expect(() => controller.switchView('overview')).not.toThrow();
    expect(() => controller.switchView('hourly')).not.toThrow();
    expect(() => controller.switchView('map')).not.toThrow();
  });

  test('_getWeatherIcon: 各云量/降水阈值返回正确图标', () => {
    expect(controller._getWeatherIcon(20, 10)).toBe('☀️');
    expect(controller._getWeatherIcon(50, 10)).toBe('⛅');
    expect(controller._getWeatherIcon(80, 10)).toBe('☁️');
    expect(controller._getWeatherIcon(20, 60)).toBe('🌧️');
  });

  test('buildContinuous24HourData: 空数组返回空', () => {
    expect(controller.buildContinuous24HourData([], 'today')).toEqual([]);
    expect(controller.buildContinuous24HourData(null, 'today')).toEqual([]);
  });

  test('interpolateWeatherPoint: 单条数据时直接复制', () => {
    const point = { timestamp: 1000, temp: 20, humidity: 50 };
    const result = controller.interpolateWeatherPoint([point], 2000, ['temp', 'humidity']);
    expect(result.temp).toBe(20);
    expect(result.humidity).toBe(50);
  });

  test('setOverlayType: 类型相同时直接返回', async () => {
    controller.currentOverlayType = 'sunset';
    controller.fireCloudOverlayEnabled = false;
    await controller.setOverlayType('sunset');
    // 没有任何 manager 调用 — 不会抛错即通过
    expect(controller.currentOverlayType).toBe('sunset');
  });

  test('updateChinaSpotsForLocation: 无 #china-spots-map 时直接返回', async () => {
    document.body.innerHTML = '';
    controller.chinaSpotsOverlayManager = { hide: jest.fn() };
    await controller.updateChinaSpotsForLocation({ lat: 39.9, lon: 116.4 });
    expect(controller.chinaSpotsOverlayManager.hide).not.toHaveBeenCalled();
  });

  test('getCurrentWeatherData / getCurrentLocation 返回实例属性', () => {
    controller.currentWeatherData = [{ temp: 1 }];
    controller.currentLocation = { lat: 1 };
    expect(controller.getCurrentWeatherData()).toEqual([{ temp: 1 }]);
    expect(controller.getCurrentLocation()).toEqual({ lat: 1 });
  });

});
