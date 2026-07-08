/**
 * PredictionController 单元测试
 *
 * 测试预测控制器的功能，包括：
 * - 构造函数初始化
 * - 预测生成与显示
 * - 方位角渲染
 * - 时间格式化
 * - 评分质量映射
 */

import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
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
  const rootDir = path.resolve(process.cwd());

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
    predictionController.i18n.currentLanguage = 'zh-CN';
    document.body.innerHTML = '';
  });

  describe('构造函数', () => {
    test('应该正确初始化控制器', () => {
      expect(predictionController.storageService).toBe(mockStorageService);
      expect(predictionController.predictions).toEqual([]);
      expect(predictionController.predictionService).toBeTruthy();
      expect(predictionController.useEnhancedModel).toBe(true);
    });
  });

  describe('_calculatePredictionWithBackend', () => {
    test('manual-test 天气数据应走前端本地预测，不调用后端 API', async () => {
      const localResult = { score: 66, quality: 'good' };
      predictionController.predictionService = {
        calculatePrediction: jest.fn(() => localResult)
      };
      predictionController.predictionAPIService = {
        calculate: jest.fn(() => Promise.reject(new Error('backend should not be called')))
      };
      predictionController.features = { USE_BACKEND_PREDICTION: true };

      const weatherData = {
        timestamp: Date.now(),
        timezone: 'Asia/Shanghai',
        providerMeta: { name: 'manual-test' }
      };
      const result = await predictionController._calculatePredictionWithBackend(weatherData, new Date(), 0, 0, 'sunset');

      expect(result).toBe(localResult);
      expect(predictionController.predictionService.calculatePrediction).toHaveBeenCalled();
      expect(predictionController.predictionAPIService.calculate).not.toHaveBeenCalled();
    });

    test('client-fallback 模式下后端预测超时应回退到前端本地预测', async () => {
      localStorage.setItem('weather_fetch_mode', 'client-fallback');
      const localResult = { score: 52, quality: 'good', type: 'sunset' };
      predictionController.weatherFetchMode = 'client-fallback';
      predictionController.features = { USE_BACKEND_PREDICTION: true };
      predictionController.predictionService = {
        calculatePrediction: jest.fn(() => localResult)
      };
      const timeoutError = new Error('timeout');
      timeoutError.code = 'WEATHER_UPSTREAM_TIMEOUT';
      predictionController.predictionAPIService = {
        calculate: jest.fn(() => Promise.reject(timeoutError))
      };

      const weatherData = {
        timestamp: Date.now(),
        timezone: 'Asia/Shanghai',
        temp: 20,
        humidity: 60,
        cloudCover: 80,
        lowClouds: 5,
        midClouds: 60,
        highClouds: 80
      };
      const result = await predictionController._calculatePredictionWithBackend(
        weatherData,
        new Date('2026-05-10T10:00:00Z'),
        39.9,
        116.4,
        'sunset',
        [weatherData]
      );

      expect(result).toBe(localResult);
      expect(predictionController.predictionAPIService.calculate).toHaveBeenCalledTimes(2);
      expect(predictionController.predictionAPIService.calculate.mock.calls[1][5]).toEqual(
        expect.objectContaining({ clientWeatherFallback: true })
      );
      expect(predictionController.predictionService.calculatePrediction).toHaveBeenCalledWith(
        weatherData,
        expect.any(Date),
        39.9,
        116.4,
        'sunset',
        expect.objectContaining({ timezone: 'Asia/Shanghai' })
      );
    });

    test('client-fallback 模式也应复用后端闭环批量预测缓存，避免再发单条请求', async () => {
      localStorage.setItem('weather_fetch_mode', 'client-fallback');
      const date = new Date('2026-05-10T10:00:00Z');
      const cachedPrediction = { score: 80, quality: 'excellent', type: 'sunset' };
      predictionController.weatherFetchMode = 'client-fallback';
      predictionController.features = { USE_BACKEND_PREDICTION: true };
      predictionController._closedLoopBatchPredictionMap = new Map([
        [predictionController._predictionBatchKey('sunset', date), cachedPrediction]
      ]);
      predictionController.predictionAPIService = {
        calculate: jest.fn(() => Promise.reject(new Error('single request should not be called')))
      };

      const result = await predictionController._calculatePredictionWithBackend(
        { timestamp: date.getTime(), timezone: 'Asia/Shanghai' },
        date,
        39.9,
        116.4,
        'sunset',
        []
      );

      expect(result).toBe(cachedPrediction);
      expect(predictionController.predictionAPIService.calculate).not.toHaveBeenCalled();
    });

    test('client-fallback 批量预测失败后，本轮单条预测应直接走浏览器天气兜底', async () => {
      localStorage.setItem('weather_fetch_mode', 'client-fallback');
      const date = new Date('2026-05-10T10:00:00Z');
      const fallbackPrediction = { score: 61, quality: 'good', type: 'sunset' };
      predictionController.weatherFetchMode = 'client-fallback';
      predictionController.features = { USE_BACKEND_PREDICTION: true };
      predictionController._forceClientWeatherPredictionFallback = true;
      predictionController.predictionService = {
        calculatePrediction: jest.fn(() => ({ score: 40 }))
      };
      predictionController.predictionAPIService = {
        calculate: jest.fn(() => Promise.resolve(fallbackPrediction))
      };

      const result = await predictionController._calculatePredictionWithBackend(
        { timestamp: date.getTime(), timezone: 'Asia/Shanghai', _prevHourData: { timestamp: date.getTime() - 3600000 } },
        date,
        39.9,
        116.4,
        'sunset',
        []
      );

      expect(result).toBe(fallbackPrediction);
      expect(predictionController.predictionAPIService.calculate).toHaveBeenCalledTimes(1);
      expect(predictionController.predictionAPIService.calculate.mock.calls[0][5]).toEqual(
        expect.objectContaining({ clientWeatherFallback: true })
      );
    });
  });


  describe('formatTime', () => {
    test('应该按目标地点时区格式化时间，而不是浏览器/用户时区', () => {
      const beijingSunriseInstant = new Date('2026-04-24T21:22:00.000Z');
      expect(predictionController.formatTime(beijingSunriseInstant, 'Asia/Shanghai')).toBe('05:22');
      expect(predictionController.formatTime(beijingSunriseInstant, 'Asia/Qatar')).toBe('00:22');
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

  describe('getQualityClass', () => {
    test('按公开评分解读分档从分数推导质量等级', () => {
      expect(predictionController.getQualityFromScore(85)).toBe('excellent');
      expect(predictionController.getQualityFromScore(77)).toBe('good');
      expect(predictionController.getQualityFromScore(45)).toBe('fair');
      expect(predictionController.getQualityFromScore(39)).toBe('poor');
    });

    test('68 分和 45 分使用不同评分主题颜色', () => {
      expect(predictionController.getScoreTheme('fair', 68)[1]).toBe('var(--score-good-color, #fb923c)');
      expect(predictionController.getScoreTheme('good', 77)[1]).toBe('var(--score-good-color, #fb923c)');
      expect(predictionController.getScoreTheme('fair', 45)[1]).toBe('var(--score-fair-color, #fdba74)');
    });

    test('应映射 excellent 为正确类名', () => {
      expect(predictionController.getQualityClass('excellent')).toBeTruthy();
    });

    test('应映射 good 为正确类名', () => {
      expect(predictionController.getQualityClass('good')).toBeTruthy();
    });

    test('应映射 fair 为正确类名', () => {
      expect(predictionController.getQualityClass('fair')).toBeTruthy();
    });

    test('应映射 poor 为正确类名', () => {
      expect(predictionController.getQualityClass('poor')).toBeTruthy();
    });

    test('未知质量应返回有效值', () => {
      const result = predictionController.getQualityClass('unknown');
      expect(result).toBeDefined();
    });
  });

  describe('getQualityLabel', () => {
    test('应映射 excellent 为翻译键', () => {
      expect(predictionController.getQualityLabel('excellent')).toBeTruthy();
    });

    test('应映射 good 为翻译键', () => {
      expect(predictionController.getQualityLabel('good')).toBeTruthy();
    });

    test('应映射 fair 为翻译键', () => {
      expect(predictionController.getQualityLabel('fair')).toBeTruthy();
    });

    test('应映射 poor 为翻译键', () => {
      expect(predictionController.getQualityLabel('poor')).toBeTruthy();
    });
  });

  describe('clear-sunset advice copy', () => {
    test('晴空通透场景应显示可以出门看看，而不是低分弱观赏判断', () => {
      predictionController.i18n = {
        currentLanguage: 'zh-CN',
        getCurrentLanguage: () => 'zh-CN',
        t: (key) => ({
          'prediction.status.casualViewingOk': '可以出门看看',
          'prediction.analysisConclusion.clearSunset': '火烧云不明显，日落通透。'
        }[key] || key)
      };

      expect(predictionController.getScoreDescription(25, { advice: 'casual_viewing_ok' })).toBe('可以出门看看');
      expect(predictionController.buildAnalysisConclusion(
        { description: 'clear_sunset_transparent', breakdown: {} },
        25,
        { high: 1, mid: 1, low: 1 }
      )).toBe('火烧云不明显，日落通透。');
    });
  });

  describe('getLocalizedAzimuthDirection', () => {
    test('296° 应返回 西偏北 26°，避免“西北偏西”这类不自然表述', () => {
      predictionController.i18n = { currentLanguage: 'zh-CN' };
      const dir = predictionController.getLocalizedAzimuthDirection({ sunAzimuth: 296 });
      expect(dir).toBe('西偏北 26°');
      expect(dir).not.toBe('西北偏西');
    });

    test('90° 应返回 正东', () => {
      predictionController.i18n = { currentLanguage: 'zh-CN' };
      const dir = predictionController.getLocalizedAzimuthDirection({ sunAzimuth: 90 });
      expect(dir).toBe('正东');
    });

    test('0° 应返回 正北', () => {
      predictionController.i18n = { currentLanguage: 'zh-CN' };
      const dir = predictionController.getLocalizedAzimuthDirection({ sunAzimuth: 0 });
      expect(dir).toBe('正北');
    });

    test('英文环境 296° 应返回 WNW', () => {
      predictionController.i18n = { currentLanguage: 'en-US' };
      const dir = predictionController.getLocalizedAzimuthDirection({ sunAzimuth: 296 });
      expect(dir).toBe('WNW');
    });

    test('日语环境 296° 应返回西北西，不应残留中文“西北偏西”', () => {
      predictionController.i18n = { currentLanguage: 'ja-JP' };
      const dir = predictionController.getLocalizedAzimuthDirection({ sunAzimuth: 296 });
      expect(dir).toBe('西北西');
      expect(dir).not.toBe('西北偏西');
    });

    test('繁中环境 74° 应返回東偏北 16°', () => {
      predictionController.i18n = { currentLanguage: 'zh-TW' };
      const dir = predictionController.getLocalizedAzimuthDirection({ sunAzimuth: 74 });
      expect(dir).toBe('東偏北 16°');
    });

    test('韩语环境 296° 应返回서북서，不应 fallback 到 WNW', () => {
      predictionController.i18n = { currentLanguage: 'ko-KR' };
      const dir = predictionController.getLocalizedAzimuthDirection({ sunAzimuth: 296 });
      expect(dir).toBe('서북서');
      expect(dir).not.toBe('WNW');
    });


    test('日出/日落方向展示不应附加误导性的箭头', () => {
      const prediction = {
        sunAzimuth: 74,
        shouldShowAzimuth: () => true
      };
      const direction = predictionController.getPredictionDirectionText(prediction, 'sunrise');
      expect(direction).toBe('东偏北 16°');
      expect(direction).not.toContain('↑');
    });

    test('null azimuth 应返回空字符串', () => {
      const dir = predictionController.getLocalizedAzimuthDirection({ sunAzimuth: null });
      expect(dir).toBe('');
    });

    test('undefined prediction 应返回空字符串', () => {
      const dir = predictionController.getLocalizedAzimuthDirection(null);
      expect(dir).toBe('');
    });
  });

  describe('renderSinglePrediction', () => {
    test('应包含评分 SVG 仪表盘', () => {
      const prediction = {
        score: 75,
        quality: 'good',
        type: 'sunset',
        sunsetTime: new Date('2024-06-21T19:45:00+08:00'),
        sunAzimuth: null,
        cloudLayers: null,
        factors: {
          cloudCover: { value: 50 },
          humidity: { value: 60 }
        },
        getOptimalViewingWindow: () => ({
          start: new Date('2024-06-21T19:15:00+08:00'),
          end: new Date('2024-06-21T20:15:00+08:00')
        }),
        shouldShowAzimuth: () => false
      };

      const html = predictionController.renderSinglePrediction(
        prediction, 'sunset', '晚霞', '日落时间', '今日', 'sunset'
      );

      expect(html).toContain('75');
      expect(html).toContain('score-gauge-large');
      expect(html).toContain('prediction-app-card');
      expect(html).toContain('phenomenon-title-card');
      expect(html).toContain('score-summary-card');
      expect(html).toContain('event-time-label');
      expect(html).toContain('日落时间');
      expect(html).toContain('19:45');
      expect(html).toContain('app-info-row');
      expect(html).toContain('19:15–20:15');
      expect(html).toContain('score-breakdown-trigger');
      expect(html).toContain('评分细则');
      expect(html).not.toContain('倒计时');
    });

    test('总结论应显示在评分和分析明细之前', () => {
      const prediction = {
        score: 75,
        quality: 'good',
        type: 'sunset',
        sunsetTime: new Date('2024-06-21T19:45:00+08:00'),
        sunAzimuth: null,
        cloudLayers: null,
        factors: {
          cloudCover: { value: 50 },
          humidity: { value: 60 }
        },
        getOptimalViewingWindow: () => ({
          start: new Date('2024-06-21T19:15:00+08:00'),
          end: new Date('2024-06-21T20:15:00+08:00')
        }),
        shouldShowAzimuth: () => false
      };

      const html = predictionController.renderSinglePrediction(
        prediction, 'sunset', '晚霞', '日落时间', '今日', 'sunset'
      );

      const conclusionIndex = html.indexOf('conclusion-banner');
      const scoreIndex = html.indexOf('score-summary-card');
      const analysisIndex = html.indexOf('analysis-card app-analysis-card');

      expect(conclusionIndex).toBeGreaterThan(-1);
      expect(scoreIndex).toBeGreaterThan(-1);
      expect(analysisIndex).toBeGreaterThan(-1);
      expect(conclusionIndex).toBeLessThan(scoreIndex);
      expect(conclusionIndex).toBeLessThan(analysisIndex);
    });

    test('北京晚霞场景应显示太阳方位角方向', () => {
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
        getAzimuthDirection: () => '西偏北 26°'
      };

      const html = predictionController.renderSinglePrediction(
        prediction,
        'sunset',
        '晚霞',
        '日落时间',
        '北京',
        'sunset'
      );

      expect(html).toContain('西偏北 26°');
      expect(html).toContain('app-info-row');
      expect(html).not.toContain('西北偏西');
      expect(html).not.toContain('西偏北 26° ↑');
    });

    test('北京朝霞场景日出方向不应显示为正北', () => {
      const sunriseTime = new Date('2026-04-26T05:22:00+08:00');
      const prediction = {
        score: 25,
        quality: 'fair',
        sunriseTime,
        type: 'sunrise',
        goldenHour: null,
        blueHour: null,
        sunAzimuth: 74,
        cloudLayers: null,
        factors: {
          cloudCover: { value: 45 },
          humidity: { value: 65 },
          visibility: { value: 12 },
          lowClouds: { value: 20 }
        },
        getOptimalViewingWindow: () => ({
          start: new Date(sunriseTime.getTime() - 30 * 60 * 1000),
          end: new Date(sunriseTime.getTime() + 30 * 60 * 1000)
        }),
        shouldShowAzimuth: () => true,
        getAzimuthDirection: () => '东偏北 16°'
      };

      const html = predictionController.renderSinglePrediction(
        prediction,
        'sunrise',
        '朝霞',
        '日出时间',
        '北京',
        'sunrise'
      );

      expect(html).toContain('东偏北 16°');
      expect(html).not.toContain('东北偏东');
      expect(html).not.toContain('正北');
    });

    test('增强分析应将后端透传的气溶胶条件归并到空气显色因子', () => {
      const prediction = {
        score: 62,
        quality: 'good',
        type: 'sunset',
        sunsetTime: new Date('2024-06-21T19:45:00+08:00'),
        sunAzimuth: null,
        cloudLayers: { high: 45, mid: 25, low: 8 },
        cloudCover: 30,
        humidity: 58,
        visibility: 18,
        aerosolOpticalDepth: 0.73,
        pm2_5: 139.7,
        pm10: 163.9,
        dust: 41,
        factors: {
          cloudCover: { value: 30 },
          highClouds: { value: 45 },
          midClouds: { value: 25 },
          lowClouds: { value: 8 },
          humidity: { value: 58 },
          visibility: { value: 18 },
          aerosolOpticalDepth: { value: 0.73 },
          pm2_5: { value: 139.7 },
          pm10: { value: 163.9 },
          dust: { value: 41 }
        },
        getOptimalViewingWindow: () => ({
          start: new Date('2024-06-21T19:15:00+08:00'),
          end: new Date('2024-06-21T20:15:00+08:00')
        }),
        shouldShowAzimuth: () => false
      };

      const html = predictionController.renderSinglePrediction(
        prediction, 'sunset', '晚霞', '日落时间', '今日', 'sunset'
      );

      expect(html).toContain('空气显色');
      expect(html).toContain('空气偏灰或颗粒过重');
      expect(html).not.toContain('analysis-summary-copy');
      expect(html).not.toContain('云层画布');
      expect(html).not.toContain('空气渲染');
      expect(html).not.toContain('AOD 0.73');
      expect(html).not.toContain('高层云充足');
      expect(html).toContain('app-analysis-card');
      expect(html).toContain('analysis-factor-grid');
      expect(html).toContain('analysis-factor-warning');
      expect(html).toContain('conclusion-banner');
      expect(html).not.toContain('undefined');
      expect(html).not.toContain('null');
    });

    test('无方位角时不渲染方位角区块', () => {
      const prediction = {
        score: 60,
        quality: 'good',
        type: 'sunset',
        sunsetTime: new Date('2024-06-21T19:45:00+08:00'),
        sunAzimuth: null,
        cloudLayers: null,
        factors: {},
        getOptimalViewingWindow: () => ({
          start: new Date(), end: new Date()
        }),
        shouldShowAzimuth: () => false
      };

      const html = predictionController.renderSinglePrediction(
        prediction, 'sunset', '晚霞', '日落时间', '今日', 'sunset'
      );

      expect(html).not.toContain('compact-extra-azimuth');
    });

    test('有 cloudLayers 时渲染云层信息', () => {
      const prediction = {
        score: 70,
        quality: 'good',
        type: 'sunset',
        sunsetTime: new Date('2024-06-21T19:45:00+08:00'),
        sunAzimuth: null,
        cloudLayers: {
          high: 40,
          mid: 20,
          low: 10
        },
        factors: {},
        getOptimalViewingWindow: () => ({
          start: new Date(), end: new Date()
        }),
        shouldShowAzimuth: () => false
      };

      const html = predictionController.renderSinglePrediction(
        prediction, 'sunset', '晚霞', '日落时间', '今日', 'sunset'
      );

      expect(html).toContain('cloud-condition-card');
      expect(html).toContain('cloud-condition-svg');
      expect(html).toContain('>高云<');
      expect(html).toContain('>中云<');
      expect(html).toContain('>低云<');
      expect(html).toContain('40%');
      expect(html).toContain('20%');
      expect(html).toContain('10%');
      expect(html).toContain('radar-compass-sunset');
    });

    test('点击分数仪表盘应打开/关闭分数明细面板', () => {
      document.body.innerHTML = `
        <section id="prediction-section" class="hidden">
          <h2 id="prediction-section-title"></h2>
          <div id="prediction-display"></div>
        </section>
      `;

      const displayDate = new Date();
      const sunsetTime = new Date(Date.now() + 2 * 60 * 60 * 1000);
      const sunriseTime = new Date(Date.now() - 8 * 60 * 60 * 1000);

      const basePrediction = {
        date: displayDate,
        score: 64,
        quality: 'good',
        type: 'sunset',
        sunriseTime,
        sunsetTime,
        goldenHour: null,
        blueHour: null,
        sunAzimuth: null,
        cloudLayers: null,
        factors: {},
        breakdown: { baseScore: 70, canvasScore: 65, lightPathScore: 80, renderingFactor: 0.9 },
        canvasAnalysis: { score: 65 },
        lightPathAnalysis: { score: 80 },
        renderingAnalysis: { factor: 0.9 },
        getOptimalViewingWindow: () => ({
          start: new Date('2024-06-21T19:15:00+08:00'),
          end: new Date('2024-06-21T20:15:00+08:00')
        }),
        shouldShowAzimuth: () => false
      };

      const sunrisePrediction = { ...basePrediction, type: 'sunrise', sunriseTime, sunsetTime };
      const sunsetPrediction = { ...basePrediction, type: 'sunset', sunriseTime, sunsetTime };
      predictionController.predictions = [sunrisePrediction, sunsetPrediction];
      predictionController.updateTodayPredictions(sunrisePrediction, sunsetPrediction, sunriseTime, sunsetTime, displayDate);

      const trigger = document.querySelector('.score-breakdown-trigger');
      const popover = document.querySelector('.score-breakdown-popover');

      expect(trigger).toBeTruthy();
      expect(popover).toBeTruthy();
      expect(popover.hidden).toBe(true);

      const scoreNumber = trigger.querySelector('.score-gauge-number');
      Object.defineProperty(scoreNumber, 'closest', { value: undefined, configurable: true });

      scoreNumber.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(popover.hidden).toBe(false);
      expect(trigger.getAttribute('aria-expanded')).toBe('true');

      trigger.click();
      expect(popover.hidden).toBe(true);
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
    });

    test('点击分数明细里的计算依据不应关闭明细面板', () => {
      document.body.innerHTML = `
        <section id="prediction-section" class="hidden">
          <h2 id="prediction-section-title"></h2>
          <div id="prediction-display"></div>
        </section>
      `;

      const displayDate = new Date();
      const sunsetTime = new Date(Date.now() + 2 * 60 * 60 * 1000);
      const sunriseTime = new Date(Date.now() - 8 * 60 * 60 * 1000);
      const basePrediction = {
        date: displayDate,
        score: 64,
        quality: 'good',
        type: 'sunset',
        sunriseTime,
        sunsetTime,
        goldenHour: null,
        blueHour: null,
        sunAzimuth: null,
        cloudLayers: null,
        factors: {},
        breakdown: {
          baseScore: 70,
          canvasScore: 65,
          lightPathScore: 80,
          lightPathGate: 0.95,
          renderingFactor: 0.9,
          unclampedFinalScore: 63
        },
        canvasAnalysis: { score: 65 },
        lightPathAnalysis: { score: 80 },
        renderingAnalysis: { factor: 0.9 },
        getOptimalViewingWindow: () => ({
          start: new Date('2024-06-21T19:15:00+08:00'),
          end: new Date('2024-06-21T20:15:00+08:00')
        }),
        shouldShowAzimuth: () => false
      };

      const sunrisePrediction = { ...basePrediction, type: 'sunrise' };
      const sunsetPrediction = { ...basePrediction, type: 'sunset' };
      predictionController.predictions = [sunrisePrediction, sunsetPrediction];
      predictionController.updateTodayPredictions(sunrisePrediction, sunsetPrediction, sunriseTime, sunsetTime, displayDate);

      const trigger = document.querySelector('.score-breakdown-trigger');
      const popover = document.querySelector('.score-breakdown-popover');
      trigger.click();
      expect(popover.hidden).toBe(false);

      const summary = popover.querySelector('.score-ledger-detail summary');
      expect(summary).toBeTruthy();
      summary.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(popover.hidden).toBe(false);
      expect(trigger.getAttribute('aria-expanded')).toBe('true');
    });

    test('动态插入的新分数仪表盘也应响应点击', () => {
      document.body.innerHTML = `
        <section id="prediction-section" class="hidden">
          <h2 id="prediction-section-title"></h2>
          <div id="prediction-display"></div>
        </section>
      `;
      const displayDate = new Date();
      const sunsetTime = new Date(Date.now() + 2 * 60 * 60 * 1000);
      const sunriseTime = new Date(Date.now() - 8 * 60 * 60 * 1000);
      const basePrediction = {
        date: displayDate,
        score: 64,
        quality: 'good',
        type: 'sunset',
        sunriseTime,
        sunsetTime,
        goldenHour: null,
        blueHour: null,
        sunAzimuth: null,
        cloudLayers: null,
        factors: {},
        breakdown: { baseScore: 70, canvasScore: 65, lightPathScore: 80, renderingFactor: 0.9 },
        canvasAnalysis: { score: 65 },
        lightPathAnalysis: { score: 80 },
        renderingAnalysis: { factor: 0.9 },
        getOptimalViewingWindow: () => ({ start: sunriseTime, end: sunsetTime }),
        shouldShowAzimuth: () => false
      };
      const sunrisePrediction = { ...basePrediction, type: 'sunrise' };
      const sunsetPrediction = { ...basePrediction, type: 'sunset' };
      predictionController.predictions = [sunrisePrediction, sunsetPrediction];
      predictionController.updateTodayPredictions(sunrisePrediction, sunsetPrediction, sunriseTime, sunsetTime, displayDate);
      const dynamic = document.createElement('div');
      dynamic.innerHTML = `
        <div class="score-breakdown-trigger" role="button" aria-expanded="false">
          <svg><text>88</text></svg>
          <div class="score-breakdown-popover" hidden>明细</div>
        </div>
      `;
      document.body.appendChild(dynamic);

      const trigger = dynamic.querySelector('.score-breakdown-trigger');
      const popover = dynamic.querySelector('.score-breakdown-popover');
      trigger.querySelector('text').dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(popover.hidden).toBe(false);
      expect(trigger.getAttribute('aria-expanded')).toBe('true');
    });

    test('分数明细应按真实计算链路展示渲染后分和最终修正', () => {
      const html = predictionController.renderScoreBreakdownPopover({
        score: 28,
        visibility: 5,
        humidity: 88,
        precipitation: 0.4,
        breakdown: {
          baseScore: 71.1,
          canvasScore: 70.7,
          lightPathScore: 72.5,
          lightPathGate: 0.91,
          renderingFactor: 0.85,
          renderingMode: 'negative_rendering_multiplier',
          renderingAdjustment: -10.7,
          unclampedFinalScore: 60.4,
          aerosolScattering: { factor: 0.85 }
        },
        canvasAnalysis: { score: 70.7 },
        lightPathAnalysis: { score: 72.5 },
        renderingAnalysis: { factor: 0.85, aerosolFactor: 0.85 },
        aerosolHazeCap: { applied: true, cap: 28, level: 'extreme', reason: 'extreme_dust_haze_cap_28' }
      });

      expect(html).toContain('为什么是这个分数');
      expect(html).toContain('28 分：主要调整是 灰幕影响 ≤28');
      expect(html).toContain('计算依据');
      expect(html).toContain('强沙尘或灰幕会压住霞光');
      expect(html).not.toContain('score-ledger-context');
      expect(html).not.toContain('能见度 5km');
      expect(html).toContain('70.7');
      expect(html).toContain('72.5');
      expect(html).toContain('71.1');
      expect(html).toContain('分层载体 × 分层受光亮度');
      expect(html).not.toContain('70.7×80% + 72.5×20%');
      expect(html).toContain('71.1 × 空气显色系数 0.85 = 60.4');
      expect(html).toContain('60.4');
      expect(html).toContain('≤28');
      expect(html).toContain('最终分');
    });

    test('分数明细正向显色应显示加分修正而不是错误乘法', () => {
      const html = predictionController.renderScoreBreakdownPopover({
        score: 77,
        breakdown: {
          baseScore: 71.1,
          canvasScore: 70.7,
          carrierScore: 70.7,
          lightPathScore: 72.5,
          lightPathGate: 1,
          renderingFactor: 1.12,
          renderingMode: 'positive_rendering_bonus',
          renderingAdjustment: 6,
          unclampedFinalScore: 77.1
        },
        canvasAnalysis: { score: 70.7 },
        carrierAnalysis: { score: 70.7 },
        lightPathAnalysis: { score: 72.5 },
        lightPathGate: { gate: 1 },
        renderingAdjustment: { adjustment: 6, reason: 'positive_rendering_bonus' },
        renderingAnalysis: { factor: 1.12, visibilityFactor: 1.1, humidityFactor: 1, aerosolFactor: 1 }
      });

      expect(html).toContain('71.1 × 空气显色系数 1.12 = 77.1');
      expect(html).not.toContain('71.1 + 显色修正 6.0 = 77.1');
    });

    test('分数明细应把湿霾开光路中间档显示成中文解释', () => {
      const html = predictionController.renderScoreBreakdownPopover({
        score: 46,
        breakdown: {
          baseScore: 68.1,
          canvasScore: 77,
          carrierScore: 77,
          lightPathScore: 83.1,
          lightPathGate: 0.9,
          renderingFactor: 0.68,
          renderingMode: 'wet_haze_path_open_mid_rendering',
          unclampedFinalScore: 46.3
        },
        canvasAnalysis: { score: 77 },
        carrierAnalysis: { score: 77 },
        lightPathAnalysis: { score: 83.1 },
        lightPathGate: { gate: 0.9 },
        renderingAnalysis: { factor: 0.68, visibilityFactor: 0.8, humidityFactor: 0.9, aerosolFactor: 0.85 },
        aerosolHazeCap: { applied: true, cap: 55, level: 'wet_haze_mid', reason: 'wet_haze_path_open_mid_rendering' }
      });

      expect(html).toContain('光路打开但湿霾偏重，按中等显色并限制上限');
      expect(html).not.toContain('wet_haze_path_open_mid_rendering');
    });

    test('分数明细应展示云层画布、云种和云厚扣分来源', () => {
      const html = predictionController.renderScoreBreakdownPopover({
        score: 49,
        cloudLayers: { high: 100, mid: 0, low: 0 },
        breakdown: {
          baseScore: 48.7,
          canvasScore: 48.7,
          carrierScore: 48.7,
          lightPathScore: 53.2,
          lightPathGate: 1,
          renderingFactor: 1,
          renderingMode: 'positive_rendering_bonus',
          renderingAdjustment: 0,
          unclampedFinalScore: 48.7,
          aerosolScattering: { factor: 1 }
        },
        canvasAnalysis: {
          score: 58.7,
          cloudRangeScore: 66.7,
          lowCloudPenalty: 1,
          overcastPenalty: 1,
          highCloudBonus: 6,
          cloudTypeAdjustment: { canvasBonus: 4, reason: 'upper_cloud_carrier' },
          cloudThicknessAdjustment: { adjustment: -18, pressure: 0.78, baseScore: 76.7, maxPenalty: 23, penaltyRatio: 0.30, reason: 'cloud_thickness_pressure_penalty' },
          breakdown: { highClouds: 100, midClouds: 0, lowClouds: 0 }
        },
        cloudThickness: {
          thickness: 'thick',
          modifier: 0.5,
          pressure: 0.78,
          evidence: { thin: 0, thick: 3.4, net: -3.4, diffuseRatio: 0.773, waterIndex: 10.49, carrierRelief: 0.08, pressure: 0.78 }
        },
        lightPathAnalysis: { score: 53.2 },
        lightPathGate: { gate: 1 },
        renderingAdjustment: { adjustment: 0, reason: 'positive_rendering_bonus' },
        renderingAnalysis: { factor: 1, visibilityFactor: 1, humidityFactor: 1, aerosolFactor: 1 }
      });

      expect(html).toContain('候选载体：本地云层 48.7；采用 云层载体 48.7');
      expect(html).toContain('本地云层：中高云画布 75.0 → 区间分 66.7');
      expect(html).toContain('高云主导 bonus +6.0');
      expect(html).toContain('云种 +4.0');
      expect(html).toContain('云厚 -18.0');
      expect(html).toContain('-18.0');
      expect(html).not.toContain('低太阳透射');
      expect(html).not.toContain('载体缓冲');
    });

    test('分数明细应解释渲染后分到展示分的状态档位校准', () => {
      const html = predictionController.renderScoreBreakdownPopover({
        score: 60,
        breakdown: {
          baseScore: 79.4,
          canvasScore: 99.1,
          lightPathScore: 40,
          renderingFactor: 1,
          unclampedFinalScore: 79.4
        },
        canvasAnalysis: { score: 99.1 },
        lightPathAnalysis: { score: 40 },
        renderingAnalysis: { factor: 1, visibilityFactor: 1, humidityFactor: 1, aerosolFactor: 1 }
      });

      expect(html).toContain('展示分校准');
      expect(html).toContain('79.4→60');
      expect(html).toContain('光路约 40.0，更像轻微霞光机会');
      expect(html).toContain('60 分：主要调整是 展示分校准 79.4→60');
    });
  });

    test('score detail ledger uses layer-sum algorithm without standalone light-path main step', () => {
      predictionController.i18n.currentLanguage = 'en-US';
      const html = predictionController.renderScoreBreakdownPopover({
        score: 44,
        canvasAnalysis: { score: 65.4, breakdown: { highClouds: 70, midClouds: 45, lowClouds: 12 } },
        carrierAnalysis: { score: 65.4 },
        remoteLayerCarriers: {
          applied: true,
          remoteHighCarrier: 22,
          remoteMidCarrier: 9,
          remoteLowBlock: 18,
          metrics: { high: 82, mid: 34, low: 12 }
        },
        lightPathAnalysis: {
          score: 107.2,
          source: 'sunset_visible_sector_openmeteo',
          azimuth: 286,
          occlusionProbability: 0.08
        },
        layerBrightness: {
          applied: true,
          effectiveBrightness: 46.3,
          brightnessGate: 0.71,
          layers: { cloudCanvas: 65.4, remoteHigh: 82, remoteMid: 34, remoteLowBlock: 18 },
          factors: {
            solarFactor: 0.82,
            pathFactor: 1.07,
            airTransmission: 0.9,
            thicknessFactor: 0.78,
            beamFactor: 0.65
          },
          dimEvidence: ['weak beam']
        },
        breakdown: {
          layerContributionFormula: 'sum_layer_carrier_brightness',
          baseScore: 65.2,
          canvasScore: 65.4,
          carrierScore: 65.4,
          remoteLayerCarriers: {
            applied: true,
            remoteHighCarrier: 22,
            remoteMidCarrier: 9,
            remoteLowBlock: 18,
            metrics: { high: 82, mid: 34, low: 12 }
          },
          lightPathScore: 107.2,
          renderingFactor: 0.68,
          unclampedFinalScore: 44.1,
          aerosolScattering: { factor: 0.68 }
        },
        renderingAnalysis: { factor: 0.68, visibilityFactor: 0.78, humidityFactor: 0.92, aerosolFactor: 0.95 }
      });

      document.body.innerHTML = html;
      const labels = [...document.querySelectorAll('.score-ledger-label')].map((node) => node.textContent.trim());

      expect(labels.slice(0, 5)).toEqual([
        'Cloud carrier',
        'Layer brightness',
        'Base score',
        'Air rendering',
        'Final'
      ]);
      expect(labels).not.toContain('Light path');
      expect(html).toContain('Σ(layer carrier × layer brightness)');
      expect(html).toContain('remote layers 22.0 (high 22.0, mid 9.0, low block 18.0)');
      expect(html).toContain('remote high 82.0');
      expect(html).toContain('remote mid 34.0');
      expect(html).toContain('path 1.07');
      expect(html).not.toContain('65.4 × brightness 0.71 = 65.2');
      expect(html).not.toContain('sunset path 1.07 × air rendering');
    });

  describe('renderCloudLayers', () => {
    test('null cloudLayers 返回空字符串', () => {
      expect(predictionController.renderCloudLayers(null)).toBe('');
    });

    test('有数据时渲染云层分层', () => {
      const html = predictionController.renderCloudLayers({
        high: 40,
        mid: 20,
        low: 10,
        description: 'test'
      });
      expect(html).toBeTruthy();
      expect(typeof html).toBe('string');
    });
  });

  describe('火烧云分析卡片', () => {
    test('火烧云分析应合并为四个固定因子且亮度归入载体', () => {
      const groups = predictionController.buildAnalysisGroups({
        score: 72,
        cloudLayers: { high: 88, mid: 42, low: 4 },
        visibility: 18,
        humidity: 58
      });
      const html = predictionController.renderAnalysisCard(groups, 'test');

      expect(groups).toHaveLength(4);
      expect(html).toContain('火烧云文字分析');
      expect(html).not.toContain('火烧云形成条件分析');
      expect(html).toContain('云层载体');
      expect(html).toContain('光路条件');
      expect(html).toContain('空气显色');
      expect(html).toContain('限制因素');
      expect(html).toContain('analysis-factor-tag');
      expect(html).toMatch(/analysis-factor-tag">(?:较好|一般|偏弱|较弱|轻微|明显|暂无|充足|优秀)</);
      expect(groups.find(item => item.key === 'carrier').desc).toContain('受光');
      expect(html).not.toContain('受光亮度');
      expect(groups.find(item => item.key === 'carrier').subfacts).toBeUndefined();
      expect(html).toContain('analysis-factor-grid');
      expect(html).not.toContain('不再重复封顶');
      expect(html).not.toContain('不再额外封顶');
    });

    test('气溶胶弱载体场景应归入固定因子而不是追加新条目', () => {
      const groups = predictionController.buildAnalysisGroups({
        score: 33,
        cloudLayers: { high: 0, mid: 7, low: 0 },
        visibility: 20,
        humidity: 45,
        aerosolCarrierScore: {
          activatedScore: 31,
          lightPathActivation: 1
        }
      });
      const html = predictionController.renderAnalysisCard(groups, 'test');

      expect(groups).toHaveLength(4);
      expect(html).toContain('空气显色');
      expect(groups.find(item => item.key === 'carrier').desc).toContain('受光');
      expect(html).not.toContain('受光亮度');
      expect(html).toContain('颜色更容易偏暖、偏红');
      expect(html).not.toContain('薄雾红日载体');
    });

    test('开口暖色散射场景应显示空气显色较好', () => {
      const groups = predictionController.buildAnalysisGroups({
        score: 71,
        cloudLayers: { high: 100, mid: 100, low: 0 },
        visibility: 20,
        humidity: 62,
        aerosolOpticalDepth: 0.72,
        pm10: 91.3,
        dust: 96,
        scoringV2: {
          applied: true,
          airMode: 'warm_scattering_path_open',
          score: 70.8
        },
        lightPathAnalysis: {
          score: 92.5,
          directionalAnalysis: { reason: 'solar_direction_partial_opening' }
        }
      });
      const rendering = groups.find(item => item.key === 'rendering');

      expect(rendering.status).toBe('较好');
      expect(rendering.statusTone).toBe('good');
      expect(rendering.desc).toContain('颜色更容易偏暖、偏红');
    });

    test('满铺灰幕显色抑制场景应显示空气显色较弱', () => {
      const prediction = {
        score: 44,
        cloudLayers: { high: 100, mid: 100, low: 0 },
        visibility: 20,
        humidity: 62,
        aerosolOpticalDepth: 0.4,
        pm10: 86.4,
        scoringV2: {
          applied: true,
          airMode: 'gray_veil_air_suppression',
          score: 44,
          cloudCarrier: 62,
          pathFactor: 1,
          airFactor: 0.71
        },
        lightPathAnalysis: {
          score: 84,
          directionalAnalysis: { reason: 'solar_direction_neutral' }
        }
      };
      const groups = predictionController.buildAnalysisGroups(prediction);
      const rendering = groups.find(item => item.key === 'rendering');
      const limits = groups.find(item => item.key === 'limits');
      const html = predictionController.renderScoreBreakdownPopover(prediction);

      expect(rendering.status).toBe('较弱');
      expect(rendering.statusTone).toBe('weak');
      expect(rendering.desc).toContain('满铺云幕');
      expect(limits.status).toBe('轻微');
      expect(html).toContain('灰幕显色抑制');
      expect(html).toContain('满铺中高云叠加偏脏空气');
      expect(html).not.toContain('开口暖色散射');
    });

    test('太阳方向采样不是 opening 时光路条件不能显示良好', () => {
      const groups = predictionController.buildAnalysisGroups({
        score: 12,
        cloudLayers: { high: 4, mid: 18, low: 14 },
        visibility: 15,
        humidity: 80,
        breakdown: { lightPathScore: 63.3 },
        lightPathAnalysis: {
          score: 63.3,
          directionalAnalysis: {
            reason: 'solar_direction_neutral',
            lowMid: 22.6,
            high: 0
          }
        }
      });

      const lightPath = groups.find(item => item.key === 'lightPath');
      expect(lightPath.status).toBe('一般');
      expect(lightPath.statusTone).toBe('fair');
      expect(lightPath.desc).toContain('太阳方向有一定遮挡');
    });

    test('形成条件状态标签使用不同语义颜色', () => {
      const html = predictionController.renderAnalysisCard([
        { key: 'carrier', title: '云层载体', status: '较好', desc: 'test', type: 'positive', icon: 'cloud', statusTone: 'good' },
        { key: 'lightPath', title: '光路条件', status: '一般', desc: 'test', type: 'neutral', icon: 'info', statusTone: 'fair' },
        { key: 'limits', title: '限制因素', status: '轻微', desc: 'test', type: 'neutral', icon: 'warn', statusTone: 'mild' },
        { key: 'rendering', title: '空气显色', status: '较弱', desc: 'test', type: 'warning', icon: 'warn', statusTone: 'weak' }
      ], 'test');

      expect(html).not.toContain('analysis-factor-status');
      expect(html).not.toContain('analysis-factor-subfact');
      expect(html).toContain('analysis-factor-tag">较好</span>');
      expect(html).toContain('analysis-factor-tag">一般</span>');
      expect(html).toContain('analysis-factor-tag">轻微</span>');
      expect(html).toContain('analysis-factor-tag">较弱</span>');
      expect(html).toContain('analysis-factor-good');
      expect(html).toContain('analysis-factor-fair');
      expect(html).toContain('analysis-factor-mild');
      expect(html).toContain('analysis-factor-weak');
    });

    test('分析卡片最终 CSS 应保持上下文案左对齐且可换行', () => {
      const css = fs.readFileSync(path.join(rootDir, 'styles/main.css'), 'utf8');
      const finalRules = css.slice(css.lastIndexOf('formation analysis reads as a compact diagnostic list'));

      expect(finalRules).toContain('analysis-card-head');
      expect(finalRules).toContain('analysis-card-subtitle');
      expect(finalRules).toContain('analysis-factor-grid');
      expect(finalRules).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))');
      expect(finalRules).toContain('analysis-factor-heading');
      expect(finalRules).toContain('analysis-factor-tag');
      expect(finalRules).toContain('border: 1px solid color-mix(in srgb, var(--theme-card-border) 55%');
      expect(finalRules).toContain('analysis-factor-good .analysis-factor-tag');
      expect(finalRules).toContain('analysis-factor-fair .analysis-factor-tag');
      expect(finalRules).toContain('analysis-factor-weak .analysis-factor-tag');
      expect(finalRules).not.toContain('analysis-factor-summary');
      expect(finalRules).not.toContain('analysis-factor-status');
      expect(finalRules).not.toContain('analysis-factor-subfact');
      expect(finalRules).toContain('grid-template-columns: 22px minmax(0, 1fr) auto');
      expect(finalRules).toContain('grid-template-columns: 16px minmax(0, 1fr) max-content');
      expect(finalRules).toContain('max-width: 44px');
      expect(finalRules).toContain('html:not([lang^="zh"]) .app-analysis-card .analysis-factor-grid');
      expect(finalRules).toContain('grid-template-columns: 1fr');
      expect(finalRules).toContain('white-space: nowrap');
      expect(finalRules).toContain('word-break: keep-all');
      expect(finalRules).toContain('display: grid !important');
      expect(finalRules).toContain('white-space: normal !important');
      expect(finalRules).toContain('text-align: left !important');
      expect(finalRules).not.toContain('display: contents');
      expect(finalRules).not.toContain('text-align: right');
    });

    test('预测卡分享和反馈按钮保持同一行动区布局', () => {
      const html = predictionController.renderSinglePrediction({
        score: 72,
        quality: 'good',
        type: 'sunset',
        time: '2026-06-13T11:30:00Z',
        sunsetTime: new Date('2026-06-13T19:30:00+08:00'),
        timezone: 'Asia/Shanghai',
        sunAzimuth: null,
        cloudLayers: { high: 88, mid: 42, low: 4 },
        visibility: 18,
        humidity: 58,
        factors: {},
        getOptimalViewingWindow: () => ({
          start: new Date('2026-06-13T19:00:00+08:00'),
          end: new Date('2026-06-13T20:00:00+08:00')
        }),
        shouldShowAzimuth: () => false
      }, '', '晚霞', '日落时间', '今天', 'sunset');
      const css = fs.readFileSync(path.join(rootDir, 'styles/main.css'), 'utf8');
      const shareCss = fs.readFileSync(path.join(rootDir, 'styles/share-panel.css'), 'utf8');

      expect(html).toContain('prediction-share-footer-row');
      expect(html).toContain('prediction-nav-feedback');
      expect(html.indexOf('prediction-share-menu prediction-share-footer')).toBeLessThan(html.indexOf('prediction-nav-feedback'));
      expect(css).toMatch(/\.prediction-share-footer-row\s*\{[\s\S]*?display:\s*grid;/);
      expect(css).toMatch(/\.prediction-share-footer-row\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/);
      expect(css).toMatch(/\.prediction-nav-feedback\s*\{[\s\S]*?max-width:\s*none;/);
      expect(css).toMatch(/\.prediction-nav-feedback\s*\{[\s\S]*?padding:\s*0 18px !important;/);
      expect(css).toMatch(/\.prediction-nav-feedback \.share-btn-icon\s*\{[\s\S]*?width:\s*18px !important;/);
      expect(css).toMatch(/\.prediction-nav-feedback \.share-btn-icon\s*\{[\s\S]*?height:\s*18px !important;/);
      expect(css).toMatch(/\.prediction-nav-feedback \.share-btn-label\s*\{[\s\S]*?text-overflow:\s*ellipsis;/);
      expect(css).toMatch(/\.prediction-app-nav-compact \.prediction-share-menu\s*\{[\s\S]*?width:\s*100%;/);
      expect(shareCss).toMatch(/\.prediction-share-footer-row\s*\{[\s\S]*?display:\s*grid !important;/);
      expect(shareCss).toMatch(/\.prediction-share-footer-row\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/);
      expect(shareCss).toMatch(/\.prediction-share-footer \.prediction-share-btn\s*\{[\s\S]*?width:\s*100%;/);
      expect(shareCss).toMatch(/\.prediction-nav-feedback\s*\{[\s\S]*?height:\s*40px;/);
      expect(shareCss).not.toMatch(/\.prediction-share-footer-row\s*\{[\s\S]*?display:\s*flex !important;/);
    });

    test('backend explanation factors use localized copy outside Chinese locales', () => {
      const copy = {
        'prediction.formationAnalysis.factors.carrier.title': 'Cloud carrier',
        'prediction.formationAnalysis.factors.carrier.status.good': 'Good',
        'prediction.formationAnalysis.factors.carrier.desc.good': 'Clouds can carry sunset color.',
        'prediction.formationAnalysis.factors.lightPath.title': 'Light path',
        'prediction.formationAnalysis.factors.lightPath.status.weak': 'Weak',
        'prediction.formationAnalysis.factors.lightPath.desc.weak': 'The sun direction is blocked.',
        'prediction.formationAnalysis.factors.rendering.title': 'Air rendering',
        'prediction.formationAnalysis.factors.rendering.status.fair': 'Fair',
        'prediction.formationAnalysis.factors.rendering.desc.fair': 'Air color support is neutral.',
        'prediction.formationAnalysis.factors.limits.title': 'Limits',
        'prediction.formationAnalysis.factors.limits.status.good': 'None obvious',
        'prediction.formationAnalysis.factors.limits.desc.good': 'No hard limit is obvious.'
      };
      predictionController.i18n = {
        currentLanguage: 'en-US',
        t: (key) => copy[key] || key
      };
      const prediction = {
        score: 72,
        explanationModel: {
          factors: [
            { key: 'carrier', title: '云层载体', status: '较好', tone: 'good', desc: '有可染色云面。' },
            { key: 'lightPath', title: '光路条件', status: '较弱', tone: 'weak', desc: '低云遮挡明显。' },
            { key: 'rendering', title: '空气显色', status: '一般', tone: 'fair', desc: '空气条件普通。' },
            { key: 'limits', title: '限制因素', status: '无明显', tone: 'good', desc: '暂无硬限制。' }
          ]
        }
      };

      const groups = predictionController.buildAnalysisGroups(prediction);

      expect(groups.map(item => item.title)).toEqual(['Cloud carrier', 'Light path', 'Air rendering', 'Limits']);
      expect(groups.map(item => item.status)).toEqual(['Good', 'Weak', 'Fair', 'None obvious']);
      expect(groups.map(item => item.desc)).toEqual([
        'Clouds can carry sunset color.',
        'The sun direction is blocked.',
        'Air color support is neutral.',
        'No hard limit is obvious.'
      ]);
      expect(groups.map(item => item.title).join(' ')).not.toContain('云层载体');
      expect(groups.map(item => item.desc).join(' ')).not.toContain('低云遮挡');
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
        getAzimuthDirection: () => '西偏北 26°'
      };

      const html = predictionController.renderSinglePrediction(
        prediction,
        'sunset',
        '晚霞',
        '日落时间',
        '北京',
        'sunset'
      );

      expect(html).toContain('西偏北 26°');
      expect(html).not.toContain('西北偏西');
      expect(html).not.toContain('西偏北 26° ↑');
    });
  });

  describe('updatePredictionDisplay', () => {
    test('应该存储预测数据', () => {
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

      const initialPredictions = predictionController.predictions;

      predictionController.updatePredictionDisplay(mockPredictions);

      // 验证预测数据已存储
      expect(predictionController.predictions).toEqual(mockPredictions);
      expect(predictionController.predictions).not.toBe(initialPredictions);
    });
  });

  describe('syncPairedPredictionCardRows', () => {
    const mockMatchMedia = (matches) => jest.fn(() => ({
      matches,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    }));

    test('桌面端应按同名区域同步朝霞/晚霞卡片高度，适配不同语言换行', () => {
      window.matchMedia = mockMatchMedia(true);
      document.body.innerHTML = `
        <div id="today-predictions-container">
          <div class="prediction-tab-panel"><div class="prediction-app-card">
            <div class="phenomenon-title-card" data-height="40"></div>
            <div class="conclusion-banner" data-height="72"></div>
            <div class="score-summary-card" data-height="120"></div>
            <div class="cloud-condition-card" data-height="86"></div>
            <div class="app-analysis-card" data-height="180"></div>
          </div></div>
          <div class="prediction-tab-panel"><div class="prediction-app-card">
            <div class="phenomenon-title-card" data-height="58"></div>
            <div class="conclusion-banner" data-height="36"></div>
            <div class="score-summary-card" data-height="140"></div>
            <div class="cloud-condition-card" data-height="92"></div>
            <div class="app-analysis-card" data-height="150"></div>
          </div></div>
        </div>
      `;
      document.querySelectorAll('[data-height]').forEach(element => {
        element.getBoundingClientRect = () => ({ height: Number(element.dataset.height) });
      });

      predictionController.syncPairedPredictionCardRows(document);

      expect([...document.querySelectorAll('.phenomenon-title-card')].map(el => el.style.minHeight)).toEqual(['58px', '58px']);
      expect([...document.querySelectorAll('.conclusion-banner')].map(el => el.style.minHeight)).toEqual(['72px', '72px']);
      expect([...document.querySelectorAll('.score-summary-card')].map(el => el.style.minHeight)).toEqual(['140px', '140px']);
      expect([...document.querySelectorAll('.cloud-condition-card')].map(el => el.style.minHeight)).toEqual(['92px', '92px']);
      expect([...document.querySelectorAll('.app-analysis-card')].map(el => el.style.minHeight)).toEqual(['180px', '180px']);
    });

    test('手机端应清除同步高度，保持单列自然流式布局', () => {
      window.matchMedia = mockMatchMedia(false);
      document.body.innerHTML = `
        <div id="today-predictions-container">
          <div class="prediction-tab-panel"><div class="prediction-app-card"><div class="conclusion-banner" style="min-height:72px"></div></div></div>
          <div class="prediction-tab-panel"><div class="prediction-app-card"><div class="conclusion-banner" style="min-height:72px"></div></div></div>
        </div>
      `;

      predictionController.syncPairedPredictionCardRows(document);

      expect([...document.querySelectorAll('.conclusion-banner')].map(el => el.style.minHeight)).toEqual(['', '']);
    });
  });

  describe('_ensureAzimuthCompatibility', () => {
    test('为无方位角的预测补齐字段', () => {
      const prediction = { sunAzimuth: null };
      // 调用前 prediction 没有 getAzimuthDirection 方法
      predictionController._ensureAzimuthCompatibility(prediction, new Date(), new Date(), 39.9, 116.4);

      // sunAzimuth 被设置
      expect(prediction.sunAzimuth).toBeDefined();
      expect(typeof prediction.getAzimuthDirection).toBe('function');
      expect(typeof prediction.shouldShowAzimuth).toBe('function');
    });

    test('已有方位角时不覆盖', () => {
      const prediction = { sunAzimuth: 180 };
      predictionController._ensureAzimuthCompatibility(prediction, new Date(), new Date(), 39.9, 116.4);
      // sunAzimuth 不应改变
      expect(prediction.sunAzimuth).toBe(180);
    });
  });

  describe('generatePredictions 输入验证', () => {
    test('空天气数据应抛出错误', async () => {
      await expect(
        predictionController.generatePredictions([], { lat: 39.9, lon: 116.4, name: '北京', isValid: () => true })
      ).rejects.toThrow('天气数据为空');
    });

    test('无效位置应抛出错误', async () => {
      await expect(
        predictionController.generatePredictions([{ temp: 20 }], { isValid: () => false })
      ).rejects.toThrow();
    });

    test('自适应模式下批量预测超时应标记本轮走前端天气兜底', async () => {
      localStorage.setItem('weather_fetch_mode', 'client-fallback');
      const timeoutError = new Error('后端预测 API 调用失败: 预测服务 20 秒内没有返回，请稍后重试');
      timeoutError.code = 'PREDICTION_API_TIMEOUT';
      predictionController.weatherFetchMode = 'client-fallback';
      predictionController.features = { USE_BACKEND_PREDICTION: true };
      predictionController.predictionAPIService = {
        calculateBatchClosedLoop: jest.fn(() => Promise.reject(timeoutError))
      };

      const today = new Date('2026-05-14T00:00:00+08:00');
      const location = { lat: 39.9, lon: 116.4 };

      await predictionController._prepareClosedLoopBatchPredictions({ today, location, targetTimezone: 'Asia/Shanghai' });

      expect(predictionController.predictionAPIService.calculateBatchClosedLoop).toHaveBeenCalledTimes(1);
      expect(predictionController._closedLoopBatchPredictionMap).toBeNull();
      expect(predictionController._forceClientWeatherPredictionFallback).toBe(true);
    });

    test('所有朝晚霞预测都失败时应抛错给 AppController 显示提示', async () => {
      localStorage.setItem('weather_fetch_mode', 'backend');
      const base = new Date();
      base.setHours(0, 0, 0, 0);
      const weatherData = Array.from({ length: 4 }, (_, index) => {
        const ts = new Date(base);
        ts.setDate(base.getDate() + index);
        ts.setHours(6, 0, 0, 0);
        return {
          timestamp: ts.getTime(),
          timezone: 'Asia/Shanghai',
          temp: 20,
          humidity: 50,
          cloudCover: 80
        };
      });
      predictionController._prepareClosedLoopBatchPredictions = jest.fn(async () => {});
      predictionController.predictionService.getSunriseTime = jest.fn((targetDate) => {
        const date = new Date(targetDate);
        date.setHours(6, 0, 0, 0);
        return date;
      });
      predictionController.predictionService.getSunsetTime = jest.fn((targetDate) => {
        const date = new Date(targetDate);
        date.setHours(18, 0, 0, 0);
        return date;
      });
      predictionController._calculatePredictionWithBackend = jest.fn(async () => {
        const error = new Error('后端预测 API 调用失败: 预测服务 20 秒内没有返回，请稍后重试');
        error.code = 'PREDICTION_API_TIMEOUT';
        throw error;
      });

      await expect(
        predictionController.generatePredictions(weatherData, {
          lat: 39.9,
          lon: 116.4,
          name: '北京',
          isValid: () => true
        })
      ).rejects.toThrow('朝晚霞预测读取失败');
      expect(predictionController.predictions).toEqual([]);
    });
  });
});

describe('PredictionController - 3天朝晚霞时间线加载态', () => {
  let predictionController;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="forecast-loading"></div>
      <div id="forecast-timeline" data-loaded="false"></div>
    `;
    predictionController = new PredictionController(mockStorageService);
    predictionController.i18n = {
      t: (key, values = {}) => {
        const map = {
          'time.tomorrow': '明天',
          'time.dayAfterTomorrow': '后天',
          'time.daysLater': `${values.days}天后`,
          'prediction.sunrise': '朝霞',
          'prediction.sunset': '晚霞'
        };
        return map[key] || key;
      },
      currentLanguage: 'zh-CN'
    };
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('未来预测数据渲染完成后隐藏读取条并标记已加载', () => {
    const base = new Date('2026-05-08T00:00:00+08:00');
    const predictions = Array.from({ length: 8 }, (_, i) => ({
      date: new Date(base.getTime() + Math.floor(i / 2) * 24 * 60 * 60 * 1000),
      type: i % 2 === 0 ? 'sunrise' : 'sunset',
      score: 70 + i,
      quality: 'good',
      sunriseTime: new Date(base.getTime() + Math.floor(i / 2) * 24 * 60 * 60 * 1000 + 6 * 60 * 60 * 1000),
      sunsetTime: new Date(base.getTime() + Math.floor(i / 2) * 24 * 60 * 60 * 1000 + 18 * 60 * 60 * 1000)
    }));

    predictionController.updateForecastTimeline(predictions);

    expect(document.getElementById('forecast-timeline').dataset.loaded).toBe('true');
    expect(document.getElementById('forecast-loading').classList.contains('hidden')).toBe(true);
    expect(document.querySelectorAll('#forecast-timeline .forecast-day-card')).toHaveLength(3);
  });

  test('未来预测分数颜色按分数分档而不是接口 quality 字段', () => {
    const base = new Date('2026-05-14T00:00:00+08:00');
    const predictions = [
      {
        date: new Date(base.getTime() - 24 * 60 * 60 * 1000),
        type: 'sunrise',
        score: 20,
        quality: 'poor',
        sunriseTime: new Date(base.getTime() - 18 * 60 * 60 * 1000),
        sunsetTime: new Date(base.getTime() - 6 * 60 * 60 * 1000)
      },
      {
        date: base,
        type: 'sunrise',
        score: 77,
        quality: 'good',
        sunriseTime: new Date(base.getTime() + 6 * 60 * 60 * 1000),
        sunsetTime: new Date(base.getTime() + 18 * 60 * 60 * 1000)
      },
      {
        date: base,
        type: 'sunset',
        score: 45,
        quality: 'good',
        sunriseTime: new Date(base.getTime() + 6 * 60 * 60 * 1000),
        sunsetTime: new Date(base.getTime() + 18 * 60 * 60 * 1000)
      }
    ];

    predictionController.updateForecastTimeline(predictions);

    const scores = [...document.querySelectorAll('#forecast-timeline .fcard-row-score')];
    expect(scores[0].textContent).toContain('77');
    expect(scores[0].classList.contains('quality-good')).toBe(true);
    expect(scores[1].textContent).toContain('45');
    expect(scores[1].classList.contains('quality-fair')).toBe(true);
  });

  test('评分仪表盘数字不再被全局强制成同一个颜色', () => {
    const css = fs.readFileSync(path.join(process.cwd(), 'styles/main.css'), 'utf8');
    const tokenBlock = css.slice(css.indexOf('High-impact token remapping for prediction surfaces.'), css.indexOf('.score-gauge-total'));

    expect(tokenBlock).not.toContain('.score-gauge-number');
    expect(tokenBlock).not.toContain('.score-gauge-grade');
    expect(tokenBlock).not.toContain('color: var(--score-excellent-mid) !important');
  });
});
