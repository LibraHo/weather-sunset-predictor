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
import PredictionController from '../../../src/controllers/PredictionController.js';
import zhCNLocale from '../../../src/locales/zh-CN.js';
import zhTWLocale from '../../../src/locales/zh-TW.js';
import enUSLocale from '../../../src/locales/en-US.js';
import jaJPLocale from '../../../src/locales/ja-JP.js';
import koKRLocale from '../../../src/locales/ko-KR.js';

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

  const setControllerLanguage = (lang) => {
    const unwrapLocale = (locale) => locale?.default || locale?.translations || locale;
    predictionController.i18n.translations = {
      ...predictionController.i18n.translations,
      'zh-CN': unwrapLocale(zhCNLocale),
      'zh-TW': unwrapLocale(zhTWLocale),
      'en-US': unwrapLocale(enUSLocale),
      'ja-JP': unwrapLocale(jaJPLocale),
      'ko-KR': unwrapLocale(koKRLocale)
    };
    predictionController.i18n.currentLanguage = lang;
    predictionController.i18n.getLanguage = () => predictionController.i18n.currentLanguage;
  };

  const createSamplePrediction = ({ score = 74, quality = 'good', type = 'sunset' }) => ({
    score,
    quality,
    type,
    sunsetTime: new Date('2024-06-21T19:45:00+08:00'),
    sunriseTime: new Date('2024-06-21T06:45:00+08:00'),
    sunAzimuth: null,
    cloudLayers: { high: 45, mid: 25, low: 8 },
    cloudCover: 30,
    humidity: 58,
    visibility: 18,
    aerosolOpticalDepth: 0.73,
    factors: {
      cloudCover: { value: 30 },
      highClouds: { value: 45 },
      midClouds: { value: 25 },
      lowClouds: { value: 8 },
      humidity: { value: 58 },
      visibility: { value: 18 },
      aerosolOpticalDepth: { value: 0.73 }
    },
    getOptimalViewingWindow: () => ({
      start: new Date('2024-06-21T19:15:00+08:00'),
      end: new Date('2024-06-21T20:15:00+08:00')
    }),
    shouldShowAzimuth: () => false
  });

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
    setControllerLanguage('zh-CN');
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

  describe('getLocalizedAzimuthDirection', () => {
    test('296° 应返回 西北偏西', () => {
      setControllerLanguage('zh-CN');
      const dir = predictionController.getLocalizedAzimuthDirection({ sunAzimuth: 296 });
      expect(dir).toBe('西北偏西');
    });

    test('90° 应返回 正东', () => {
      setControllerLanguage('zh-CN');
      const dir = predictionController.getLocalizedAzimuthDirection({ sunAzimuth: 90 });
      expect(dir).toBe('正东');
    });

    test('0° 应返回 正北', () => {
      setControllerLanguage('zh-CN');
      const dir = predictionController.getLocalizedAzimuthDirection({ sunAzimuth: 0 });
      expect(dir).toBe('正北');
    });

    test('英文环境 296° 应返回 WNW', () => {
      setControllerLanguage('en-US');
      const dir = predictionController.getLocalizedAzimuthDirection({ sunAzimuth: 296 });
      expect(dir).toBe('WNW');
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
        prediction, '🌅', '晚霞', '日落时间', '今日', 'sunset'
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

    test('zh-TW 下不会出现简体关键词且显示繁体文案', () => {
      setControllerLanguage('zh-TW');

      const html = predictionController.renderSinglePrediction(
        {
          score: 88,
          quality: 'excellent',
          type: 'sunset',
          sunsetTime: new Date('2024-06-21T19:45:00+08:00'),
          sunAzimuth: null,
          cloudLayers: { high: 72, mid: 44, low: 16 },
          cloudCover: 32,
          humidity: 56,
          visibility: 20,
          aerosolOpticalDepth: 0.16,
          factors: {
            highClouds: { value: 72 },
            midClouds: { value: 44 },
            lowClouds: { value: 16 },
            humidity: { value: 56 },
            visibility: { value: 20 },
            aerosolOpticalDepth: { value: 0.16 }
          },
          getOptimalViewingWindow: () => ({
            start: new Date('2024-06-21T19:15:00+08:00'),
            end: new Date('2024-06-21T20:15:00+08:00')
          }),
          shouldShowAzimuth: () => false,
          breakdown: {
            baseScore: 85,
            layerDiversity: { layerCount: 2 }
          },
          canvasAnalysis: { score: 85 },
          lightPathAnalysis: { score: 88 },
          renderingAnalysis: { factor: 0.94 }
        },
        '🌅',
        '晚霞',
        '日落時間',
        '今日',
        'sunset'
      );

      const simplifiedWords = ['条件', '强烈', '较', '云层', '观赏'];
      expect(html).toContain('評分明細');
      expect(html).toContain('火燒雲形成條件分析');
      expect(html).toContain('有利條件');
      expect(html).toContain('最佳觀賞時間');
      for (const word of simplifiedWords) {
        expect(html).not.toContain(word);
      }
    });

    test('ja-JP 下当前预测卡与分数明细不出现中文 fallback', () => {
      setControllerLanguage('ja-JP');

      const html = predictionController.renderSinglePrediction(
        {
          score: 88,
          quality: 'good',
          type: 'sunset',
          sunsetTime: new Date('2024-06-21T19:45:00+08:00'),
          sunAzimuth: null,
          cloudLayers: { high: 72, mid: 44, low: 16 },
          cloudCover: 32,
          humidity: 56,
          visibility: 20,
          aerosolOpticalDepth: 0.16,
          factors: {
            highClouds: { value: 72 },
            midClouds: { value: 44 },
            lowClouds: { value: 16 },
            humidity: { value: 56 },
            visibility: { value: 20 },
            aerosolOpticalDepth: { value: 0.16 }
          },
          getOptimalViewingWindow: () => ({
            start: new Date('2024-06-21T19:15:00+08:00'),
            end: new Date('2024-06-21T20:15:00+08:00')
          }),
          shouldShowAzimuth: () => false,
          breakdown: { baseScore: 85, layerDiversity: { layerCount: 2 } },
          canvasAnalysis: { score: 85 },
          lightPathAnalysis: { score: 88 },
          renderingAnalysis: { factor: 0.94 }
        },
        '🌅',
        '夕焼け',
        '日没時間',
        '今日',
        'sunset'
      );

      const badWords = ['火烧云形成条件分析', '有利条件', '注意因素', '高层云', '分数明细'];
      for (const word of badWords) {
        expect(html).not.toContain(word);
      }
      expect(html).toContain('スコア明細');
      expect(html).toContain('有利要素');
      expect(html).toContain('火焼雲形成条件を確認');
    });

    test('ko-KR 下当前预测卡与分数明细不出现中文 fallback', () => {
      setControllerLanguage('ko-KR');

      const html = predictionController.renderSinglePrediction(
        {
          score: 88,
          quality: 'good',
          type: 'sunset',
          sunsetTime: new Date('2024-06-21T19:45:00+08:00'),
          sunAzimuth: null,
          cloudLayers: { high: 72, mid: 44, low: 16 },
          cloudCover: 32,
          humidity: 56,
          visibility: 20,
          aerosolOpticalDepth: 0.16,
          factors: {
            highClouds: { value: 72 },
            midClouds: { value: 44 },
            lowClouds: { value: 16 },
            humidity: { value: 56 },
            visibility: { value: 20 },
            aerosolOpticalDepth: { value: 0.16 }
          },
          getOptimalViewingWindow: () => ({
            start: new Date('2024-06-21T19:15:00+08:00'),
            end: new Date('2024-06-21T20:15:00+08:00')
          }),
          shouldShowAzimuth: () => false,
          breakdown: { baseScore: 85, layerDiversity: { layerCount: 2 } },
          canvasAnalysis: { score: 85 },
          lightPathAnalysis: { score: 88 },
          renderingAnalysis: { factor: 0.94 }
        },
        '🌅',
        '저녁 노을',
        '일몰 시간',
        '오늘',
        'sunset'
      );

      const badWords = ['火烧云形成条件分析', '有利条件', '注意因素', '高层云', '分数明细', '分'];
      for (const word of badWords) {
        expect(html).not.toContain(word);
      }
      expect(html).toContain('점수 상세');
      expect(html).toContain('화염구름 형성 조건 분석');
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
        '🌅',
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
        '🌄',
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
        prediction, '🌅', '晚霞', '日落时间', '今日', 'sunset'
      );

      expect(html).toContain('AOD 0.73');
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
        prediction, '🌅', '晚霞', '日落时间', '今日', 'sunset'
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
        prediction, '🌅', '晚霞', '日落时间', '今日', 'sunset'
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
        '🌅',
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

  describe('未来预测 i18n fallback 回归', () => {
    test('ja-JP 未来预测不出现中文关键词', () => {
      setControllerLanguage('ja-JP');
      document.body.innerHTML = `
        <section id="forecast-section" class="hidden">
          <div id="forecast-timeline"></div>
        </section>
      `;

      const base = new Date('2024-06-01T00:00:00+08:00');
      const predictions = [
        { date: base, type: 'sunrise', quality: 'good', score: 75, sunriseTime: new Date(base.getTime() + 7 * 60 * 60 * 1000), shouldShowAzimuth: () => false, qualityLabel: 'good' },
        { date: base, type: 'sunset', quality: 'good', score: 72, sunsetTime: new Date(base.getTime() + 17 * 60 * 60 * 1000), shouldShowAzimuth: () => false, qualityLabel: 'good' },
        { date: new Date(base.getTime() + 24 * 60 * 60 * 1000), type: 'sunrise', quality: 'fair', score: 55, sunriseTime: new Date(base.getTime() + 24 * 60 * 60 * 1000 + 7 * 60 * 60 * 1000), shouldShowAzimuth: () => false, qualityLabel: 'fair' },
        { date: new Date(base.getTime() + 24 * 60 * 60 * 1000), type: 'sunset', quality: 'poor', score: 40, sunsetTime: new Date(base.getTime() + 24 * 60 * 60 * 1000 + 17 * 60 * 60 * 1000), shouldShowAzimuth: () => false, qualityLabel: 'poor' },
        { date: new Date(base.getTime() + 48 * 60 * 60 * 1000), type: 'sunset', quality: 'good', score: 63, sunsetTime: new Date(base.getTime() + 48 * 60 * 60 * 1000 + 17 * 60 * 60 * 1000), shouldShowAzimuth: () => false, qualityLabel: 'good' }
      ];

      predictionController.updateForecastTimeline(predictions);

      const timeline = document.querySelector('#forecast-timeline').innerHTML;
      expect(timeline).toContain('点');
      expect(timeline).not.toContain('分');
      ['火烧云形成条件分析', '有利条件', '注意因素', '高层云'].forEach((word) => {
        expect(timeline).not.toContain(word);
      });
    });

    test('ko-KR 未来预测不出现中文关键词', () => {
      setControllerLanguage('ko-KR');
      document.body.innerHTML = `
        <section id="forecast-section" class="hidden">
          <div id="forecast-timeline"></div>
        </section>
      `;

      const base = new Date('2024-06-01T00:00:00+08:00');
      const predictions = [
        { date: base, type: 'sunrise', quality: 'good', score: 75, sunriseTime: new Date(base.getTime() + 7 * 60 * 60 * 1000), shouldShowAzimuth: () => false, qualityLabel: 'good' },
        { date: base, type: 'sunset', quality: 'good', score: 72, sunsetTime: new Date(base.getTime() + 17 * 60 * 60 * 1000), shouldShowAzimuth: () => false, qualityLabel: 'good' },
        { date: new Date(base.getTime() + 24 * 60 * 60 * 1000), type: 'sunrise', quality: 'fair', score: 55, sunriseTime: new Date(base.getTime() + 24 * 60 * 60 * 1000 + 7 * 60 * 60 * 1000), shouldShowAzimuth: () => false, qualityLabel: 'fair' },
        { date: new Date(base.getTime() + 24 * 60 * 60 * 1000), type: 'sunset', quality: 'poor', score: 40, sunsetTime: new Date(base.getTime() + 24 * 60 * 60 * 1000 + 17 * 60 * 60 * 1000), shouldShowAzimuth: () => false, qualityLabel: 'poor' },
        { date: new Date(base.getTime() + 48 * 60 * 60 * 1000), type: 'sunset', quality: 'good', score: 63, sunsetTime: new Date(base.getTime() + 48 * 60 * 60 * 1000 + 17 * 60 * 60 * 1000), shouldShowAzimuth: () => false, qualityLabel: 'good' }
      ];

      predictionController.updateForecastTimeline(predictions);

      const timeline = document.querySelector('#forecast-timeline').innerHTML;
      expect(timeline).toContain('점');
      expect(timeline).not.toContain('分');
      ['火烧云形成条件分析', '有利条件', '注意因素', '高层云'].forEach((word) => {
        expect(timeline).not.toContain(word);
      });
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
