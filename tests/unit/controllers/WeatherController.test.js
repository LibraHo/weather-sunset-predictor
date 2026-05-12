import { jest } from '@jest/globals';
import { readFileSync } from 'fs';
import WeatherController from '../../../src/controllers/WeatherController.js';

describe('WeatherController - 24小时温度连续化', () => {
  let controller;

  beforeEach(() => {
    controller = Object.create(WeatherController.prototype);
  });

  test('fetchWeather: test 城市应生成随机 UI 测试数据且不调用天气 API', async () => {
    controller.windyAPIService = {
      fetchWeatherData: jest.fn(() => Promise.reject(new Error('API should not be called')))
    };
    controller.storageService = {
      getCachedWeatherData: jest.fn(),
      cacheWeatherData: jest.fn()
    };

    const data = await controller.fetchWeather({ name: 'test', lat: 0, lon: 0, isValid: () => true });

    expect(controller.windyAPIService.fetchWeatherData).not.toHaveBeenCalled();
    expect(controller.storageService.getCachedWeatherData).not.toHaveBeenCalled();
    expect(controller.storageService.cacheWeatherData).not.toHaveBeenCalled();
    expect(data).toHaveLength(168);
    expect(data.providerMeta).toMatchObject({ name: 'manual-test', weatherModel: 'random-ui-test' });
    expect(data[0].isManualTestCity).toBe(true);
    expect(data[0].providerMeta).toMatchObject({ name: 'manual-test' });
    expect(data[0].isValid()).toBe(true);
  });

  test('renderRadarCompass: test 城市应使用随机周边云况数据且不调用周边 API', async () => {
    document.body.innerHTML = '<div id="radar-compass-sunset"></div>';
    controller.i18n = { t: (key) => key };
    controller.predictionAPIService = {
      getSurrounding: jest.fn(() => Promise.reject(new Error('API should not be called')))
    };
    controller._radarCompass = { render: jest.fn() };

    const renderPromise = controller.renderRadarCompass({ name: 'test', lat: 0, lon: 0, isValid: () => true }, 'sunset');
    expect(document.querySelector('.radar-compass-loading')).not.toBeNull();
    expect(document.querySelector('.radar-compass-loading-spinner')).not.toBeNull();

    await renderPromise;

    expect(controller.predictionAPIService.getSurrounding).not.toHaveBeenCalled();
    expect(controller._radarCompass.render).toHaveBeenCalledTimes(1);
    const payload = controller._radarCompass.render.mock.calls[0][1];
    expect(payload.predictionType).toBe('sunset');
    expect(payload.directions).toHaveLength(8);
    expect(payload.directions[0].cloudLayers).toEqual(expect.objectContaining({ low: expect.any(Number), mid: expect.any(Number), high: expect.any(Number) }));
    expect(payload.sunAzimuths).toHaveProperty('sunset');
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

  test('每日概览应按"降水概率/风速风向"顺序展示天气信息', () => {
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
      { timestamp: new Date('2026-06-18T00:00:00Z').getTime(), temp: 30, humidity: 60, cloudCover: 20, precipitation: 0.2, windSpeed: 8, windDirection: 90, pressure: 1008 },
      { timestamp: new Date('2026-06-18T03:00:00Z').getTime(), temp: 10, humidity: 80, cloudCover: 20, precipitation: 0, windSpeed: 12, windDirection: 120, pressure: 1008 }
    ];

    const card = controller._createDayCard(dayData, 0);

    const metaInline = card.querySelector('.day-meta-inline');
    expect(metaInline).not.toBeNull();

    const chips = card.querySelectorAll('.day-meta-chip');
    expect(chips).toHaveLength(2);
    expect(card.querySelector('.day-meta-humidity')).toBeNull();

    // 纵向信息：降水概率 + 风速/风向
    expect(chips[0].querySelector('.day-meta-svg-icon svg')).not.toBeNull();
    expect(chips[0].textContent).toContain('50%');
    expect(chips[1].querySelector('.day-meta-svg-icon svg')).not.toBeNull();
    expect(chips[1].textContent).toContain('12 km/h');
    const windDirIcon = chips[1].querySelector('.day-wind-direction-icon');
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

  test('_renderChinaSpotsTimestamp: 显示当前激活图层时间，不被另一时段覆盖', () => {
    document.body.innerHTML = '<div id="china-spots-timestamp"></div>';
    controller.i18n = {
      getLanguage: () => 'en-US',
      t: key => ({ 'weatherMap.updatedAt': 'Updated at {{time}}' }[key] || key)
    };

    const sunriseOverlay = { getUpdatedAt: jest.fn(() => '2026-01-01T12:34:00.000Z') };
    const sunsetOverlay = { getUpdatedAt: jest.fn(() => '2026-01-01T02:12:00.000Z') };
    controller.chinaSpotsOverlayManager = {
      getActivePeriod: jest.fn(() => 'sunset'),
      getOverlay: jest.fn(period => period === 'sunrise' ? sunriseOverlay : sunsetOverlay)
    };

    controller._renderChinaSpotsTimestamp();

    expect(document.getElementById('china-spots-timestamp').textContent).toContain(':12');
    expect(document.getElementById('china-spots-timestamp').textContent).not.toContain(':34');
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


  test('天气指标区应使用 2x3 模板并包含 6 个 SVG 指标卡', () => {
    const html = readFileSync('index.html', 'utf8');
    document.body.innerHTML = html;

    const grid = document.querySelector('.weather-feature-stack.weather-metric-grid');
    expect(grid).not.toBeNull();

    const cards = [...grid.querySelectorAll('.weather-metric-card')];
    expect(cards).toHaveLength(6);
    expect(grid.querySelector('#current-precipitation')).not.toBeNull();
    expect(grid.querySelector('[data-i18n="weather.precipitation"]')).not.toBeNull();

    cards.forEach(card => {
      expect(card.querySelector('.weather-metric-icon svg')).not.toBeNull();
      expect(card.querySelector('.weather-label')).not.toBeNull();
      expect(card.querySelector('.weather-value')).not.toBeNull();
    });
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
        <span id="current-aerosol"></span>
        <span id="current-precipitation"></span>
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
      visibility: 12,
      aerosolOpticalDepth: 0.12,
      precipitation: 1.6
    }], { name: '北京', lat: 39.9, lon: 116.4 });

    const weatherData = document.getElementById('weather-data');
    expect(weatherData.classList.contains('hidden')).toBe(false);
    expect(weatherData.style.display).toBe('block');
    expect(document.getElementById('weather-section').classList.contains('hidden')).toBe(false);
    expect(document.getElementById('current-aerosol').textContent).toBe('0.12');
    expect(document.getElementById('current-aerosol').title).toBe('AOD 0.12');
    expect(document.getElementById('current-precipitation').textContent).toBe('1.6 mm');
  });

  test('updateWeatherDisplay: 当前天气应选择接近当前时间的小时点，而不是当天第一条', () => {
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
        <span id="current-aerosol"></span>
        <span id="current-precipitation"></span>
        <div id="weekly-cards"></div>
      </section>
    `;
    controller.i18n = { t: jest.fn(key => key) };
    controller.tempUnit = 'celsius';
    controller.getConvertedTemp = value => value;
    controller.formatWindSpeed = value => `${value} km/h`;
    controller.renderWeeklyOverview = jest.fn();
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-05-10T10:15:00Z').getTime());

    controller.updateWeatherDisplay([
      {
        timestamp: new Date('2026-05-09T16:00:00Z').getTime(),
        temp: 16.4,
        humidity: 73,
        cloudCover: 1,
        windSpeed: 1,
        windDirection: 0,
        pressure: 1001,
        visibility: 15,
        aerosolOpticalDepth: 0.9,
        precipitation: 0
      },
      {
        timestamp: new Date('2026-05-10T10:00:00Z').getTime(),
        temp: 31.8,
        humidity: 28,
        cloudCover: 100,
        windSpeed: 2,
        windDirection: 180,
        pressure: 997,
        visibility: 12,
        aerosolOpticalDepth: 0.12,
        precipitation: 0
      }
    ], { name: '北京', lat: 39.9, lon: 116.4 });

    expect(document.getElementById('current-temp-main').textContent).toBe('31.8');
    expect(document.getElementById('current-cloud-cover').textContent).toBe('100%');
    expect(document.getElementById('current-humidity').textContent).toBe('28%');

    nowSpy.mockRestore();
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

  test('_getWeatherIcon: 各云量/降水阈值返回稳定 SVG 图标', () => {
    expect(controller._getWeatherIcon(20, 10)).toContain('weather-icon-sunny');
    expect(controller._getWeatherIcon(50, 10)).toContain('weather-icon-partly-cloudy');
    expect(controller._getWeatherIcon(80, 10)).toContain('weather-icon-cloud');
    expect(controller._getWeatherIcon(20, 60)).toContain('weather-icon-rain');
    expect(controller._getWeatherIcon(20, 60)).not.toMatch(/[🌧️☁️⛅☀️]/u);
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

describe('WeatherController - 3天朝晚霞标签', () => {
  let controller;

  beforeEach(() => {
    controller = Object.create(WeatherController.prototype);
    controller.currentWeatherData = null;
    controller.currentView = 'overview';
    document.body.innerHTML = `
      <div id="weekly-overview"></div>
      <div id="hourly-forecast"></div>
      <div id="three-day-glow" class="hidden"></div>
      <div id="map-forecast"></div>
      <button id="overview-btn" class="active"></button>
      <button id="hourly-btn"></button>
      <button id="three-day-glow-btn"></button>
      <button id="map-btn"></button>
      <div id="forecast-loading" class="hidden"></div>
      <div id="forecast-timeline" data-loaded="false"></div>
    `;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('点击3天朝晚霞但数据未完成时显示读取条', () => {
    controller.switchView('glow');

    expect(document.getElementById('three-day-glow').classList.contains('hidden')).toBe(false);
    expect(document.getElementById('three-day-glow-btn').classList.contains('active')).toBe(true);
    expect(document.getElementById('forecast-loading').classList.contains('hidden')).toBe(false);
    expect(controller.currentView).toBe('glow');
  });

  test('3天朝晚霞已加载时不再显示读取条', () => {
    document.getElementById('forecast-timeline').dataset.loaded = 'true';

    controller.switchView('glow');

    expect(document.getElementById('forecast-loading').classList.contains('hidden')).toBe(true);
  });
});
