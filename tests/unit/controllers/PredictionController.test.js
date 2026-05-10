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
    test('296° 应返回 西北偏西', () => {
      predictionController.i18n = { currentLanguage: 'zh-CN' };
      const dir = predictionController.getLocalizedAzimuthDirection({ sunAzimuth: 296 });
      expect(dir).toBe('西北偏西');
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

    test('繁中环境 74° 应返回東北偏東', () => {
      predictionController.i18n = { currentLanguage: 'zh-TW' };
      const dir = predictionController.getLocalizedAzimuthDirection({ sunAzimuth: 74 });
      expect(dir).toBe('東北偏東');
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
      expect(direction).toBe('东北偏东');
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
      expect(html).toContain('查看评分明细');
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
        getAzimuthDirection: () => '西北偏西'
      };

      const html = predictionController.renderSinglePrediction(
        prediction,
        'sunset',
        '晚霞',
        '日落时间',
        '北京',
        'sunset'
      );

      expect(html).toContain('西北偏西');
      expect(html).toContain('app-info-row');
      expect(html).toContain('西北偏西');
      expect(html).not.toContain('西北偏西 ↑');
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
        getAzimuthDirection: () => '东北偏东'
      };

      const html = predictionController.renderSinglePrediction(
        prediction,
        'sunrise',
        '朝霞',
        '日出时间',
        '北京',
        'sunrise'
      );

      expect(html).toContain('东北偏东');
      expect(html).not.toContain('正北');
      expect(html).not.toContain('北</span>');
    });

    test('增强分析应显示后端透传的气溶胶 AOD 文案', () => {
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

      expect(html).toContain('AOD 0.73');
      expect(html).not.toContain('analysis-summary-copy');
      expect(html).not.toContain('云层画布');
      expect(html).not.toContain('空气渲染');
      expect(html).toContain('高层云充足');
      expect(html).toContain('app-analysis-card');
      expect(html).toContain('analysis-group-positive');
      expect(html).toContain('analysis-group-warning');
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
          renderingFactor: 0.85,
          unclampedFinalScore: 60.4,
          aerosolScattering: { factor: 0.85 }
        },
        canvasAnalysis: { score: 70.7 },
        lightPathAnalysis: { score: 72.5 },
        renderingAnalysis: { factor: 0.85, aerosolFactor: 0.85 },
        aerosolHazeCap: { applied: true, cap: 28, level: 'extreme', reason: 'extreme_dust_haze_cap_28' }
      });

      expect(html).toContain('为什么是这个分数');
      expect(html).toContain('28 分：强沙尘/灰幕压制，分数封顶到 28');
      expect(html).not.toContain('score-ledger-context');
      expect(html).not.toContain('能见度 5km');
      expect(html).toContain('70.7');
      expect(html).toContain('72.5');
      expect(html).toContain('71.1');
      expect(html).toContain('60.4');
      expect(html).toContain('≤28');
      expect(html).toContain('最终分');
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
      expect(html).toContain('光路只有 40.0，归入轻微霞光档，最终展示分封顶到 60');
      expect(html).toContain('60 分：光路只有 40.0，归入轻微霞光档，最终展示分封顶到 60');
    });
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
    test('中高云载体文案不应暴露重复封顶等算法内部描述', () => {
      const groups = predictionController.buildAnalysisGroups({
        score: 72,
        cloudLayers: { high: 88, mid: 42, low: 4 },
        visibility: 18,
        humidity: 58,
        cloudThickness: { reasons: ['dense_upper_cloud_carrier_softened'] }
      });
      const html = predictionController.renderAnalysisCard(groups, 'test');

      expect(html).toContain('中高云载体明确');
      expect(html).toContain('色彩载体更稳定');
      expect(html).not.toContain('不再重复封顶');
      expect(html).not.toContain('不再额外封顶');
    });

    test('分析卡片最终 CSS 应保持上下文案左对齐且可换行', () => {
      const css = fs.readFileSync(path.join(rootDir, 'styles/main.css'), 'utf8');
      const finalRules = css.slice(css.lastIndexOf('formation analysis cards must read like compact notes'));

      expect(finalRules).toContain('grid-template-columns: 22px minmax(0, 1fr)');
      expect(finalRules).toContain('display: grid !important');
      expect(finalRules).toContain('white-space: normal !important');
      expect(finalRules).toContain('text-align: left !important');
      expect(finalRules).not.toContain('display: contents');
      expect(finalRules).not.toContain('text-align: right');
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
        'sunset',
        '晚霞',
        '日落时间',
        '北京',
        'sunset'
      );

      expect(html).toContain('西北偏西');
      expect(html).not.toContain('西北偏西 ↑');
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
});
