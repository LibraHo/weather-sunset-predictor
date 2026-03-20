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

    // UI 精修 64.11.5：检查新的温度条结构
    const tempBarContainer = card.querySelector('.temp-bar-container');
    expect(tempBarContainer).not.toBeNull();

    const tempBarLabels = card.querySelector('.temp-bar-labels');
    expect(tempBarLabels).not.toBeNull();

    const minTempEl = tempBarLabels.querySelector('.min-temp');
    const maxTempEl = tempBarLabels.querySelector('.max-temp');

    expect(minTempEl.textContent).toContain('10°');
    expect(maxTempEl.textContent).toContain('30°');

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

    // UI 精修 64.11.5：检查新的图标化横排结构
    const iconsRow = card.querySelector('.day-meta-icons-row');
    expect(iconsRow).not.toBeNull();

    const iconItems = card.querySelectorAll('.day-meta-icon');
    expect(iconItems.length).toBe(3); // 降水、风速、风向

    // 检查降水图标项
    const precipIcon = iconItems[0];
    expect(precipIcon.querySelector('.icon').textContent).toBe('💧');
    expect(precipIcon.querySelector('.value').textContent).toBe('50%');

    // 检查风速图标项
    const windSpeedIcon = iconItems[1];
    expect(windSpeedIcon.querySelector('.icon').textContent).toBe('💨');
    expect(windSpeedIcon.querySelector('.value').textContent).toBe('12 km/h');

    // 检查风向图标项
    const windDirIcon = iconItems[2];
    expect(windDirIcon.querySelector('.value').textContent).toContain('东');
    expect(windDirIcon.querySelector('.icon').style.transform).toBe('rotate(105deg)');

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

  test('64.10: 中国火烧云地图应支持拖拽平移，禁用缩放', () => {
    const options = controller._getChinaSpotsMapOptions();

    expect(options.zoom).toBe(5);  // 默认比例更大
    expect(options.minZoom).toBe(5);  // 固定 zoom
    expect(options.maxZoom).toBe(5);  // 固定 zoom
    expect(options.zoomControl).toBe(false);  // 禁用缩放控件
    expect(options.dragging).toBe(true);  // 允许拖拽
    expect(options.scrollWheelZoom).toBe(false);  // 禁用滚轮缩放
    expect(options.doubleClickZoom).toBe(false);  // 禁用双击缩放
    expect(options.touchZoom).toBe(false);  // 禁用触摸缩放
  });

  test('64.10: 初始化中国火烧云地图时应支持交互并锁定大陆边界', async () => {
    document.body.innerHTML = `
      <section id="china-spots-section" class="hidden"></section>
      <div id="china-spots-map"></div>
      <div id="china-spots-timestamp"></div>
      <div id="china-spots-empty" class="hidden"></div>
    `;

    const mapStub = {
      fitBounds: jest.fn(),
      setMaxBounds: jest.fn()
    };
    const tileLayerStub = { addTo: jest.fn() };

    window.L = {
      map: jest.fn(() => mapStub),
      tileLayer: jest.fn(() => tileLayerStub),
      latLngBounds: jest.fn(() => ({ type: 'mainland-bounds' }))
    };

    const activeOverlay = {
      setPeriod: jest.fn(),
      init: jest.fn(),
      loadAndRender: jest.fn(),
      getSpotCount: jest.fn(() => 0),
      getUpdatedAt: jest.fn(() => null),
      hide: jest.fn(),
      setButtonVisible: jest.fn()
    };

    controller.currentOverlayType = 'sunset';
    controller.currentLocation = { lat: 39.9, lon: 116.4 };
    controller.chinaSpotsOverlays = {
      sunrise: activeOverlay,
      sunset: activeOverlay
    };

    await controller._initChinaSpotsMap();

    expect(window.L.map).toHaveBeenCalledWith(
      document.getElementById('china-spots-map'),
      expect.objectContaining({
        zoom: 5,
        minZoom: 5,
        maxZoom: 5,
        dragging: true,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        touchZoom: false,
        zoomControl: false
      })
    );

    expect(mapStub.fitBounds).toHaveBeenCalledWith(
      { type: 'mainland-bounds' },
      { animate: false, padding: [8, 8] }
    );
    expect(mapStub.setMaxBounds).toHaveBeenCalledWith({ type: 'mainland-bounds' });
  });

  test('64.8: 朝/晚双 overlay 应独立切换，非激活 overlay 自动隐藏', async () => {
    controller.currentOverlayType = 'sunset';
    controller.fireCloudOverlayEnabled = false;
    controller._chinaSpotsMapInstance = {};
    controller._setChinaSpotsEmptyState = jest.fn();
    controller._renderChinaSpotsTimestamp = jest.fn();

    const sunriseOverlay = {
      setPeriod: jest.fn(),
      loadAndRender: jest.fn(),
      hide: jest.fn(),
      setButtonVisible: jest.fn(),
      getSpotCount: jest.fn(() => 3)
    };
    const sunsetOverlay = {
      setPeriod: jest.fn(),
      loadAndRender: jest.fn(),
      hide: jest.fn(),
      setButtonVisible: jest.fn(),
      getSpotCount: jest.fn(() => 0)
    };

    controller.chinaSpotsOverlays = {
      sunrise: sunriseOverlay,
      sunset: sunsetOverlay
    };

    await controller.setOverlayType('sunrise');

    expect(controller.currentOverlayType).toBe('sunrise');
    expect(sunriseOverlay.setPeriod).toHaveBeenCalledWith('sunrise');
    expect(sunriseOverlay.loadAndRender).toHaveBeenCalledWith('sunrise');
    expect(sunriseOverlay.setButtonVisible).toHaveBeenCalledWith(true);

    expect(sunsetOverlay.hide).toHaveBeenCalled();
    expect(sunsetOverlay.setButtonVisible).toHaveBeenCalledWith(false);

    expect(controller._setChinaSpotsEmptyState).toHaveBeenCalledWith(false);
    expect(controller._renderChinaSpotsTimestamp).toHaveBeenCalled();
  });

  test('64.8: 非中国大陆时应同时隐藏 sunrise/sunset 两层', async () => {
    document.body.innerHTML = '<section id="china-spots-section"></section><div id="china-spots-timestamp"></div>';

    controller._isMainlandChinaLocation = jest.fn(() => false);
    controller._setChinaSpotsEmptyState = jest.fn();

    const sunriseOverlay = {
      hide: jest.fn(),
      setButtonVisible: jest.fn()
    };
    const sunsetOverlay = {
      hide: jest.fn(),
      setButtonVisible: jest.fn()
    };

    controller.chinaSpotsOverlays = {
      sunrise: sunriseOverlay,
      sunset: sunsetOverlay
    };

    await controller.updateChinaSpotsForLocation({ lat: 48.8, lon: 2.3, countryCode: 'FR' });

    expect(sunriseOverlay.hide).toHaveBeenCalled();
    expect(sunsetOverlay.hide).toHaveBeenCalled();
    expect(sunriseOverlay.setButtonVisible).toHaveBeenCalledWith(false);
    expect(sunsetOverlay.setButtonVisible).toHaveBeenCalledWith(false);
  });

  test('64.6: 港澳台查询城市应隐藏大陆火烧云图层', async () => {
    document.body.innerHTML = '<section id="china-spots-section"></section><div id="china-spots-timestamp"></div>';

    controller._setChinaSpotsEmptyState = jest.fn();
    controller._hideInactiveChinaSpotsOverlays = jest.fn();
    controller._isMainlandChinaLocation = WeatherController.prototype._isMainlandChinaLocation;

    const section = document.getElementById('china-spots-section');

    await controller.updateChinaSpotsForLocation({ lat: 22.3193, lon: 114.1694, countryCode: 'CN', regionCode: 'HK' });
    expect(section.classList.contains('hidden')).toBe(true);

    await controller.updateChinaSpotsForLocation({ lat: 22.1987, lon: 113.5439, countryCode: 'CN', regionCode: 'MO' });
    expect(section.classList.contains('hidden')).toBe(true);

    await controller.updateChinaSpotsForLocation({ lat: 25.033, lon: 121.5654, countryCode: 'CN', regionCode: 'TW' });
    expect(section.classList.contains('hidden')).toBe(true);
  });

});
