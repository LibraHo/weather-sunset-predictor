/**
 * PredictionController - 晚霞预测控制器
 *
 * 管理晚霞预测的生成和显示
 *
 * 需求：7.1, 7.2 - 未来预测时间线
 * 需求：12.1, 12.2, 12.3, 12.4, 12.5, 12.8, 12.11, 12.12, 12.13 - 朝霞晚霞预测增强功能
 * 需求：14 - 多语言支持
 * 需求：22 - 前后端分离（Phase 1: 基础预测服务后端化）
 */

import SunsetPredictionService from '../services/SunsetPredictionService.js';
import EnhancedSunsetPredictionService from '../services/EnhancedSunsetPredictionService.js';
// UnifiedSunsetScoringService 已内联进 SunsetPredictionService._calculateUnifiedScore
import PredictionAPIService from '../services/PredictionAPIService.js';
import NotificationService from '../services/NotificationService.js';
import i18n from '../i18n.js';
import { loadConfig } from '../../config.api.js';

const EVENT_PASSED_BUFFER_MS = 45 * 60 * 1000;

// 分享面板状态
let sharePanelInstance = null;

/**
 * 创建或获取分享面板实例
 * @returns {SharePanel}
 */
function getSharePanel() {
  if (!sharePanelInstance) {
    sharePanelInstance = new SharePanel();
  }
  return sharePanelInstance;
}

/**
 * 分享面板组件 — 改为纯逻辑层，不再管理 DOM 创建/销毁
 * 下拉菜单 DOM 由 PredictionController 在 renderSinglePrediction 中生成
 */
class SharePanel {
  constructor() {
    this.isOpen = false;
    this.i18n = i18n;
    this.currentPrediction = null;
  }

  /**
   * 打开分享面板（兼容性保留，实际逻辑已移至 PredictionController 事件绑定）
   * @param {Object} prediction - 预测数据
   */
  open(prediction) {
    this.currentPrediction = prediction;
    this.isOpen = true;
  }

  /**
   * 关闭分享面板
   */
  close() {
    this.isOpen = false;
  }

  async recordShareEvent(action, prediction = this.currentPrediction) {
    try {
      const period = prediction?.type === 'sunrise' ? 'sunrise' : (prediction?.type === 'sunset' ? 'sunset' : 'unknown');
      await fetch('/api/share/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, period, source: 'prediction-card' }),
        keepalive: true
      });
    } catch (error) {
      console.warn('分享统计上报失败:', error);
    }
  }

  /**
   * 处理保存图片 — 使用 ShareCardGenerator 纯 Canvas 绘制
   */
  async handleSaveImage() {
    try {
      const prediction = this.currentPrediction;
      if (!prediction) {
        this.showToast('无预测数据');
        return;
      }

      const { generateShareCard } = await import('../services/ShareCardGenerator.js');
      const period = prediction.type === 'sunrise' ? 'sunrise' : 'sunset';

      // 获取地点名
      const locationName = document.querySelector('#weather-location')?.textContent?.trim()
        || document.querySelector('.location-name')?.textContent?.trim()
        || document.querySelector('#location-name')?.textContent?.trim()
        || '';

      const blob = await generateShareCard(prediction, locationName, period, this.i18n);

      // 下载
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `sunset-${period}-${Date.now()}.png`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);

      this.showToast('图片已保存');
      this.recordShareEvent('save', prediction);
    } catch (error) {
      console.error('保存图片失败:', error);
      this.showToast('保存失败，请重试');
    }
    this.close();
  }

  /**
   * 处理复制链接
   */
  async handleCopyLink() {
    try {
      const url = window.location.href;
      await navigator.clipboard.writeText(url);
      this.showToast(this.i18n.t('share.copied'));
      this.recordShareEvent('copy');
    } catch (error) {
      console.error('复制链接失败:', error);
      // 降级方案
      const textArea = document.createElement('textarea');
      textArea.value = window.location.href;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      this.showToast(this.i18n.t('share.copied'));
      this.recordShareEvent('copy');
    }
    this.close();
  }

  /**
   * 处理原生分享 — 优先带图片文件
   */
  async handleNativeShare() {
    try {
      const prediction = this.currentPrediction;
      const period = prediction?.type === 'sunrise' ? 'sunrise' : 'sunset';
      const shareText = this.getShareText();

      // 尝试生成图片并带图分享
      const canShareFiles = navigator.canShare && navigator.canShare({ files: [new File([], 'test.png', { type: 'image/png' })] });

      if (canShareFiles) {
        try {
          const { generateShareCard } = await import('../services/ShareCardGenerator.js');
          const locationName = document.querySelector('#weather-location')?.textContent?.trim()
            || document.querySelector('.location-name')?.textContent?.trim()
            || document.querySelector('#location-name')?.textContent?.trim()
            || '';
          const blob = await generateShareCard(prediction, locationName, period, this.i18n);
          const periodLabel = period === 'sunrise'
            ? this.i18n.t('prediction.sunrise')
            : this.i18n.t('prediction.sunset');
          const file = new File([blob], `${this.i18n.t('shareCard.brandName')}-${periodLabel}${this.i18n.t('share.cardPredictionFileSuffix')}.png`, { type: 'image/png' });

          await navigator.share({
            title: shareText,
            text: shareText,
            files: [file],
          });
          this.recordShareEvent('native', prediction);
          this.close();
          return;
        } catch (imgErr) {
          if (imgErr.name === 'AbortError') { this.close(); return; }
          // 图片分享失败，降级为链接分享
          console.warn('带图分享失败，降级为链接:', imgErr);
        }
      }

      // 降级：分享链接
      await navigator.share({
        title: shareText,
        text: shareText,
        url: window.location.href,
      });
      this.recordShareEvent('native', prediction);
      // 降级分享成功后关闭面板
      this.close();
      return;
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('原生分享失败:', error);
        this.showToast('分享失败');
      }
      // AbortError 或其他错误也关闭面板
      this.close();
    }
  }

  /**
   * 获取分享文本
   * @returns {string}
   */
  getShareText() {
    if (!this.currentPrediction) {
      return this.i18n.t('share.title');
    }
    const type = this.currentPrediction.type === 'sunrise' ? '朝霞' : '晚霞';
    const score = Math.round(this.currentPrediction.score || 0);
    const quality = this.i18n.t(`prediction.${this.currentPrediction.quality}`);
    return `${type}预测：${score}分 (${quality})`;
  }

  /**
   * 显示提示消息
   * @param {string} message
   */
  showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'share-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.add('show');
    }, 10);
    
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        document.body.removeChild(toast);
      }, 300);
    }, 2000);
  }
}

class PredictionController {
  /**
   * 创建PredictionController实例
   * @param {StorageService} storageService - 存储服务实例
   */
  constructor(storageService) {
    this.storageService = storageService;
    this.predictionService = new SunsetPredictionService();
    this.enhancedPredictionService = new EnhancedSunsetPredictionService();
    this.notificationService = new NotificationService(storageService);
    this.predictions = []; // 存储当前预测数据
    this.useEnhancedModel = true; // 默认使用增强模型
    this.i18n = i18n; // 需求14：添加i18n实例

    // 需求22：前后端分离 - 读取功能开关配置
    const config = loadConfig();
    this.features = config.features;
    this.apiConfig = config;
    this.weatherFetchMode = config.weatherFetchMode || 'client-fallback';
    this.predictionPanelAlignmentRaf = null;
    this.predictionPanelAlignmentRoot = null;
    this.predictionPanelResizeHandler = null;

    // 初始化后端 API 服务
    this.predictionAPIService = new PredictionAPIService(config.proxy.url);
    console.log('[PredictionController] 功能开关:', this.features);

    // 统一评分通过 predictionService._calculateUnifiedScore() 调用
  }

  getPredictionAlignmentSelectors() {
    return [
      '.phenomenon-title-card',
      '.conclusion-banner',
      '.score-summary-card',
      '.cloud-condition-card',
      '.app-analysis-card',
      '[id^="radar-compass-"]'
    ];
  }

  syncPairedPredictionCardRows(root = document) {
    const container = root.querySelector?.('#today-predictions-container');
    if (!container) return;

    const panels = Array.from(container.querySelectorAll('.prediction-tab-panel'));
    const cards = panels
      .map(panel => panel.querySelector('.prediction-app-card'))
      .filter(Boolean);
    const selectors = this.getPredictionAlignmentSelectors();

    selectors.forEach(selector => {
      cards.forEach(card => {
        const element = card.querySelector(selector);
        if (element) element.style.minHeight = '';
      });
    });

    const isDesktop = window.matchMedia?.('(min-width: 641px)').matches ?? window.innerWidth >= 641;
    if (!isDesktop || cards.length < 2) return;

    selectors.forEach(selector => {
      const elements = cards
        .map(card => card.querySelector(selector))
        .filter(Boolean);
      if (elements.length < 2) return;

      const maxHeight = Math.ceil(Math.max(...elements.map(element => element.getBoundingClientRect().height)));
      if (maxHeight <= 0) return;

      elements.forEach(element => {
        element.style.minHeight = `${maxHeight}px`;
      });
    });
  }

  schedulePairedPredictionCardAlignment(root = document) {
    this.predictionPanelAlignmentRoot = root;

    const run = () => this.syncPairedPredictionCardRows(this.predictionPanelAlignmentRoot || document);
    if (this.predictionPanelAlignmentRaf && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.predictionPanelAlignmentRaf);
    }

    const scheduleFrame = typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame
      : (callback) => setTimeout(callback, 0);

    this.predictionPanelAlignmentRaf = scheduleFrame(() => {
      run();
      setTimeout(run, 80);
    });

    if (!this.predictionPanelResizeHandler) {
      this.predictionPanelResizeHandler = () => this.schedulePairedPredictionCardAlignment(this.predictionPanelAlignmentRoot || document);
      window.addEventListener('resize', this.predictionPanelResizeHandler, { passive: true });
    }
  }

  /**
   * 根据开关选择使用前端或后端计算预测
   *
   * 需求22：前后端分离 - 支持渐进式迁移
   *
   * @param {Object} weatherData - 天气数据
   * @param {Date} date - 预测日期
   * @param {number} lat - 纬度
   * @param {number} lon - 经度
   * @param {string} type - 预测类型 ('sunrise' | 'sunset')
   * @returns {Promise<SunsetPrediction>} 预测结果
   * @private
   */
  async _calculatePredictionWithBackend(weatherData, date, lat, lon, type, weatherDataArray = null) {
    if (weatherData?.isManualTestCity || weatherData?.providerMeta?.name === 'manual-test' || weatherDataArray?.providerMeta?.name === 'manual-test') {
      return this.predictionService.calculatePrediction(weatherData, date, lat, lon, type, {
        timezone: weatherData?.timezone || weatherDataArray?.providerMeta?.timezone || null
      });
    }

    // 检查是否启用后端基础预测
    if (this.features.USE_BACKEND_PREDICTION) {
      try {
        console.log(`[PredictionController] 使用后端 API 计算预测 (${type})`);

        const clientWeatherOptions = this._buildClientWeatherOptions(weatherData, weatherDataArray);
        const mode = loadConfig().weatherFetchMode || this.weatherFetchMode || 'backend';

        if (mode === 'client') {
          console.warn('[PredictionController] WEATHER_FETCH_MODE=client，使用浏览器天气数据 + 后端算分');
          return await this.predictionAPIService.calculate(weatherData, date, lat, lon, type, {
            ...clientWeatherOptions,
            weatherFetchMode: 'client',
            clientWeatherFallback: true
          });
        }

        if (mode === 'client-fallback' && this._forceClientWeatherPredictionFallback) {
          console.warn('[PredictionController] 后端批量预测不可用，本轮直接使用浏览器天气数据 + 后端算分 fallback');
          try {
            return await this.predictionAPIService.calculate(weatherData, date, lat, lon, type, {
              ...clientWeatherOptions,
              clientWeatherFallback: true
            });
          } catch (fallbackError) {
            console.warn('[PredictionController] 后端应急算分仍不可用，改用前端本地预测:', fallbackError.message);
            return this._calculateLocalPredictionFallback(weatherData, date, lat, lon, type, weatherDataArray);
          }
        }

        if (mode !== 'client') {
          const batchKey = this._predictionBatchKey(type, date);
          const batchPrediction = this._closedLoopBatchPredictionMap?.get(batchKey);
          if (batchPrediction) {
            console.log(`[PredictionController] 使用后端闭环批量预测缓存 (${type})`);
            return batchPrediction;
          }
        }

        try {
          return await this.predictionAPIService.calculate(weatherData, date, lat, lon, type);
        } catch (error) {
          if (mode === 'client-fallback' && this._isWeatherFallbackEligible(error)) {
            console.warn('[PredictionController] 后端闭环天气不可用，使用浏览器天气数据 + 后端算分 fallback:', error.message);
            try {
              return await this.predictionAPIService.calculate(weatherData, date, lat, lon, type, {
                ...clientWeatherOptions,
                clientWeatherFallback: true
              });
            } catch (fallbackError) {
              console.warn('[PredictionController] 后端应急算分仍不可用，改用前端本地预测:', fallbackError.message);
              return this._calculateLocalPredictionFallback(weatherData, date, lat, lon, type, weatherDataArray);
            }
          }
          throw error;
        }
      } catch (error) {
        console.error(`[PredictionController] 后端 API 调用失败（已禁用本地旧算法回退）:`, error.message);
        throw error;
      }
    } else {
      // 使用前端计算
      return this._calculateLocalPredictionFallback(weatherData, date, lat, lon, type, weatherDataArray);
    }
  }

  _calculateLocalPredictionFallback(weatherData, date, lat, lon, type, weatherDataArray = null) {
    return this.predictionService.calculatePrediction(weatherData, date, lat, lon, type, {
      timezone: weatherData?.timezone || weatherDataArray?.providerMeta?.timezone || null
    });
  }


  _buildClientWeatherOptions(weatherData, weatherDataArray = null) {
    const options = { prevHourData: null, rainedRecently: false };
    if (!weatherData || !Array.isArray(weatherDataArray)) {
      return options;
    }

    const ts = weatherData.timestamp;
    if (ts) {
      for (let offset = 1; offset <= 2; offset += 1) {
        const prevTs = ts - offset * 3600000;
        const prev = weatherDataArray.find(d => d.timestamp === prevTs);
        if (prev && prev.shortwaveRadiation != null && prev.shortwaveRadiation > 50) {
          weatherData._prevHourData = prev;
          options.prevHourData = prev;
          break;
        }
      }

      let recentPrecipitation6h = 0;
      for (const row of weatherDataArray) {
        if (row.timestamp <= ts && row.timestamp >= ts - 6 * 3600000) {
          recentPrecipitation6h += Number(row.precipitation || 0);
        }
      }
      options.rainedRecently = recentPrecipitation6h >= 0.2;
    }
    return options;
  }

  _isWeatherFallbackEligible(error) {
    const code = String(error?.code || '').toLowerCase();
    const message = String(error?.message || '').toLowerCase();
    return code === 'weather_rate_limited'
      || code === 'weather_quota_exceeded'
      || code === 'weather_upstream_timeout'
      || code === 'weather_provider_unavailable'
      || code === 'prediction_api_timeout'
      || message.includes('weather_rate_limited')
      || message.includes('weather_quota_exceeded')
      || message.includes('weather_upstream_timeout')
      || message.includes('weather_provider_unavailable')
      || message.includes('prediction_api_timeout')
      || message.includes('signal is aborted')
      || message.includes('没有返回')
      || message.includes('429')
      || message.includes('quota')
      || message.includes('rate')
      || message.includes('timeout')
      || message.includes('超时')
      || message.includes('频繁');
  }

  _isPredictionRequestTimeout(error) {
    const code = String(error?.code || '').toLowerCase();
    const name = String(error?.name || '').toLowerCase();
    const message = String(error?.message || '').toLowerCase();
    return code === 'prediction_api_timeout'
      || name === 'timeouterror'
      || message.includes('prediction_api_timeout')
      || message.includes('signal is aborted')
      || message.includes('没有返回');
  }

  _predictionBatchKey(type, date) {
    const ts = date instanceof Date ? date.getTime() : new Date(date).getTime();
    return `${type}:${ts}`;
  }

  async _prepareClosedLoopBatchPredictions({ today, location, targetTimezone }) {
    const mode = loadConfig().weatherFetchMode || this.weatherFetchMode || 'backend';
    this._forceClientWeatherPredictionFallback = false;
    if (!this.features.USE_BACKEND_PREDICTION || mode === 'client') {
      this._closedLoopBatchPredictionMap = null;
      return;
    }

    const items = [];
    for (let i = 0; i < 4; i += 1) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + i);
      const sunriseTime = this.predictionService.getSunriseTime(targetDate, location.lat, location.lon, { timezone: targetTimezone });
      const sunsetTime = this.predictionService.getSunsetTime(targetDate, location.lat, location.lon, { timezone: targetTimezone });
      if (sunriseTime) {
        items.push({ id: this._predictionBatchKey('sunrise', sunriseTime), date: sunriseTime, referenceTime: sunriseTime, type: 'sunrise' });
      }
      if (sunsetTime) {
        items.push({ id: this._predictionBatchKey('sunset', sunsetTime), date: sunsetTime, referenceTime: sunsetTime, type: 'sunset' });
      }
    }

    if (!items.length) return;

    try {
      const gateway = await this.predictionAPIService.getHomeGateway({
        lat: location.lat,
        lon: location.lon,
        date: today,
        period: 'sunset',
        days: 4,
        includeRemoteCloudData: true
      });
      this._closedLoopBatchPredictionMap = new Map();
      gateway.predictions.list.forEach((prediction) => {
        if (prediction?.id) this._closedLoopBatchPredictionMap.set(prediction.id, prediction);
      });
      if (this._closedLoopBatchPredictionMap.size > 0) {
        console.log(`[PredictionController] 后端首页聚合预测预取完成: ${this._closedLoopBatchPredictionMap.size}/${items.length}`);
        return;
      }
    } catch (gatewayError) {
      console.warn('[PredictionController] 后端首页聚合预测失败，回退到批量预测:', gatewayError.message);
    }

    try {
      const predictions = await this.predictionAPIService.calculateBatchClosedLoop(items, location.lat, location.lon);
      this._closedLoopBatchPredictionMap = new Map();
      predictions.forEach((prediction) => {
        if (prediction?.id) this._closedLoopBatchPredictionMap.set(prediction.id, prediction);
      });
      console.log(`[PredictionController] 后端闭环批量预测预取完成: ${this._closedLoopBatchPredictionMap.size}/${items.length}`);
    } catch (error) {
      if (mode === 'client-fallback' && this._isWeatherFallbackEligible(error)) {
        console.warn('[PredictionController] 后端闭环批量预测失败，本轮改用浏览器天气数据应急:', error.message);
        this._closedLoopBatchPredictionMap = null;
        this._forceClientWeatherPredictionFallback = true;
        return;
      }
      console.warn('[PredictionController] 后端闭环批量预测失败，回退到单条预测:', error.message);
      this._closedLoopBatchPredictionMap = null;
    }
  }

  /**
   * 为增强模型结果补齐太阳方位角相关字段，兼容统一渲染逻辑
   * @param {Object} prediction - 预测对象
   * @param {Date} referenceTime - 日出/日落时间
   * @param {Date} baseDate - 预测日期
   * @param {number} lat - 纬度
   * @param {number} lon - 经度
   * @private
   */
  _ensureAzimuthCompatibility(prediction, referenceTime, baseDate, lat, lon) {
    if ((prediction.sunAzimuth === null || prediction.sunAzimuth === undefined) && referenceTime) {
      prediction.sunAzimuth = this.predictionService.getSunAzimuth(baseDate, referenceTime, lat, lon, { timezone: prediction.timezone || prediction.timeZone || null });
    }

    if (!prediction.getAzimuthDirection) {
      prediction.getAzimuthDirection = () => this.formatChineseRelativeAzimuth(prediction.sunAzimuth, 'zh-CN');
    }

    if (!prediction.shouldShowAzimuth) {
      prediction.shouldShowAzimuth = () => prediction.sunAzimuth !== null && prediction.sunAzimuth !== undefined;
    }
  }

  /**
   * 生成晚霞预测
   * 
   * @param {Array} weatherDataArray - 天气数据数组
   * @param {Location} location - 位置对象
   * @returns {Promise<Array>} 预测结果数组
   */
  async generatePredictions(weatherDataArray, location) {
    if (!weatherDataArray || weatherDataArray.length === 0) {
      throw new Error('天气数据为空');
    }

    if (!location || !location.isValid()) {
      throw new Error('位置信息无效');
    }

    console.log('[PredictionController] 生成朝霞和晚霞预测...');
    console.log('[PredictionController] 天气数据条数:', weatherDataArray.length);
    console.log('[PredictionController] 位置:', location);
    const targetTimezone = weatherDataArray.find(item => item?.timezone)?.timezone || null;

    // 输出天气数据范围信息
    if (weatherDataArray.length > 0) {
      const firstDataTime = new Date(weatherDataArray[0].timestamp);
      const lastDataTime = new Date(weatherDataArray[weatherDataArray.length - 1].timestamp);
      console.log(`[PredictionController] 天气数据时间范围: ${firstDataTime.toLocaleString('zh-CN')} 到 ${lastDataTime.toLocaleString('zh-CN')}`);
    }

    const predictions = [];
    const predictionErrors = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    this._forceClientWeatherPredictionFallback = false;
    await this._prepareClosedLoopBatchPredictions({ today, location, targetTimezone });

    // 仅生成 UI 会展示的今天 + 未来3天，避免额外第5天白跑朝/晚霞预测请求
    for (let i = 0; i < 4; i++) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + i);

      console.log(`[PredictionController] 处理第 ${i} 天:`, targetDate);

      try {
        // 1. 生成日出（朝霞）预测
        const sunriseTime = this.predictionService.getSunriseTime(
          targetDate,
          location.lat,
          location.lon,
          { timezone: targetTimezone }
        );

        console.log(`[PredictionController] 日出时间:`, sunriseTime);

        const sunriseTimestamp = sunriseTime.getTime();

        // 首先尝试找到2小时内的数据
        let sunriseWeatherData = weatherDataArray.find(data => {
          const timeDiff = Math.abs(data.timestamp - sunriseTimestamp);
          return timeDiff < 7200000; // 2小时内
        });

        // 备用方案：如果找不到，使用该天最接近日出时间的数据
        if (!sunriseWeatherData) {
          console.log(`[PredictionController] 第${i}天 未找到日出2小时内的数据，使用最接近的数据`);
          // 找到该天范围内最接近日出时间的数据
          const dayStart = new Date(targetDate).setHours(0, 0, 0, 0);
          const dayEnd = new Date(targetDate).setHours(23, 59, 59, 999);

          const dayData = weatherDataArray.filter(data => {
            return data.timestamp >= dayStart && data.timestamp <= dayEnd;
          });

          console.log(`[PredictionController] 第${i}天 该天的天气数据条数: ${dayData.length}`);

          if (dayData.length > 0) {
            // 找到最接近日出时间的数据
            sunriseWeatherData = dayData.reduce((closest, current) => {
              const closestDiff = Math.abs(closest.timestamp - sunriseTimestamp);
              const currentDiff = Math.abs(current.timestamp - sunriseTimestamp);
              return currentDiff < closestDiff ? current : closest;
            });
            console.log(`[PredictionController] 第${i}天 使用最接近的数据 (时间差: ${Math.abs(sunriseWeatherData.timestamp - sunriseTimestamp) / 3600000}小时)`);
          } else {
            console.log(`[PredictionController] 第${i}天 该天完全没有天气数据！`);
          }
        } else {
          console.log(`[PredictionController] 第${i}天 日出天气数据: 找到 (时间差: ${Math.abs(sunriseWeatherData.timestamp - sunriseTimestamp) / 3600000}小时)`);
        }

        // 检查日出时间是否在天气数据范围内
        const sunriseInRange = sunriseTimestamp >= weatherDataArray[0].timestamp && sunriseTimestamp <= weatherDataArray[weatherDataArray.length - 1].timestamp;
        console.log(`[PredictionController] 第${i}天 日出时间在数据范围内:`, sunriseInRange);

        if (sunriseWeatherData) {
          console.log(`[PredictionController] 找到日出相关天气数据`);

          // 使用增强版或标准预测服务
          let sunrisePrediction;
          // 统一走后端预测，后端失败才 fallback 到前端本地计算
          sunrisePrediction = await this._calculatePredictionWithBackend(
            sunriseWeatherData,
            sunriseTime,  // 用实际日出时刻，后端才能正确计算太阳高度角
            location.lat,
            location.lon,
            'sunrise',
            weatherDataArray
          );
          console.log(`[PredictionController] 朝霞预测完成，得分: ${sunrisePrediction.score}`);

          // 标记为朝霞预测
          sunrisePrediction.type = 'sunrise';
          sunrisePrediction.typeName = '朝霞';
          sunrisePrediction.date = targetDate;
          sunrisePrediction.location = location.name;
          sunrisePrediction.temperature = sunriseWeatherData.temp;
          sunrisePrediction.humidity = sunriseWeatherData.humidity;
          sunrisePrediction.cloudCover = sunriseWeatherData.cloudCover;
          sunrisePrediction.windSpeed = sunriseWeatherData.windSpeed;
          sunrisePrediction.pressure = sunriseWeatherData.pressure;
          sunrisePrediction.visibility = sunriseWeatherData.visibility;
          sunrisePrediction.precipitation = sunriseWeatherData.precipitation ?? 0;
          sunrisePrediction.weatherCode = sunriseWeatherData.weatherCode ?? sunriseWeatherData.weathercode ?? null;
          // 确保 sunriseTime 字段有值（渲染层用 type===sunrise 时取 sunriseTime）
          if (!sunrisePrediction.sunriseTime) {
            sunrisePrediction.sunriseTime = sunriseTime;
          }
          sunrisePrediction.timezone = sunriseWeatherData.timezone || targetTimezone;

          // 为增强版预测添加最佳观看窗口方法和factors属性
          if (this.useEnhancedModel) {
            this._ensureAzimuthCompatibility(sunrisePrediction, sunriseTime, targetDate, location.lat, location.lon);

            if (!sunrisePrediction.getOptimalViewingWindow) {
              sunrisePrediction.getOptimalViewingWindow = () => {
                if (!sunriseTime) return { start: null, end: null, description: '日出时间未知' };
                return {
                  start: new Date(sunriseTime.getTime() - 30 * 60 * 1000),
                  end: new Date(sunriseTime.getTime() + 30 * 60 * 1000),
                  description: '日出前后30分钟是观看朝霞的最佳时间'
                };
              };
            }

            // 为增强版预测添加factors属性以兼容旧的渲染逻辑
            if (!sunrisePrediction.factors) {
              sunrisePrediction.factors = {
                cloudCover: { value: sunriseWeatherData.cloudCover, name: '云量', unit: '%' },
                humidity: { value: sunriseWeatherData.humidity, name: '湿度', unit: '%' },
                visibility: { value: sunriseWeatherData.visibility, name: '能见度', unit: 'km' },
                windSpeed: { value: sunriseWeatherData.windSpeed, name: '风速', unit: 'km/h' },
                pressure: { value: sunriseWeatherData.pressure, name: '气压', unit: 'hPa' },
                lowClouds: { value: sunriseWeatherData.lowClouds, name: '低云量', unit: '%' },
                midClouds: { value: sunriseWeatherData.midClouds, name: '中云量', unit: '%' },
                highClouds: { value: sunriseWeatherData.highClouds, name: '高云量', unit: '%' },
                precipitation: { value: sunriseWeatherData.precipitation ?? 0, name: '降水', unit: 'mm/h' },
                weatherCode: { value: sunriseWeatherData.weatherCode ?? sunriseWeatherData.weathercode ?? null, name: '天气', unit: '' }
              };
            }

            // 为增强版预测添加cloudLayers属性以显示云层分层信息
            if (!sunrisePrediction.cloudLayers) {
              const highClouds = sunriseWeatherData.highClouds ?? 0;
              const midClouds = sunriseWeatherData.midClouds ?? 0;
              const lowClouds = sunriseWeatherData.lowClouds ?? 0;

              sunrisePrediction.cloudLayers = {
                high: highClouds,
                mid: midClouds,
                low: lowClouds,
                description: sunrisePrediction.canvasAnalysis ?
                  `高云${highClouds.toFixed(0)}% 中云${midClouds.toFixed(0)}% 低云${lowClouds.toFixed(0)}%` :
                  ''
              };
            }
          }

          predictions.push(sunrisePrediction);
        }

        // 2. 生成日落（晚霞）预测
        const sunsetTime = this.predictionService.getSunsetTime(
          targetDate,
          location.lat,
          location.lon,
          { timezone: targetTimezone }
        );

        console.log(`[PredictionController] 第${i}天 日落时间:`, sunsetTime, `时间戳: ${sunsetTime?.getTime()}`);
        console.log(`[PredictionController] 第${i}天 targetDate:`, targetDate, `时间戳: ${targetDate?.getTime()}`);

        if (!sunsetTime) continue;
        const sunsetTimestamp = sunsetTime.getTime();

        // 首先尝试找到2小时内的数据
        let sunsetWeatherData = weatherDataArray.find(data => {
          const timeDiff = Math.abs(data.timestamp - sunsetTimestamp);
          return timeDiff < 7200000; // 2小时内
        });

        // 备用方案：如果找不到，使用该天最接近日落时间的数据
        if (!sunsetWeatherData) {
          console.log(`[PredictionController] 第${i}天 未找到日落2小时内的数据，使用最接近的数据`);
          // 找到该天范围内最接近日落时间的数据
          const dayStart = new Date(targetDate).setHours(0, 0, 0, 0);
          const dayEnd = new Date(targetDate).setHours(23, 59, 59, 999);

          const dayData = weatherDataArray.filter(data => {
            return data.timestamp >= dayStart && data.timestamp <= dayEnd;
          });

          if (dayData.length > 0) {
            // 找到最接近日落时间的数据
            sunsetWeatherData = dayData.reduce((closest, current) => {
              const closestDiff = Math.abs(closest.timestamp - sunsetTimestamp);
              const currentDiff = Math.abs(current.timestamp - sunsetTimestamp);
              return currentDiff < closestDiff ? current : closest;
            });
            console.log(`[PredictionController] 第${i}天 使用最接近的数据 (时间差: ${Math.abs(sunsetWeatherData.timestamp - sunsetTimestamp) / 3600000}小时)`);
          }
        } else {
          console.log(`[PredictionController] 第${i}天 日落天气数据: 找到 (时间差: ${Math.abs(sunsetWeatherData.timestamp - sunsetTimestamp) / 3600000}小时)`);
        }

        // 检查日落时间是否在天气数据范围内
        const inRange = sunsetTimestamp >= weatherDataArray[0].timestamp && sunsetTimestamp <= weatherDataArray[weatherDataArray.length - 1].timestamp;
        console.log(`[PredictionController] 第${i}天 日落时间在数据范围内:`, inRange);

        if (sunsetWeatherData) {
          console.log(`[PredictionController] 找到日落相关天气数据`);

          // 使用增强版或标准预测服务
          let sunsetPrediction;
          // 统一走后端预测，后端失败才 fallback 到前端本地计算
          sunsetPrediction = await this._calculatePredictionWithBackend(
            sunsetWeatherData,
            sunsetTime,   // 用实际日落时刻，后端才能正确计算太阳高度角
            location.lat,
            location.lon,
            'sunset',
            weatherDataArray
          );
          console.log(`[PredictionController] 晚霞预测完成，得分: ${sunsetPrediction.score}`);

          // 标记为晚霞预测
          sunsetPrediction.type = 'sunset';
          sunsetPrediction.typeName = '晚霞';
          sunsetPrediction.date = targetDate;
          sunsetPrediction.location = location.name;
          sunsetPrediction.temperature = sunsetWeatherData.temp;
          sunsetPrediction.humidity = sunsetWeatherData.humidity;
          sunsetPrediction.cloudCover = sunsetWeatherData.cloudCover;
          sunsetPrediction.windSpeed = sunsetWeatherData.windSpeed;
          sunsetPrediction.pressure = sunsetWeatherData.pressure;
          sunsetPrediction.visibility = sunsetWeatherData.visibility;
          sunsetPrediction.precipitation = sunsetWeatherData.precipitation ?? 0;
          sunsetPrediction.weatherCode = sunsetWeatherData.weatherCode ?? sunsetWeatherData.weathercode ?? null;
          sunsetPrediction.sunsetTime = sunsetTime; // 用于显示日落时间
          sunsetPrediction.timezone = sunsetWeatherData.timezone || targetTimezone;

          // 为增强版预测添加最佳观看窗口方法和factors属性
          if (this.useEnhancedModel) {
            this._ensureAzimuthCompatibility(sunsetPrediction, sunsetTime, targetDate, location.lat, location.lon);

            if (!sunsetPrediction.getOptimalViewingWindow) {
              sunsetPrediction.getOptimalViewingWindow = () => {
                if (!sunsetTime) return { start: null, end: null, description: '日落时间未知' };
                return {
                  start: new Date(sunsetTime.getTime() - 30 * 60 * 1000),
                  end: new Date(sunsetTime.getTime() + 30 * 60 * 1000),
                  description: '日落前后30分钟是观看晚霞的最佳时间'
                };
              };
            }

            // 为增强版预测添加factors属性以兼容旧的渲染逻辑
            if (!sunsetPrediction.factors) {
              sunsetPrediction.factors = {
                cloudCover: { value: sunsetWeatherData.cloudCover, name: '云量', unit: '%' },
                humidity: { value: sunsetWeatherData.humidity, name: '湿度', unit: '%' },
                visibility: { value: sunsetWeatherData.visibility, name: '能见度', unit: 'km' },
                windSpeed: { value: sunsetWeatherData.windSpeed, name: '风速', unit: 'km/h' },
                pressure: { value: sunsetWeatherData.pressure, name: '气压', unit: 'hPa' },
                lowClouds: { value: sunsetWeatherData.lowClouds, name: '低云量', unit: '%' },
                midClouds: { value: sunsetWeatherData.midClouds, name: '中云量', unit: '%' },
                highClouds: { value: sunsetWeatherData.highClouds, name: '高云量', unit: '%' },
                precipitation: { value: sunsetWeatherData.precipitation ?? 0, name: '降水', unit: 'mm/h' },
                weatherCode: { value: sunsetWeatherData.weatherCode ?? sunsetWeatherData.weathercode ?? null, name: '天气', unit: '' }
              };
            }

            // 为增强版预测添加cloudLayers属性以显示云层分层信息
            if (!sunsetPrediction.cloudLayers) {
              const highClouds = sunsetWeatherData.highClouds ?? 0;
              const midClouds = sunsetWeatherData.midClouds ?? 0;
              const lowClouds = sunsetWeatherData.lowClouds ?? 0;

              sunsetPrediction.cloudLayers = {
                high: highClouds,
                mid: midClouds,
                low: lowClouds,
                description: sunsetPrediction.canvasAnalysis ?
                  `高云${highClouds.toFixed(0)}% 中云${midClouds.toFixed(0)}% 低云${lowClouds.toFixed(0)}%` :
                  ''
              };
            }
          }

          predictions.push(sunsetPrediction);
        }

      } catch (error) {
        console.error(`[PredictionController] 处理第 ${i} 天时出错:`, error);
        predictionErrors.push(error);
      }
    }

    console.log(`[PredictionController] 生成了 ${predictions.length} 个预测`);
    if (predictions.length === 0 && predictionErrors.some(error => this._isPredictionRequestTimeout(error))) {
      const firstError = predictionErrors[0];
      const error = new Error(`朝晚霞预测读取失败：${firstError.message || '后端预测服务暂时不可用'}`);
      error.code = firstError.code || null;
      throw error;
    }
    this.predictions = predictions;
    return predictions;
  }

  /**
   * 更新预测显示
   * 
   * @param {Array} predictions - 预测结果数组
   */
  updatePredictionDisplay(predictions) {
    if (!predictions || predictions.length === 0) {
      console.warn('[PredictionController] 没有预测数据可显示');
      return;
    }

    console.log('[PredictionController] 更新预测显示:', predictions);

    // 存储预测数据供详情展开使用
    this.predictions = predictions;

    // 计算今天的日期
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 找到今天的朝霞和晚霞预测
    let todaySunrise = predictions.find(p =>
      p.type === 'sunrise' && p.date && p.date.toDateString() === today.toDateString()
    );
    let todaySunset = predictions.find(p =>
      p.type === 'sunset' && p.date && p.date.toDateString() === today.toDateString()
    );

    console.log('[PredictionController] 今日朝霞预测:', todaySunrise ? '找到' : '未找到');
    console.log('[PredictionController] 今日晚霞预测:', todaySunset ? '找到' : '未找到');

    // 计算今日的日出日落时间用于判断"时间已过"
    let sunriseTime = null;
    let sunsetTime = null;
    let displaySunrise = todaySunrise;
    let displaySunset = todaySunset;
    let displayDate = today;

    // 从预测对象中获取日出日落时间
    if (todaySunrise && todaySunrise.sunriseTime) {
      sunriseTime = todaySunrise.sunriseTime;
    }
    if (todaySunset && todaySunset.sunsetTime) {
      sunsetTime = todaySunset.sunsetTime;
    }

    // 检查时间是否已过，智能切换到明天的预测
    const now = new Date();

    // 查找明天的预测备用
    const tomorrowSunrise = predictions.find(p =>
      p.type === 'sunrise' && p.date && p.date.toDateString() === tomorrow.toDateString()
    );
    const tomorrowSunset = predictions.find(p =>
      p.type === 'sunset' && p.date && p.date.toDateString() === tomorrow.toDateString()
    );

    // 先保存原始时间用于时段判断，然后再做预测替换
    const originalSunriseTime = sunriseTime;
    const originalSunsetTime = sunsetTime;

    // 朝霞时间检查 - 独立判断
    if (sunriseTime && todaySunrise) {
      const sunriseEndTime = new Date(sunriseTime.getTime() + EVENT_PASSED_BUFFER_MS);
      if (now > sunriseEndTime) {
        console.log('[PredictionController] 今日朝霞时间已过，切换到明天的朝霞预测');
        displaySunrise = tomorrowSunrise;
        sunriseTime = tomorrowSunrise ? tomorrowSunrise.sunriseTime : null;
      }
    }

    // 晚霞时间检查 - 独立判断
    if (sunsetTime && todaySunset) {
      const sunsetEndTime = new Date(sunsetTime.getTime() + EVENT_PASSED_BUFFER_MS);
      if (now > sunsetEndTime) {
        console.log('[PredictionController] 今日晚霞时间已过，切换到明天的晚霞预测');
        displaySunset = tomorrowSunset;
        sunsetTime = tomorrowSunset ? tomorrowSunset.sunsetTime : null;
      }
    }

    // 判断每个预测是今日还是明日的，用于智能标题
    const sunriseIsToday = displaySunrise && displaySunrise.date &&
      displaySunrise.date.toDateString() === today.toDateString();
    const sunsetIsToday = displaySunset && displaySunset.date &&
      displaySunset.date.toDateString() === today.toDateString();

    // 显示预测（传入原始时间用于时段判断，而非已被替换的明天时间）
    this.updateTodayPredictions(
      displaySunrise,
      displaySunset,
      originalSunriseTime,
      originalSunsetTime,
      displayDate,
      { sunriseIsToday, sunsetIsToday }
    );

    // 显示未来预测时间线
    this.updateForecastTimeline(predictions);

    // 需求12.8：检查预测并发送通知
    this.notificationService.checkPredictionAndNotify(predictions);
  }

  /**
   * 更新今日预测显示（朝霞和晚霞）
   * @param {Object} sunrisePrediction - 朝霞预测数据
   * @param {Object} sunsetPrediction - 晚霞预测数据
   * @param {Date} sunriseTime - 日出时间
   * @param {Date} sunsetTime - 日落时间
   * @param {Date} displayDate - 显示的日期
   * @param {Object} dateInfo - 日期信息 { sunriseIsToday, sunsetIsToday }
   * @private
   */
  /**
   * 根据当前时间判断手机版默认显示的卡片
   * 逻辑：
   * - 日出之前（0:00-日出）→ 显示今日朝霞 + 今日晚霞（默认朝霞）
   * - 中午（12:00-日落前）→ 显示今日晚霞 + 明日朝霞（默认晚霞）
   * - 日落后30分钟 → 显示明日朝霞 + 明日晚霞（默认明日朝霞）
   * @param {Date|null} sunriseTime - 日出时间
   * @param {Date|null} sunsetTime - 日落时间
   * @param {Object|null} sunrisePrediction - 朝霞预测
   * @param {Object|null} sunsetPrediction - 晚霞预测
   * @param {Object|null} tomorrowSunrisePrediction - 明日朝霞预测
   * @param {Object|null} tomorrowSunsetPrediction - 明日晚霞预测
   * @returns {{activeTab: 'sunrise'|'sunset', sunrisePred: Object|null, sunsetPred: Object|null, sunriseLabel: string, sunsetLabel: string}}
   */
  _getDefaultMobileTab(sunriseTime, sunsetTime, sunrisePrediction, sunsetPrediction, tomorrowSunrisePrediction = null, tomorrowSunsetPrediction = null) {
    const now = new Date();
    const hour = now.getHours();

    // 判断当前时段
    const isBeforeSunrise = sunriseTime && now < sunriseTime;
    const isAfterSunset = sunsetTime && now > new Date(sunsetTime.getTime() + EVENT_PASSED_BUFFER_MS);

    // 日落后：显示明日朝霞 + 明日晚霞
    if (isAfterSunset) {
      return {
        activeTab: 'sunrise',
        sunrisePred: tomorrowSunrisePrediction,
        sunsetPred: tomorrowSunsetPrediction,
        sunriseLabel: this.i18n.t('date.tomorrow'),
        sunsetLabel: this.i18n.t('date.tomorrow')
      };
    }

    // 日出之前：显示今日朝霞 + 今日晚霞
    if (isBeforeSunrise) {
      return {
        activeTab: 'sunrise',
        sunrisePred: sunrisePrediction,
        sunsetPred: sunsetPrediction,
        sunriseLabel: this.i18n.t('date.today'),
        sunsetLabel: this.i18n.t('date.today')
      };
    }

    // 中午（日出后~日落前）：显示今日晚霞 + 明日朝霞
    return {
      activeTab: 'sunset',
      sunrisePred: tomorrowSunrisePrediction,
      sunsetPred: sunsetPrediction,
      sunriseLabel: this.i18n.t('date.tomorrow'),
      sunsetLabel: this.i18n.t('date.today')
    };
  }

  updateTodayPredictions(sunrisePrediction, sunsetPrediction, sunriseTime, sunsetTime, displayDate = new Date(), dateInfo = null) {
    const predictionSection = document.getElementById('prediction-section');
    const predictionDisplay = document.getElementById('prediction-display');
    const sectionTitle = document.getElementById('prediction-section-title');

    if (!predictionDisplay) {
      console.error('未找到预测显示元素');
      return;
    }

    // 生成智能标题
    let title = this.i18n.t('prediction.sunriseAndSunset');

    if (sectionTitle) {
      sectionTitle.textContent = title;
    }

    // 用于错误提示的日期标签
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isToday = displayDate.toDateString() === today.toDateString();
    const dateLabel = isToday ? this.i18n.t('date.today') : this.i18n.t('date.tomorrow');

    // 查找明天的预测
    const tomorrowSunrise = this.predictions.find(p =>
      p.type === 'sunrise' && p.date && p.date.toDateString() === tomorrow.toDateString()
    );
    const tomorrowSunset = this.predictions.find(p =>
      p.type === 'sunset' && p.date && p.date.toDateString() === tomorrow.toDateString()
    );

    // 根据当前时段获取默认显示配置
    const displayConfig = this._getDefaultMobileTab(
      sunriseTime,
      sunsetTime,
      sunrisePrediction,
      sunsetPrediction,
      tomorrowSunrise,
      tomorrowSunset
    );

    // 使用配置中的预测数据
    const displaySunrise = displayConfig.sunrisePred;
    const displaySunset = displayConfig.sunsetPred;
    const sunriseDateLabel = displayConfig.sunriseLabel;
    const sunsetDateLabel = displayConfig.sunsetLabel;

    // 如果两个预测都缺失，显示错误提示
    if (!displaySunrise && !displaySunset) {
      predictionDisplay.innerHTML = `
        <div class="prediction-unavailable">
          <p>${this.i18n.t('prediction.noPredictionData', { date: dateLabel })}</p>
          <p class="hint-text">${this.i18n.t('prediction.insufficientData')}</p>
        </div>
      `;
      if (predictionSection) {
        predictionSection.classList.remove('hidden');
      }
      console.warn(`[PredictionController] ${dateLabel}朝霞和晚霞预测均不可用`);
      return;
    }

    // 生成朝霞卡片 HTML
    const sunriseIcon = this.renderSunEventIcon('sunrise', 'sun-event-icon inline-sun-event-icon');
    const sunsetIcon = this.renderSunEventIcon('sunset', 'sun-event-icon inline-sun-event-icon');

    const sunriseCardHtml = displaySunrise
      ? this.renderSinglePrediction(displaySunrise, 'sunrise', this.i18n.t('prediction.sunrise'), this.i18n.t('prediction.sunriseTime'), sunriseDateLabel, 'sunrise')
      : `<div class="prediction-unavailable-card">
          <span class="prediction-date-badge">${sunriseDateLabel}</span>
          <h3>${sunriseIcon} ${this.i18n.t('prediction.sunrise')}</h3>
          <p class="unavailable-reason">${this.i18n.t('prediction.predictionUnavailable')}</p>
          <p class="hint-text">${this.i18n.t('prediction.viewFutureOrRefresh')}</p>
        </div>`;

    // 生成晚霞卡片 HTML
    const sunsetCardHtml = displaySunset
      ? this.renderSinglePrediction(displaySunset, 'sunset', this.i18n.t('prediction.sunset'), this.i18n.t('prediction.sunsetTime'), sunsetDateLabel, 'sunset')
      : `<div class="prediction-unavailable-card">
          <span class="prediction-date-badge">${sunsetDateLabel}</span>
          <h3>${sunsetIcon} ${this.i18n.t('prediction.sunset')}</h3>
          <p class="unavailable-reason">${this.i18n.t('prediction.predictionUnavailable')}</p>
          <p class="hint-text">${this.i18n.t('prediction.viewFutureOrRefresh')}</p>
        </div>`;

    // 手机版默认显示哪个
    const defaultTab = displayConfig.activeTab;

    // 渲染带切换开关的布局
    const html = `
      <div class="prediction-toggle-bar xiake-toggle" id="prediction-toggle-bar" data-toggle-template="segmented">
        <button class="prediction-toggle-btn xiake-toggle-btn${defaultTab === 'sunrise' ? ' active' : ''}" data-tab="sunrise">
          ${this.i18n.t('prediction.sunrise')}
        </button>
        <button class="prediction-toggle-btn xiake-toggle-btn${defaultTab === 'sunset' ? ' active' : ''}" data-tab="sunset">
          ${this.i18n.t('prediction.sunset')}
        </button>
      </div>
      <div class="today-predictions-container" id="today-predictions-container">
        <div class="prediction-tab-panel" data-panel="sunrise"${defaultTab !== 'sunrise' ? ' style="display:none"' : ''}>
          ${sunriseCardHtml}
        </div>
        <div class="prediction-tab-panel" data-panel="sunset"${defaultTab !== 'sunset' ? ' style="display:none"' : ''}>
          ${sunsetCardHtml}
        </div>
      </div>
    `;

    predictionDisplay.innerHTML = html;

    // 绑定切换按钮事件
    const toggleBar = predictionDisplay.querySelector('#prediction-toggle-bar');
    if (toggleBar) {
      toggleBar.addEventListener('click', (e) => {
        const btn = e.target.closest('.prediction-toggle-btn');
        if (!btn) return;
        const tab = btn.dataset.tab;

        // 更新按钮状态
        toggleBar.querySelectorAll('.prediction-toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // 切换面板
        predictionDisplay.querySelectorAll('.prediction-tab-panel').forEach(panel => {
          panel.style.display = panel.dataset.panel === tab ? '' : 'none';
        });
      });
    }

    // 绑定分享按钮事件 — 改为下拉菜单交互（与 home-view-menu 一致）
    const shareMenus = predictionDisplay.querySelectorAll('.prediction-share-menu');
    shareMenus.forEach(menu => {
      const btn = menu.querySelector('.prediction-share-btn');
      const dropdown = menu.querySelector('.prediction-share-dropdown');
      if (!btn || !dropdown) return;

      const type = btn.dataset.type;
      const prediction = type === 'sunrise' ? displaySunrise : displaySunset;

      const closeMenu = () => {
        dropdown.classList.add('hidden');
        btn.setAttribute('aria-expanded', 'false');
      };

      const openMenu = () => {
        // 关闭其他已打开的分享菜单
        predictionDisplay.querySelectorAll('.prediction-share-dropdown').forEach(d => d.classList.add('hidden'));
        predictionDisplay.querySelectorAll('.prediction-share-btn').forEach(b => b.setAttribute('aria-expanded', 'false'));

        // 检查原生分享支持
        const nativeOption = dropdown.querySelector('[data-action="native"]');
        if (nativeOption) {
          if (navigator.share) {
            nativeOption.classList.remove('hidden');
          } else {
            nativeOption.classList.add('hidden');
          }
        }

        dropdown.classList.remove('hidden');
        btn.setAttribute('aria-expanded', 'true');
      };

      // 点击按钮切换菜单
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = dropdown.classList.contains('hidden');
        if (isHidden) {
          getSharePanel().currentPrediction = prediction;
          openMenu();
        } else {
          closeMenu();
        }
      });

      // 菜单项点击
      dropdown.querySelectorAll('[data-action]').forEach(option => {
        option.addEventListener('click', (e) => {
          e.stopPropagation();
          const action = option.dataset.action;
          getSharePanel().currentPrediction = prediction;
          if (action === 'save') getSharePanel().handleSaveImage();
          else if (action === 'copy') getSharePanel().handleCopyLink();
          else if (action === 'native') getSharePanel().handleNativeShare();
          closeMenu();
        });
      });

      // 点击外部关闭
      document.addEventListener('click', (event) => {
        if (!menu.contains(event.target)) {
          closeMenu();
        }
      });

      // Escape 关闭
      btn.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          closeMenu();
        }
      });
    });

    predictionDisplay.querySelectorAll('.prediction-feedback-btn').forEach((btn) => {
      const type = btn.dataset.type;
      const prediction = type === 'sunrise' ? displaySunrise : displaySunset;
      btn.addEventListener('click', () => {
        window.feedbackController?.openPredictionFeedback?.(prediction, type);
      });
    });

    const closestElement = (target, selector) => {
      if (!target) return null;
      if (typeof target.closest === 'function') {
        return target.closest(selector);
      }

      // 兼容部分微信/WebView 内核：SVGElement 可能没有 closest()
      let node = target.nodeType === Node.ELEMENT_NODE ? target : target.parentElement;
      while (node) {
        if (typeof node.matches === 'function' && node.matches(selector)) {
          return node;
        }
        node = node.parentElement || node.parentNode;
      }
      return null;
    };

    if (!document.__scoreBreakdownDelegateBound) {
      document.__scoreBreakdownDelegateBound = true;

      const closeAllScoreBreakdowns = () => {
        document.querySelectorAll('.score-breakdown-popover').forEach(pop => {
          pop.hidden = true;
        });
        document.querySelectorAll('.score-breakdown-trigger').forEach(trigger => {
          trigger.setAttribute('aria-expanded', 'false');
        });
      };

      document.addEventListener('click', (e) => {
        if (
          closestElement(e.target, '.score-breakdown-popover') &&
          closestElement(e.target, '.score-ledger-detail')
        ) {
          e.stopPropagation();
          return;
        }

        const trigger = closestElement(e.target, '.score-breakdown-trigger');
        if (!trigger) {
          if (!closestElement(e.target, '.score-breakdown-popover')) {
            closeAllScoreBreakdowns();
          }
          return;
        }
        e.stopPropagation();

        const pop = trigger.querySelector('.score-breakdown-popover');
        if (!pop) return;

        const willOpen = pop.hidden;
        closeAllScoreBreakdowns();
        pop.hidden = !willOpen;
        trigger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      }, true);

      document.addEventListener('keydown', (e) => {
        const trigger = closestElement(e.target, '.score-breakdown-trigger');
        if (!trigger) return;
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        trigger.click();
      }, true);
    }

    // 显示预测部分
    if (predictionSection) {
      predictionSection.classList.remove('hidden');
    }

    this.schedulePairedPredictionCardAlignment(predictionDisplay);

    console.log(`[PredictionController] ${dateLabel}预测已更新，手机版默认显示: ${defaultTab}`);
  }

  /**
   * 渲染单个预测卡片
   * @param {Object} prediction - 预测数据
   * @param {string} icon - 图标
   * @param {string} title - 标题
   * @param {string} timeLabel - 时间标签
   * @returns {string} HTML字符串
   * @private
   */
  renderSunEventIcon(type = 'sunset', className = 'sun-event-icon') {
    const isSunrise = type === 'sunrise';
    const arrow = isSunrise
      ? '<path class="sun-event-arrow" d="M30 20V7m0 0-4 4m4-4 4 4"/>'
      : '<path class="sun-event-arrow" d="M30 6v13m0 0-4-4m4 4 4-4"/>';
    const label = isSunrise ? this.i18n.t('prediction.sunrise') : this.i18n.t('prediction.sunset');
    return `
      <svg class="${className} sun-event-icon-${isSunrise ? 'sunrise' : 'sunset'}" viewBox="0 0 40 32" role="img" aria-label="${label}">
        <path class="sun-event-horizon" d="M4 22h20"/>
        <path class="sun-event-sun" d="M7 22a7 7 0 0 1 14 0"/>
        ${arrow}
      </svg>
    `;
  }

  renderSinglePrediction(prediction, icon, title, timeLabel, dateLabel = '今日', type = 'sunset') {
    const targetTimezone = prediction.timezone || null;
    const eventIcon = this.renderSunEventIcon(type, 'sun-event-icon phenomenon-sun-event-icon');
    const forecast = this.buildForecastViewModel(prediction, eventIcon, title, timeLabel, dateLabel, type, targetTimezone);
    const qualityClass = this.getQualityClass(prediction.quality);
    const scoreBreakdownHtml = this.renderScoreBreakdownPopover(prediction);

    // 分享按钮 SVG 图标
    const shareIconSvg = `
      <svg class="share-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
        <polyline points="16 6 12 2 8 6"/>
        <line x1="12" y1="2" x2="12" y2="15"/>
      </svg>
    `;

    const saveLabel = this.i18n.t('share.saveImage');
    const copyLabel = this.i18n.t('share.copyLink');
    const nativeLabel = this.i18n.t('share.nativeShare');
    const sharePanelLabel = this.i18n.t('share.panelTitle');

    return `
      <div class="prediction-card prediction-app-card ${qualityClass}" data-type="${type}">
        <div class="prediction-app-shell">
          <div class="phenomenon-title-card">
            <div class="phenomenon-icon-tile" aria-hidden="true">${forecast.icon}</div>
            <div class="phenomenon-title-copy">
              <span class="phenomenon-date-tag">${dateLabel}</span>
              <h3>${forecast.type}</h3>
            </div>
          </div>

          ${this.renderConclusionBanner(forecast.conclusion)}

          <div class="score-summary-card">
            <div class="score-summary-left score-breakdown-trigger" role="button" tabindex="0" aria-expanded="false" aria-label="${this.i18n.t('prediction.composite.finalScore')}">
              ${this.renderLargeScoreGauge(forecast, type)}
              ${scoreBreakdownHtml}
            </div>
            <div class="score-summary-divider" aria-hidden="true"></div>
            <div class="score-summary-right">
              <div class="event-time-label">${forecast.timeLabel}</div>
              <div class="main-time app-main-time">${forecast.mainTime}</div>
              ${this.renderInfoRow('⏱️', this.i18n.t('prediction.bestViewingTime'), forecast.bestViewingTime)}
              ${forecast.direction ? this.renderInfoRow('🧭', forecast.directionLabel, this.renderDirectionValue(forecast.direction, forecast.azimuth), 'app-info-row-direction') : ''}
            </div>
          </div>

          ${this.renderCloudConditionCard(forecast.clouds)}
          ${this.renderAnalysisCard(forecast.analysis, forecast.conclusion)}
          <div id="radar-compass-${type}" style="margin-top:12px;display:none;"></div>
          <div class="prediction-app-nav prediction-app-nav-compact prediction-share-footer-row" aria-label="${forecast.type} ${sharePanelLabel}">
            <div class="prediction-share-menu prediction-share-footer" data-share-type="${type}">
              <button class="prediction-share-btn prediction-nav-share" data-type="${type}" aria-label="${this.i18n.t('share.title')}" aria-expanded="false">
                ${shareIconSvg}
                <span class="share-btn-label">${sharePanelLabel}</span>
              </button>
              <div class="prediction-share-dropdown hidden" role="menu" aria-label="${this.i18n.t('share.title')}">
                <button class="share-option" role="menuitem" data-action="save">
                  <svg class="share-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  <span>${saveLabel}</span>
                </button>
                <button class="share-option" role="menuitem" data-action="copy">
                  <svg class="share-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                  <span>${copyLabel}</span>
                </button>
                <button class="share-option share-option-native hidden" role="menuitem" data-action="native">
                  <svg class="share-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="18" cy="5" r="3"/>
                    <circle cx="6" cy="12" r="3"/>
                    <circle cx="18" cy="19" r="3"/>
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                  </svg>
                  <span>${nativeLabel}</span>
                </button>
              </div>
            </div>
            <button class="prediction-feedback-btn prediction-nav-share prediction-nav-feedback" data-type="${type}" type="button" aria-label="${this.i18n.t('feedback.button', '反馈')}">
              <svg class="share-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/>
                <path d="M8 9h8M8 13h5"/>
              </svg>
              <span class="share-btn-label">${this.i18n.t('feedback.button', '反馈')}</span>
            </button>
          </div>
          <div class="prediction-app-footer">${this._uiText('Observe the sky · Catch the beauty', '观天有时 · 收获美景')}</div>
        </div>
      </div>
    `;
  }

  buildForecastViewModel(prediction, icon, title, timeLabel, dateLabel, type, targetTimezone) {
    const viewingWindow = prediction.getOptimalViewingWindow();
    const direction = this.getPredictionDirectionText(prediction, type);
    const clouds = prediction.cloudLayers || {
      high: prediction.factors?.highClouds?.value ?? prediction.highClouds ?? 0,
      mid: prediction.factors?.midClouds?.value ?? prediction.midClouds ?? 0,
      low: prediction.factors?.lowClouds?.value ?? prediction.lowClouds ?? 0
    };
    const score = Number(prediction.score || 0);
    const scoreLabel = this.getQualityLabel(prediction.quality);

    return {
      dateLabel,
      icon,
      type: title,
      timeLabel,
      score,
      scoreLabel,
      scoreDesc: this.getScoreDescription(score, prediction),
      mainTime: this.formatTime(type === 'sunrise' ? (prediction.sunriseTime || prediction.sunsetTime) : prediction.sunsetTime, targetTimezone),
      bestViewingTime: `${this.formatTime(viewingWindow.start, targetTimezone)}–${this.formatTime(viewingWindow.end, targetTimezone)}`,
      direction,
      azimuth: prediction.sunAzimuth,
      directionLabel: type === 'sunrise' ? this.i18n.t('prediction.sunriseDirectionLabel') : this.i18n.t('prediction.sunsetDirectionLabel'),
      clouds: [
        { label: this._uiText('High', '高云'), value: Number(clouds.high ?? 0), color: 'var(--cloud-high-color)' },
        { label: this._uiText('Mid', '中云'), value: Number(clouds.mid ?? 0), color: 'var(--cloud-mid-color)' },
        { label: this._uiText('Low', '低云'), value: Number(clouds.low ?? 0), color: 'var(--cloud-low-color)' }
      ],
      quality: this.getQualityFromScore(score),
      analysis: this.buildAnalysisGroups(prediction),
      conclusion: this.buildAnalysisConclusion(prediction, score, clouds)
    };
  }

  getPredictionDirectionText(prediction, type) {
    const shouldShowAzimuth = prediction.shouldShowAzimuth
      ? prediction.shouldShowAzimuth()
      : prediction.sunAzimuth !== null && prediction.sunAzimuth !== undefined;
    if (!shouldShowAzimuth) return '';
    const direction = this.getLocalizedAzimuthDirection(prediction);
    return direction || '';
  }

  _isEnglishUI() {
    const lang = this.i18n?.getCurrentLanguage ? this.i18n.getCurrentLanguage() : this.i18n?.currentLanguage;
    return String(lang || '').toLowerCase().startsWith('en');
  }

  _uiText(en, zh) {
    return this._isEnglishUI() ? en : zh;
  }

  _translateOrFallback(key, fallback, params = {}) {
    const translated = this.i18n?.t?.(key, params);
    return translated && translated !== key ? translated : fallback;
  }

  _analysisText(key, params = {}) {
    const fullKey = `prediction.formationAnalysis.${key}`;
    const translated = this.i18n.t(fullKey, params);
    if (translated !== fullKey) return translated;

    const fallback = {
      'title': '火烧云文字分析',
      'groups.positive': '有利条件', 'groups.neutral': '一般因素', 'groups.warning': '注意因素',
      'factors.carrier.title': '云层载体',
      'factors.carrier.status.good': '较好', 'factors.carrier.status.fair': '一般', 'factors.carrier.status.weak': '较弱',
      'factors.carrier.desc.good': '中高云提供可染色云面，具备承接霞光的基础。',
      'factors.carrier.desc.fair': '有可染色云面，但面积、高度或稳定性不够理想。',
      'factors.carrier.desc.weak': '可染色云面不足，难形成成片火烧云。',
      'factors.lightPath.title': '光路条件',
      'factors.lightPath.status.good': '较好', 'factors.lightPath.status.fair': '一般', 'factors.lightPath.status.weak': '较弱',
      'factors.lightPath.desc.good': '太阳方向相对通透，光线有机会照到云底。',
      'factors.lightPath.desc.fair': '太阳方向有一定遮挡，晚霞可能只出现在局部。',
      'factors.lightPath.desc.weak': '低云或阻挡走廊挡住光路，光线不容易打到云层。',
      'factors.brightness.title': '受光亮度',
      'factors.brightness.status.good': '充足', 'factors.brightness.status.fair': '一般', 'factors.brightness.status.weak': '偏弱',
      'factors.brightness.desc.good': '可显色云层有足够受光证据，颜色更容易出来。',
      'factors.brightness.desc.fair': '云层存在但亮度一般，可能只出现局部或偏淡色彩。',
      'factors.brightness.desc.weak': '云量虽然够，但直射弱、水汽或灰幕证据会压低真实亮度。',
      'factors.rendering.title': '空气显色',
      'factors.rendering.status.good': '较好', 'factors.rendering.status.fair': '一般', 'factors.rendering.status.weak': '较弱',
      'factors.rendering.desc.good': '空气里有适度颗粒和水汽，颜色更容易偏暖、偏红。',
      'factors.rendering.desc.fair': '空气条件普通，颜色表现主要看云层和光路。',
      'factors.rendering.desc.weak': '空气偏灰或颗粒过重，满铺云幕容易把颜色压暗、压淡。',
      'factors.limits.title': '限制因素',
      'factors.limits.status.good': '无明显', 'factors.limits.status.fair': '轻微', 'factors.limits.status.weak': '明显',
      'factors.limits.desc.good': '没有明显压制条件。',
      'factors.limits.desc.fair': '有轻微不利因素，可能压低持续时间或颜色强度。',
      'factors.limits.desc.weak': '降水、厚云、低云遮挡或灰幕明显，会压低整体表现。',
      'high.abundant': '高层云充沛（{{value}}%）', 'high.abundantDesc': '色彩载体丰富，火烧云基础扎实',
      'high.sufficient': '高层云充足（{{value}}%）', 'high.sufficientDesc': '具备较好的霞光染色载体',
      'high.moderate': '高层云适中（{{value}}%）', 'high.moderateDesc': '可形成火烧云，但色彩可能偏淡',
      'high.few': '高层云偏少（{{value}}%）', 'high.fewDesc': '缺少主要色彩载体',
      'mid.balanced': '中层云适中（{{value}}%）', 'mid.balancedDesc': '利于色彩扩散和层次感',
      'mid.few': '中层云较少（{{value}}%）', 'mid.fewHighCloudDesc': '但高层云充足，可独立形成火烧云', 'mid.fewDesc': '层次感可能不足',
      'mid.thick': '中层云偏厚（{{value}}%）', 'mid.thickDesc': '可能让画面偏灰，削弱霞光通透感',
      'low.few': '低云稀少（{{value}}%）', 'low.fewDesc': '不会遮挡火烧云',
      'low.some': '低云较多（{{value}}%）', 'low.someDesc': '可能部分遮挡低空色彩',
      'low.thick': '低云偏厚（{{value}}%）', 'low.thickDesc': '遮挡风险较大',
      'visibility.good': '能见度良好（{{value}}km）', 'visibility.goodDesc': '空气通透，观赏视野好',
      'visibility.moderate': '能见度一般（{{value}}km）', 'visibility.moderateDesc': '色彩饱和度可能略受影响',
      'visibility.low': '能见度偏低（{{value}}km）', 'visibility.lowDesc': '雾霾或水汽可能影响观赏',
      'humidity.moderate': '湿度适中（{{value}}%）', 'humidity.moderateDesc': '利于光线散射',
      'humidity.high': '湿度偏高（{{value}}%）', 'humidity.highDesc': '可能略影响通透感',
      'humidity.low': '湿度偏低（{{value}}%）', 'humidity.lowDesc': '空气较干，色彩可能偏淡',
      'aerosol.moderate': '气溶胶适中（AOD {{value}}）', 'aerosol.moderateDesc': '有利于增强红橙色散射',
      'aerosol.high': '气溶胶偏高（AOD {{value}}）', 'aerosol.highDesc': '可能灰霾发暗',
      'aerosol.low': '空气过于通透（AOD {{value}}）', 'aerosol.lowDesc': '颜色可能偏淡',
      'aerosol.extremeHaze': '沙尘/灰幕很重', 'aerosol.extremeHazeDesc': '高云虽多，但空气光学条件失效，霞光容易被压成灰黄色',
      'aerosol.hazeCap': '灰幕风险明显', 'aerosol.hazeCapDesc': '颗粒物或气溶胶偏高，会削弱红橙色染色',
      'aerosol.carrier': '薄雾红日载体', 'aerosol.carrierDesc': '云层很少时，适度气溶胶在光路通畅时也能带来一点暖色日落',
      'brightness.weak': '云层亮度偏弱', 'brightness.weakDesc': '系统看到云量和光路，但水汽、AOD、漫射光或厚高云证据显示这层云未必能被充分照亮',
      'brightness.good': '云层受光较好', 'brightness.goodDesc': '载体、光路和空气条件共同支持中高云被照亮',
      'lightPath.opening': '太阳方向有透光开口', 'lightPath.openingDesc': '后端沿太阳方位采样 10/25/50/75/100km，低中云走廊较通畅，光线更容易打到云层',
      'lightPath.wall': '太阳方向有阻挡走廊', 'lightPath.wallDesc': '太阳方位周边低/中云整体偏厚，光路门控会压低主评分',
      'lightPath.lowCloudBlock': '低云遮住光线', 'lightPath.lowCloudBlockDesc': '低云挡在太阳方向，阳光不容易照到中高云',
      'postRain.clear': '雨后空气清透', 'postRain.clearDesc': '近6小时有降水，但能见度和颗粒物条件较好，雨后加成保留',
      'postRain.gray': '雨后灰幕风险', 'postRain.grayDesc': '降水后水汽或颗粒物偏重，霞光容易发灰',
      'carrier.strong': '高云载体清晰', 'carrier.strongDesc': '高云充足、低云稀少且空气较通透，具备中高分基础',
      'carrier.dense': '中高云载体明确', 'carrier.denseDesc': '高云和中云共同提供画布，色彩载体更稳定',
      'layer.single': '云层单一', 'layer.singleDesc': '高云质量好，仍可形成鲜明火烧云'
    }[key] || fullKey;

    return fallback.replace(/\{\{(\w+)\}\}/g, (match, paramKey) => (params[paramKey] !== undefined ? params[paramKey] : match));
  }

  getScoreDescription(score, prediction = null) {
    if (prediction?.advice === 'casual_viewing_ok') {
      return this._translateOrFallback('prediction.status.casualViewingOk', this._uiText('Worth a casual look', '可以出门看看'));
    }
    if (score >= 80) return this._uiText('Excellent viewing conditions', '观赏条件很好');
    if (score >= 60) return this._uiText('Good viewing conditions', '观赏条件不错');
    if (score >= 40) return this._uiText('Some chance', '有一定机会');
    return this._uiText('Weak viewing conditions', '观赏条件偏弱');
  }

  getQualityFromScore(score) {
    if (score >= 85) return 'excellent';
    if (score >= 70) return 'good';
    if (score >= 40) return 'fair';
    return 'poor';
  }

  getScoreTheme(quality, score) {
    const value = Math.max(0, Math.min(100, Number(score) || 0));
    if (value >= 85) {
      return [
        'var(--score-excellent-start, #fb923c)',
        'var(--score-excellent-mid, #fbbf24)',
        'var(--score-excellent-end, #f43f5e)'
      ];
    }

    // Visual color turns warmer slightly before the semantic "good" label.
    // A 65-69 watchable sunset should look like a promising glow, not a muted low score.
    const stops = [
      { max: 40, color: 'var(--score-poor-color, #94a3b8)' },
      { max: 65, color: 'var(--score-fair-color, #fdba74)' },
      { max: 85, color: 'var(--score-good-color, #fb923c)' }
    ];
    const color = stops.find(stop => value < stop.max)?.color || 'var(--score-excellent-mid, #fbbf24)';
    return [color, color, color];
  }

  renderLargeScoreGauge(forecast, type) {
    const radius = 68;
    const circumference = 2 * Math.PI * radius;
    const progress = Math.max(0, Math.min(100, forecast.score));
    const scoreFill = circumference * (progress / 100);
    const scoreGap = circumference - scoreFill;
    const scoreTheme = this.getScoreTheme(forecast.quality, forecast.score);
    return `
      <div class="score-gauge-large-wrap">
        <svg class="score-gauge-large" viewBox="0 0 180 180" width="160" height="160" aria-hidden="true">
          <defs>
            <linearGradient id="app-gauge-grad-${type}-${forecast.quality}" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="${scoreTheme[0]}"/>
              <stop offset="55%" stop-color="${scoreTheme[1]}"/>
              <stop offset="100%" stop-color="${scoreTheme[2]}"/>
            </linearGradient>
          </defs>
          <circle cx="90" cy="90" r="${radius}" fill="none" stroke="var(--score-track-color, rgba(255,255,255,0.14))" stroke-width="12"/>
          <circle cx="90" cy="90" r="${radius}" fill="none" stroke="url(#app-gauge-grad-${type}-${forecast.quality})" stroke-width="12"
            stroke-dasharray="${scoreFill.toFixed(2)} ${scoreGap.toFixed(2)}" stroke-dashoffset="${(circumference * 0.25).toFixed(2)}" stroke-linecap="round"/>
        </svg>
        <div class="score-gauge-center">
          <div><span class="score-gauge-number" style="color:${scoreTheme[1]}">${forecast.score.toFixed(0)}</span><span class="score-gauge-total">/100</span></div>
        </div>
        <div class="score-gauge-caption">
          <div class="score-gauge-grade" style="color:${scoreTheme[1]}">${forecast.scoreLabel}</div>
          <div class="score-gauge-desc">${forecast.scoreDesc}</div>
          <div class="score-breakdown-hint-trigger">${this._translateOrFallback('prediction.scoreBreakdown.viewDetails', '查看评分明细')}</div>
        </div>
      </div>
    `;
  }

  renderInfoRow(icon, label, value, extraClass = '') {
    const cls = extraClass ? ` ${extraClass}` : '';
    return `
      <div class="app-info-row${cls}">
        <span class="app-info-icon" aria-hidden="true">${icon}</span>
        <span class="app-info-label">${label}</span>
        <strong class="app-info-value">${value}</strong>
      </div>
    `;
  }

  renderDirectionValue(direction, azimuth) {
    const angle = Number.isFinite(Number(azimuth)) ? Number(azimuth) : 0;
    return `<span class="azimuth-direction-inline"><span class="azimuth-direction-icon" style="transform: rotate(${angle.toFixed(0)}deg);" aria-hidden="true">↑</span><span>${direction}</span></span>`;
  }

  renderInlineSvgIcon(name, className = '') {
    const icons = {
      highCloud: '<path d="M5.2 13.2h12.4a4.2 4.2 0 0 0 .2-8.4 5.8 5.8 0 0 0-10.9 1.4 3.6 3.6 0 0 0-1.7 7z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M7.4 17.4h8.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" opacity=".45"/>',
      midCloud: '<path d="M4.4 14.1h13.4a4.1 4.1 0 0 0 .1-8.2 5.3 5.3 0 0 0-10.2 1.2 3.8 3.8 0 0 0-3.3 7z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 18h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" opacity=".4"/>',
      lowCloud: '<path d="M4 13.5h13.2a3.8 3.8 0 0 0 .1-7.6A5 5 0 0 0 7.7 7a3.5 3.5 0 0 0-3.7 6.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M5.4 17h13.2M7.2 20h8.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" opacity=".45"/>',
      ok: '<path d="M20 6 9 17l-5-5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
      info: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M12 10.5v5.2M12 7.5h.01" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
      warn: '<path d="M12 3.5 21 19H3L12 3.5z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="M12 9v4.5M12 16.7h.01" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
      leaf: '<path d="M19.5 4.5C11 4.8 5.5 8.8 5 16.8c7.9.4 12.3-4.5 14.5-12.3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M5.5 16.5c3.8-3.8 7-5.7 11.2-7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
      cloud: '<path d="M5.2 14h12.4a4.2 4.2 0 0 0 .2-8.4 5.8 5.8 0 0 0-10.9 1.4 3.6 3.6 0 0 0-1.7 7z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>'
    };
    const body = icons[name] || icons.cloud;
    const cls = className ? ` ${className}` : '';
    return `<svg class="inline-svg-icon${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${body}</svg>`;
  }

  getCloudIconName(label) {
    if (/高|High/i.test(label)) return 'highCloud';
    if (/中|Mid/i.test(label)) return 'midCloud';
    if (/低|Low/i.test(label)) return 'lowCloud';
    return 'cloud';
  }

  renderCloudConditionCard(clouds) {
    const rows = clouds.map(cloud => {
      const value = Math.max(0, Math.min(100, cloud.value));
      return `
        <div class="cloud-condition-item">
          <div class="cloud-condition-top"><span class="cloud-condition-label">${this.renderInlineSvgIcon(this.getCloudIconName(cloud.label), 'cloud-condition-svg')}${cloud.label}</span><strong>${value.toFixed(0)}%</strong></div>
          <div class="cloud-condition-track"><span class="cloud-condition-fill" style="width:${value}%;background:${cloud.color};"></span></div>
        </div>
      `;
    }).join('');
    return `<div class="cloud-condition-card">${rows}</div>`;
  }

  buildAnalysisGroups(prediction) {
    return this.buildAnalysisFactors(prediction);
  }

  buildAnalysisFactors(prediction) {
    const weather = this.extractAnalysisWeather(prediction);
    const thickHighCloudPenalty = prediction?.thickHighCloudPenalty || prediction?.lightPathAnalysis?.thickHighCloudPenalty;
    const cloudThickness = prediction?.cloudThickness || prediction?.lightPathAnalysis?.cloudThickness;
    const denseCarrierCanvasOnly = cloudThickness?.reasons?.includes('dense_upper_cloud_carrier_softened')
      || cloudThickness?.reasons?.includes('opening_upper_cloud_carrier_softened')
      || cloudThickness?.reasons?.includes('directional_high_cloud_carrier_softened')
      || cloudThickness?.reasons?.includes('upper_cloud_direction_opening')
      || cloudThickness?.reasons?.includes('upper_cloud_clear_light_path')
      || thickHighCloudPenalty?.reason === 'dense_upper_cloud_carrier_canvas_only'
      || thickHighCloudPenalty?.reason === 'opening_upper_cloud_carrier_canvas_only'
      || thickHighCloudPenalty?.reason === 'directional_high_cloud_carrier_canvas_only';
    const aerosolHazeCap = prediction?.aerosolHazeCap;
    const carrierAdjustment = prediction?.highCloudCarrierAdjustment;
    const aerosolCarrier = prediction?.aerosolCarrierScore || prediction?.breakdown?.aerosolCarrierScore;
    const postRainAdjustment = prediction?.postRainAdjustment;
    const scoringV2 = prediction?.scoringV2;
    const lightPathAnalysis = prediction?.lightPathAnalysis || {};
    const directional = lightPathAnalysis.directionalAnalysis;
    const layerBrightness = prediction?.layerBrightness || prediction?.breakdown?.layerBrightness;
    const layerBrightnessAdjustment = prediction?.layerBrightnessAdjustment || prediction?.breakdown?.layerBrightnessAdjustment;

    const carrierScore = Number(
      prediction?.breakdown?.carrierScore ??
      prediction?.carrierAnalysis?.score ??
      prediction?.canvasAnalysis?.score ??
      prediction?.breakdown?.canvasScore
    );
    const cloudCanvasScore = Number(
      prediction?.breakdown?.canvasScore ??
      prediction?.carrierAnalysis?.cloudCanvasScore ??
      prediction?.canvasAnalysis?.cloudCanvasScore ??
      carrierScore
    );
    const effectiveCloudCover = Number.isFinite(Number(prediction?.canvasAnalysis?.effectiveCloudCover))
      ? Number(prediction.canvasAnalysis.effectiveCloudCover)
      : weather.high * 0.8 + weather.mid * 0.55;

    let carrierLevel = 'weak';
    if (carrierAdjustment?.applied || denseCarrierCanvasOnly || cloudCanvasScore >= 58 || weather.high >= 60 || effectiveCloudCover >= 48) {
      carrierLevel = 'good';
    } else if (cloudCanvasScore >= 30 || weather.high >= 15 || weather.mid >= 20 || aerosolCarrier?.activatedScore >= 12 || effectiveCloudCover >= 18) {
      carrierLevel = 'fair';
    }

    const lightPathScore = Number(prediction?.breakdown?.lightPathScore ?? lightPathAnalysis.score);
    const directionalReason = directional?.reason || '';
    const directionalOpening = directionalReason.includes('opening');
    const hasDirectionalSamples = Boolean(directionalReason);
    let lightPathLevel = 'weak';
    if (directionalOpening || (!hasDirectionalSamples && lightPathScore >= 75)) {
      lightPathLevel = 'good';
    } else if (lightPathScore >= 45 || weather.low < 35) {
      lightPathLevel = 'fair';
    }
    if (
      lightPathAnalysis.capReason === 'overcast_cap_40' ||
      directional?.reason?.includes('cloud_wall') ||
      directional?.reason?.includes('blocked_corridor') ||
      directional?.reason?.includes('cloudy_corridor') ||
      weather.low >= 60
    ) {
      lightPathLevel = lightPathScore >= 45 ? 'fair' : 'weak';
    }

    const effectiveBrightness = Number(layerBrightness?.effectiveBrightness);
    const brightnessMultiplier = Number(layerBrightnessAdjustment?.multiplier ?? layerBrightness?.brightnessMultiplier ?? layerBrightness?.brightnessGate);
    const brightnessGated = layerBrightnessAdjustment?.applied || (Number.isFinite(brightnessMultiplier) && brightnessMultiplier < 0.72);
    let brightnessLevel = 'fair';
    if (!layerBrightness?.applied && !Number.isFinite(effectiveBrightness)) {
      brightnessLevel = lightPathLevel === 'good' && carrierLevel !== 'weak' ? 'good' : 'fair';
    } else if (brightnessGated || effectiveBrightness < 30) {
      brightnessLevel = 'weak';
    } else if (effectiveBrightness >= 45 || layerBrightness?.reason === 'layer_brightness_sufficient') {
      brightnessLevel = 'good';
    }

    const renderingFactor = Number(prediction?.breakdown?.renderingFactor ?? prediction?.renderingAnalysis?.factor);
    const aod = Number(weather.aod);
    const grayCurtainMode = postRainAdjustment?.mode === 'post_rain_gray_curtain' || postRainAdjustment?.mode === 'humid_haze_gray_curtain';
    let renderingLevel = 'fair';
    const grayVeilAirSuppression = scoringV2?.airMode === 'gray_veil_air_suppression';
    if (scoringV2?.airMode === 'warm_scattering_path_open') {
      renderingLevel = 'good';
    } else if (
      grayVeilAirSuppression ||
      grayCurtainMode ||
      aerosolHazeCap?.applied ||
      weather.visibility < 8 ||
      (Number.isFinite(aod) && aod > 0.45) ||
      Number(weather.pm10) >= 120 ||
      Number(weather.dust) >= 80
    ) {
      renderingLevel = 'weak';
    } else if (
      postRainAdjustment?.mode === 'post_rain_clear' ||
      scoringV2?.airMode === 'warm_scattering_path_open' ||
      aerosolCarrier?.activatedScore >= 12 ||
      renderingFactor >= 1.03 ||
      (weather.visibility >= 15 && weather.humidity >= 35 && weather.humidity <= 75 && (!Number.isFinite(aod) || aod <= 0.35))
    ) {
      renderingLevel = 'good';
    }

    const precipitation = Number(prediction?.precipitation ?? prediction?.rain ?? prediction?.factors?.precipitation?.value ?? 0);
    let limitLevel = 'good';
    const strongLimit = Boolean(
      prediction?.severeWeatherCap?.reason ||
      aerosolHazeCap?.applied ||
      layerBrightnessAdjustment?.applied ||
      thickHighCloudPenalty?.applied ||
      prediction?.geometricModel?.feasible === false ||
      prediction?.occlusionAnalysis?.occluded ||
      postRainAdjustment?.cap != null ||
      lightPathAnalysis.capReason === 'overcast_cap_40' ||
      precipitation > 0.5 ||
      weather.low >= 60
    );
    const mildLimit = Boolean(
      denseCarrierCanvasOnly ||
      (Number.isFinite(brightnessMultiplier) && brightnessMultiplier < 0.9) ||
      weather.low >= 25 ||
      weather.visibility < 15 ||
      weather.humidity > 75 ||
      grayVeilAirSuppression ||
      (scoringV2?.airMode !== 'warm_scattering_path_open' && Number.isFinite(aod) && aod > 0.35) ||
      precipitation > 0.1
    );
    if (strongLimit) {
      limitLevel = 'weak';
    } else if (mildLimit) {
      limitLevel = 'fair';
    }

    const factor = (key, level, icon) => ({
      key,
      title: this._analysisText(`factors.${key}.title`),
      status: this._analysisText(`factors.${key}.status.${level}`),
      desc: this._analysisText(`factors.${key}.desc.${level}`),
      statusTone: level === 'good' ? 'good' : (level === 'weak' ? 'weak' : (key === 'limits' ? 'mild' : 'fair')),
      type: level === 'good' ? 'positive' : (level === 'fair' ? 'neutral' : 'warning'),
      icon
    });

    const carrierFactor = factor('carrier', carrierLevel, 'cloud');
    carrierFactor.summary = this._isEnglishUI()
      ? (carrierLevel === 'good' ? 'Usable color canvas' : (carrierLevel === 'weak' ? 'Weak cloud canvas' : 'Partial cloud canvas'))
      : (carrierLevel === 'good' ? '有可染色云面' : (carrierLevel === 'weak' ? '云面基础偏弱' : '云面基础一般'));
    carrierFactor.desc = this._buildCarrierAnalysisDesc(carrierLevel, brightnessLevel);

    return [
      carrierFactor,
      Object.assign(factor('lightPath', lightPathLevel, lightPathLevel === 'weak' ? 'warn' : 'info'), {
        insight: this._isEnglishUI()
          ? (lightPathLevel === 'good' ? 'Sun path is open' : (lightPathLevel === 'weak' ? 'Sun path is blocked' : 'Some path obstruction'))
          : (lightPathLevel === 'good' ? '太阳方向较通透' : (lightPathLevel === 'weak' ? '光路遮挡明显' : '光路有局部遮挡'))
      }),
      Object.assign(factor('rendering', renderingLevel, 'leaf'), {
        insight: this._isEnglishUI()
          ? (renderingLevel === 'good' ? 'Warm color support' : (renderingLevel === 'weak' ? 'Colors may fade' : 'Neutral air color'))
          : (renderingLevel === 'good' ? '有暖色散射条件' : (renderingLevel === 'weak' ? '颜色容易被压淡' : '显色条件中性'))
      }),
      Object.assign(factor('limits', limitLevel, limitLevel === 'good' ? 'ok' : 'warn'), {
        insight: this._isEnglishUI()
          ? (limitLevel === 'good' ? 'No hard cap now' : (limitLevel === 'weak' ? 'Strong score pressure' : 'Minor score pressure'))
          : (limitLevel === 'good' ? '暂无硬压制' : (limitLevel === 'weak' ? '存在明显压分' : '有轻微压分'))
      })
    ];
  }

  _buildCarrierAnalysisDesc(carrierLevel, brightnessLevel) {
    if (this._isEnglishUI()) {
      if (carrierLevel === 'weak') return 'The colorable cloud canvas is limited, or the lit portion is too weak for broad fire clouds.';
      if (brightnessLevel === 'good') return 'Mid/high clouds provide a colorable canvas, and the lit portion is strong enough to support visible color.';
      if (brightnessLevel === 'weak') return 'There is some colorable cloud canvas, but the lit portion is weak, so color may stay faint or local.';
      return 'Some colorable cloud canvas is present, but height, coverage, or illumination is not ideal.';
    }

    if (carrierLevel === 'weak') return '可染色云面不足，或真正被照亮的部分偏弱，难形成成片火烧云。';
    if (brightnessLevel === 'good') return '中高云提供可染色云面，受光也够，具备显色基础。';
    if (brightnessLevel === 'weak') return '有可染色云面，但真正被照亮的部分偏弱，颜色可能偏淡或只出现在局部。';
    return '有可染色云面，但面积、高度或受光稳定性一般，表现更偏局部。';
  }

  extractAnalysisWeather(prediction) {
    const breakdown = prediction?.canvasAnalysis?.breakdown || prediction?.breakdown || {};
    const aerosol = prediction?.breakdown?.aerosolScattering;
    const high = prediction.cloudLayers?.high ?? prediction.factors?.highClouds?.value ?? breakdown.highClouds ?? prediction.highClouds ?? 0;
    const mid = prediction.cloudLayers?.mid ?? prediction.factors?.midClouds?.value ?? breakdown.midClouds ?? prediction.midClouds ?? 0;
    const low = prediction.cloudLayers?.low ?? prediction.factors?.lowClouds?.value ?? breakdown.lowClouds ?? prediction.lowClouds ?? 0;
    const layerCount = prediction.breakdown?.layerDiversity?.layerCount ?? [high, mid, low].filter(v => Number(v) >= 10).length;
    return {
      high: Number(high) || 0,
      mid: Number(mid) || 0,
      low: Number(low) || 0,
      visibility: Number(prediction.visibility ?? prediction.factors?.visibility?.value ?? 0) || 0,
      humidity: Number(prediction.humidity ?? prediction.factors?.humidity?.value ?? 0) || 0,
      aod: prediction.aerosolOpticalDepth ?? prediction.factors?.aerosolOpticalDepth?.value ?? aerosol?.aerosolOpticalDepth ?? null,
      dust: prediction.dust ?? aerosol?.dust ?? null,
      pm10: prediction.pm10 ?? aerosol?.pm10 ?? null,
      layerCount
    };
  }

  buildAnalysisConclusion(prediction, score, clouds) {
    if (prediction?.description === 'clear_sunset_transparent') {
      return this._translateOrFallback('prediction.analysisConclusion.clearSunset', this._uiText('Fire clouds are subtle, but the sunset is clear.', '火烧云不明显，日落通透。'));
    }
    const layerCount = prediction.breakdown?.layerDiversity?.layerCount ?? [clouds.high, clouds.mid, clouds.low].filter(v => Number(v) >= 10).length;
    if (score >= 80) return layerCount >= 2 ? this.i18n.t('prediction.analysisConclusion.excellent') : this.i18n.t('prediction.analysisConclusion.excellentSingleLayer');
    if (score >= 60) return layerCount >= 2 ? this.i18n.t('prediction.analysisConclusion.good') : this.i18n.t('prediction.analysisConclusion.goodSingleLayer');
    if (score >= 40) return this.i18n.t('prediction.analysisConclusion.fair');
    return this.i18n.t('prediction.analysisConclusion.low');
  }

  buildAnalysisSummary(prediction) {
    const weather = this.extractAnalysisWeather(prediction);
    const visibilityText = weather.visibility > 0 ? `${weather.visibility.toFixed(0)}km` : this._uiText('unknown', '未知');
    const humidityText = weather.humidity > 0 ? `${weather.humidity.toFixed(0)}%` : this._uiText('unknown', '未知');
    const cloudText = this._uiText(
      `High ${weather.high.toFixed(0)}%, mid ${weather.mid.toFixed(0)}%, low ${weather.low.toFixed(0)}%`,
      `高云 ${weather.high.toFixed(0)}%、中云 ${weather.mid.toFixed(0)}%、低云 ${weather.low.toFixed(0)}%`
    );
    return this._uiText(
      `Cloud canvas: ${cloudText}. Air rendering: visibility ${visibilityText}, humidity ${humidityText}. These jointly determine whether sunset light can reach the cloud layer and stay saturated.`,
      `云层画布：${cloudText}；空气渲染：能见度 ${visibilityText}、湿度 ${humidityText}。这两部分共同决定霞光能否照到云层，以及颜色是否通透饱和。`
    );
  }

  renderAnalysisCard(groups, conclusion) {
    const groupHtml = groups.every(group => group.status)
      ? `<div class="analysis-factor-grid">${groups.map(group => this.renderAnalysisFactor(group)).join('')}</div>`
      : groups.map(group => this.renderAnalysisGroup(group)).join('');
    return `
      <div class="analysis-card app-analysis-card">
        <div class="analysis-card-head">
          <div class="analysis-card-title"><span>${this._analysisText('title')}</span></div>
          <div class="analysis-card-subtitle">${this._uiText('Cloud, path, air, limits', '云层、光路、空气和限制项')}</div>
        </div>
        ${groupHtml}
      </div>
    `;
  }

  renderConclusionBanner(conclusion) {
    return `<div class="conclusion-banner"><span class="conclusion-icon">${this.renderInlineSvgIcon('leaf')}</span><strong>${conclusion}</strong></div>`;
  }

  renderAnalysisGroup(group) {
    const items = group.items.map(item => this.renderAnalysisItem(item, group.type)).join('');
    return `
      <section class="analysis-group analysis-group-${group.type}">
        <div class="analysis-group-label"><span class="analysis-group-icon">${this.renderInlineSvgIcon(group.icon)}</span>${group.title}</div>
        <div class="analysis-items">${items}</div>
      </section>
    `;
  }

  renderAnalysisItem(item, type) {
    const icon = type === 'positive' ? 'ok' : (type === 'warning' ? 'warn' : 'info');
    return `
      <div class="analysis-item analysis-item-${type}">
        <span class="analysis-item-icon" aria-hidden="true">${this.renderInlineSvgIcon(icon)}</span>
        <span class="analysis-item-copy"><strong>${item.title}</strong><small>${item.desc}</small></span>
      </div>
    `;
  }

  renderAnalysisFactor(factor) {
    const toneClass = factor.statusTone || factor.type;
    const statusHtml = factor.status
      ? `<span class="analysis-factor-tag">${factor.status}</span>`
      : '';
    return `
      <section class="analysis-factor analysis-factor-${factor.type} analysis-factor-${toneClass} analysis-factor-${factor.key}">
        <div class="analysis-factor-heading">
          <span class="analysis-factor-icon">${this.renderInlineSvgIcon(factor.icon)}</span>
          <span class="analysis-factor-title">${factor.title}</span>
          ${statusHtml}
        </div>
        <p>${factor.desc}</p>
      </section>
    `;
  }

  /**
   * 渲染分数明细弹出层
   * @param {Object} prediction - 预测数据
   * @returns {string}
   */
  renderScoreBreakdownPopover(prediction) {
    const fmt = (v, digits = 0) => {
      const n = Number(v);
      return Number.isFinite(n) ? n.toFixed(digits) : '--';
    };
    const localized = (en, zh) => {
      const lang = String(this.i18n?.getCurrentLanguage?.() || this.i18n?.currentLanguage || '').toLowerCase();
      return lang.startsWith('zh') ? zh : en;
    };
    const ledgerText = (key, params = {}, fallbackEn = '', fallbackZh = '') => {
      const fullKey = `prediction.scoreBreakdown.ledger.${key}`;
      const translated = this.i18n?.t?.(fullKey, params);
      if (translated && translated !== fullKey) return translated;
      const fallback = localized(fallbackEn, fallbackZh || fallbackEn);
      return Object.entries(params || {}).reduce(
        (text, [paramKey, value]) => String(text).replaceAll(`{{${paramKey}}}`, value),
        fallback
      );
    };
    const escape = (value) => String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

    const breakdown = prediction?.breakdown || {};
    const baseScore = breakdown.baseScore;
    const canvasScore = prediction?.canvasAnalysis?.score ?? breakdown.canvasScore;
    const carrierScore = prediction?.carrierAnalysis?.score ?? breakdown.carrierScore ?? canvasScore;
    const lightPathScore = prediction?.lightPathAnalysis?.score ?? breakdown.lightPathScore;
    const lightPathGate = prediction?.lightPathGate?.gate ?? breakdown.lightPathGate;
    const renderingFactor = prediction?.renderingAnalysis?.factor ?? breakdown.renderingFactor;
    const renderingAdjustment = prediction?.renderingAdjustment?.adjustment ?? breakdown.renderingAdjustment;
    const renderingMode = prediction?.renderingAdjustment?.reason ?? breakdown.renderingMode;
    const renderedScore = breakdown.unclampedFinalScore;
    const finalScore = prediction?.score;
    const aerosol = prediction?.breakdown?.aerosolScattering;
    const aerosolCarrier = prediction?.aerosolCarrierScore || prediction?.breakdown?.aerosolCarrierScore;
    const aerosolFactor = prediction?.renderingAnalysis?.aerosolFactor ?? aerosol?.factor;
    const thickHighCloudPenalty = prediction?.thickHighCloudPenalty || prediction?.lightPathAnalysis?.thickHighCloudPenalty;
    const cloudThickness = prediction?.cloudThickness || prediction?.lightPathAnalysis?.cloudThickness;
    const denseCarrierCanvasOnly = cloudThickness?.reasons?.includes('dense_upper_cloud_carrier_softened')
      || cloudThickness?.reasons?.includes('opening_upper_cloud_carrier_softened')
      || cloudThickness?.reasons?.includes('directional_high_cloud_carrier_softened')
      || cloudThickness?.reasons?.includes('upper_cloud_direction_opening')
      || cloudThickness?.reasons?.includes('upper_cloud_clear_light_path')
      || thickHighCloudPenalty?.reason === 'dense_upper_cloud_carrier_canvas_only'
      || thickHighCloudPenalty?.reason === 'opening_upper_cloud_carrier_canvas_only'
      || thickHighCloudPenalty?.reason === 'directional_high_cloud_carrier_canvas_only';
    const aerosolHazeCap = prediction?.aerosolHazeCap;
    const carrierAdjustment = prediction?.highCloudCarrierAdjustment;
    const directionalCurtainCarrier = prediction?.directionalCurtainCarrier || prediction?.breakdown?.directionalCurtainCarrier;
    const postRainAdjustment = prediction?.postRainAdjustment;
    const scoringV2 = prediction?.scoringV2;
    const layerBrightness = prediction?.layerBrightness || prediction?.breakdown?.layerBrightness;
    const layerBrightnessAdjustment = prediction?.layerBrightnessAdjustment || prediction?.breakdown?.layerBrightnessAdjustment;
    const brightnessMultiplier = layerBrightnessAdjustment?.multiplier ?? layerBrightness?.brightnessMultiplier ?? layerBrightness?.brightnessGate;
    const severeWeatherCap = prediction?.severeWeatherCap;
    const occlusionAnalysis = prediction?.occlusionAnalysis;
    const geometricModel = prediction?.geometricModel;
    const factors = prediction?.factors || {};
    const clouds = prediction?.canvasAnalysis?.breakdown || prediction?.cloudLayers || {};

    const metric = (keys, fallback = null) => {
      for (const key of keys) {
        const value = factors[key]?.value ?? prediction?.[key];
        if (value != null && Number.isFinite(Number(value))) return Number(value);
      }
      return fallback;
    };

    const highClouds = clouds.highClouds ?? clouds.high;
    const midClouds = clouds.midClouds ?? clouds.mid;
    const lowClouds = clouds.lowClouds ?? clouds.low;
    const visibility = metric(['visibility']);
    const humidity = metric(['humidity']);
    const precipitation = metric(['precipitation', 'convPrecip'], 0);
    const upperCloudCover = Number(highClouds) * 0.75 + Number(midClouds) * 0.45;
    const cloudTypeAdjustment = prediction?.canvasAnalysis?.cloudTypeAdjustment;
    const cloudThicknessAdjustment = prediction?.canvasAnalysis?.cloudThicknessAdjustment;
    const cloudThicknessEvidence = cloudThickness?.evidence || {};
    const signed = (value) => {
      const n = Number(value);
      if (!Number.isFinite(n)) return '--';
      return `${n >= 0 ? '+' : '-'}${Math.abs(n).toFixed(1)}`;
    };
    const layerLabel = (key) => ({
      mid: ledgerText('labels.midLayer', {}, 'Mid cloud', '中云层'),
      high: ledgerText('labels.highLayer', {}, 'High cloud', '高云层'),
      low: ledgerText('labels.lowLayer', {}, 'Low cloud', '低云层'),
      aerosol: ledgerText('labels.aerosolCarrier', {}, 'Aerosol carrier', '气溶胶载体'),
      directional: ledgerText('labels.directionalCarrier', {}, 'Sun-direction carrier', '日落方向载体')
    }[key] || key || '--');

    const reasonText = (reason) => ({
      precipitation_cap_45: ledgerText('reasons.precipitationCap45', {}, 'rain plus low clouds keeps the score low', '降水叠加低云，观赏条件明显变差'),
      overcast_cap_35: ledgerText('reasons.overcastCap35', {}, 'low clouds block the sunlight path', '低云遮住太阳方向，光线不容易照到云层'),
      overcast_low_visibility_cap_35: ledgerText('reasons.overcastLowVisibilityCap35', {}, 'very cloudy sky and low visibility keep the score conservative', '总云量很高叠加低能见度，先保守压低评分'),
      overcast_fog_cap_15: ledgerText('reasons.overcastFogCap15', {}, 'very cloudy sky and low visibility make the sky too gray', '总云量很高叠加低能见度，天空容易发灰'),
      rainy_mid_cloud_overcast_cap_35: ledgerText('reasons.rainyMidCloudOvercastCap35', {}, 'post-rain moisture makes the glow hard to show', '雨后水汽偏重，霞光不容易显色'),
      no_visible_sunset_path_cap_5: ledgerText('reasons.noVisibleSunsetPathCap5', {}, 'sunset light is unlikely to reach the clouds', '日落光线很难照到云层'),
      no_visible_sunset_path_cap_15: ledgerText('reasons.noVisibleSunsetPathCap15', {}, 'rainy gray sky likely blocks sunset light', '雨后灰幕偏重，日落光线大概率被挡住'),
      extreme_dust_haze_cap_28: ledgerText('reasons.extremeDustHazeCap28', {}, 'heavy dust or haze suppresses the glow', '强沙尘或灰幕会压住霞光'),
      severe_haze_cap_35: ledgerText('reasons.severeHazeCap35', {}, 'heavy haze makes colors hard to show', '重度灰霾让颜色不容易出来'),
      moderate_haze_cap_45: ledgerText('reasons.moderateHazeCap45', {}, 'haze weakens orange-red color', '灰霾会削弱红橙色'),
      haze_warm_scattering_path_open: ledgerText('reasons.hazeWarmScatteringPathOpen', {}, 'open sunset path turns moderate particles into warm orange-red scattering', '日落光路打开，适度颗粒增强橙红散射'),
      full_upper_cloud_gray_veil_air_rendering: ledgerText('reasons.fullUpperCloudGrayVeilAirRendering', {}, 'full mid/high cloud plus dirty air suppresses color rendering', '满铺中高云叠加偏脏空气，显色转为灰幕抑制')
    }[reason] || reason || ledgerText('reasons.adjustmentApplied', {}, 'score adjusted for limiting conditions', '已按限制条件修正'));

    const capEvents = [
      severeWeatherCap?.reason ? {
        label: ledgerText('labels.hardCap', {}, 'Limiting weather', '天气限制'),
        value: `≤${fmt(severeWeatherCap.score, 0)}`,
        detail: reasonText(severeWeatherCap.reason),
        tone: 'bad'
      } : null,
      aerosolHazeCap?.applied ? {
        label: ledgerText('labels.hazeCap', {}, 'Haze limit', '灰幕影响'),
        value: `≤${fmt(aerosolHazeCap.cap, 0)}`,
        detail: reasonText(aerosolHazeCap.reason),
        tone: 'bad'
      } : null,
      thickHighCloudPenalty?.applied ? {
        label: ledgerText('labels.thickCloudCap', {}, 'Thick cloud', '厚云影响'),
        value: `≤${fmt(thickHighCloudPenalty.cap, 0)}`,
        detail: ledgerText('details.thickCloudCap', {}, 'thick high cloud reduces usable color rendering', '高云过厚，真实可染色效果下降'),
        tone: 'bad'
      } : null,
      geometricModel?.feasible === false ? {
        label: ledgerText('labels.geometryCap', {}, 'Sun angle', '太阳角度'),
        value: '≤30',
        detail: geometricModel.reason || ledgerText('details.geometryCap', {}, 'sun/cloud geometry is not feasible', '太阳与云层几何条件不足'),
        tone: 'bad'
      } : null,
      occlusionAnalysis?.occluded ? {
        label: ledgerText('labels.occlusion', {}, 'Occlusion', '遮挡修正'),
        value: '×0.75',
        detail: ledgerText('details.occlusion', {}, 'distant obstruction reduces the score', '远端遮挡压低最终分'),
        tone: 'bad'
      } : null,
      layerBrightnessAdjustment?.postCalibrationApplied ? {
        label: ledgerText('labels.layerBrightness', {}, 'Layer brightness', '受光亮度'),
        value: `×${fmt(layerBrightnessAdjustment.multiplier ?? layerBrightness?.brightnessMultiplier ?? layerBrightness?.brightnessGate ?? 1, 2)}`,
        detail: ledgerText(
          'details.layerBrightnessMultiplier',
          {
            brightness: fmt(layerBrightness?.effectiveBrightness, 1),
            evidence: Array.isArray(layerBrightness?.dimEvidence) ? layerBrightness.dimEvidence.join(', ') : '--'
          },
          'effective brightness {{brightness}}; dim evidence: {{evidence}}',
          '有效亮度 {{brightness}}；压暗证据：{{evidence}}'
        ),
        tone: 'bad'
      } : null,
      carrierAdjustment?.applied ? {
        label: ledgerText('labels.carrierFloor', {}, 'Carrier protection', '载体保护'),
        value: `≥${fmt(carrierAdjustment.floor, 0)}`,
        detail: ledgerText('details.carrierFloor', {}, 'clear high-cloud carrier avoids over-penalty from cloud-thickness evidence', '高云载体清透，避免被云厚信号误伤低估'),
        tone: 'good'
      } : null,
      scoringV2?.applied && scoringV2?.airMode === 'warm_scattering_path_open' ? {
        label: ledgerText('labels.scoringV2', {}, 'Open-path warm scattering', '开口暖色散射'),
        value: fmt(scoringV2.score, 1),
        detail: ledgerText(
          'details.scoringV2',
          {
            carrier: fmt(scoringV2.cloudCarrier, 1),
            path: fmt(scoringV2.pathFactor, 2),
            air: fmt(scoringV2.airFactor, 2)
          },
          'cloud carrier {{carrier}}; path evidence is folded into layer brightness; air rendering {{air}}',
          '云载体 {{carrier}}；光路证据已并入分层受光亮度；空气显色 {{air}}'
        ),
        tone: 'good'
      } : null,
      scoringV2?.applied && scoringV2?.airMode === 'gray_veil_air_suppression' ? {
        label: ledgerText('labels.grayVeilAirRendering', {}, 'Gray-veil rendering', '灰幕显色抑制'),
        value: fmt(scoringV2.score, 1),
        detail: ledgerText(
          'details.grayVeilAirRendering',
          {
            carrier: fmt(scoringV2.cloudCarrier, 1),
            path: fmt(scoringV2.pathFactor, 2),
            air: fmt(scoringV2.airFactor, 2)
          },
          'full mid/high cloud with dirty air: carrier {{carrier}}; path evidence is brightness evidence; suppressed air rendering {{air}}',
          '满铺中高云叠加偏脏空气：云载体 {{carrier}}；光路证据作为亮度证据；灰幕显色 {{air}}'
        ),
        tone: 'cap'
      } : null,
      postRainAdjustment?.applied && postRainAdjustment.cap ? {
        label: ledgerText('labels.postRainCap', {}, 'Gray-curtain haze', '湿灰幕'),
        value: `≤${fmt(postRainAdjustment.cap, 0)}`,
        detail: ledgerText('details.postRainCap', {}, 'moisture, particles, or weak direct light turns the glow gray', '水汽、颗粒物或直达光偏弱，霞光容易发灰'),
        tone: 'bad'
      } : null
    ].filter(Boolean);

    const renderedNumber = Number(renderedScore);
    const finalNumber = Number(finalScore);
    const hasExplicitCap = capEvents.some(event => event.tone === 'bad');
    if (Number.isFinite(renderedNumber) && Number.isFinite(finalNumber) && renderedNumber - finalNumber > 1 && !hasExplicitCap) {
      let detail = ledgerText('reasons.displayCalibration', {}, 'final display score is aligned with the prediction status band', '最终展示分按预测状态档位校准');
      if (Number(lightPathScore) < 50 && finalNumber <= 60) {
        detail = ledgerText(
          'reasons.lightPathStatusCap60',
          { light: fmt(lightPathScore, 1) },
          'light path is {{light}}, so the result is shown as a light-glow chance',
          '光路约 {{light}}，更像轻微霞光机会'
        );
      } else if (Number(canvasScore) < 30 && finalNumber <= 40) {
        detail = ledgerText(
          'reasons.canvasStatusCap40',
          { canvas: fmt(canvasScore, 1) },
          'cloud carrier is {{canvas}}, so fire-cloud chance is weak',
          '云层载体约 {{canvas}}，火烧云机会偏弱'
        );
      }

      capEvents.push({
        label: ledgerText('labels.displayCalibration', {}, 'Display calibration', '展示分校准'),
        value: `${fmt(renderedScore, 1)}→${fmt(finalScore, 0)}`,
        detail,
        tone: 'cap'
      });
    }

    const primaryEvent = capEvents.find(event => event.tone === 'bad') || capEvents[0];
    const summary = primaryEvent
      ? ledgerText(
        'summary.event',
        { score: fmt(finalScore, 0), detail: `${primaryEvent.label} ${primaryEvent.value}` },
        '{{score}} points: main adjustment is {{detail}}',
        '{{score}} 分：主要调整是 {{detail}}'
      )
      : Number.isFinite(Number(baseScore)) && Number.isFinite(Number(renderedScore))
        ? ledgerText('summary.rendered', { base: fmt(baseScore, 0), rendered: fmt(renderedScore, 0) }, '{{base}} points adjusted by rendering conditions to {{rendered}}', '{{base}} 分经显色条件修正为 {{rendered}} 分')
        : ledgerText('summary.default', { score: fmt(finalScore, 0) }, '{{score}} points: calculated from layer carrier, layer brightness, and air rendering', '{{score}} 分：由分层载体、分层受光亮度和空气显色计算');

    const step = (index, label, description, result, detail = '', tone = '') => `
      <div class="score-ledger-step ${tone ? `score-ledger-step-${tone}` : ''}">
        <span class="score-ledger-index">${index}</span>
        <div class="score-ledger-body">
          <div class="score-ledger-line">
            <span class="score-ledger-label">${escape(label)}</span>
            <span class="score-ledger-result">${escape(result)}</span>
          </div>
          ${description ? `<div class="score-ledger-expression">${escape(description)}</div>` : ''}
          ${detail ? `
            <details class="score-ledger-detail">
              <summary>${escape(ledgerText('labels.evidence', {}, 'Calculation evidence', '计算依据'))}</summary>
              <div class="score-ledger-detail-copy">${escape(detail)}</div>
            </details>` : ''}
        </div>
      </div>`;

    const weightedDescription = Number.isFinite(Number(baseScore))
      ? ledgerText('layerSumFormula', { base: fmt(baseScore, 1) }, 'Σ(layer carrier × layer brightness) = {{base}}', 'Σ(分层载体 × 分层受光亮度) = {{base}}')
      : ledgerText('canvasPlusLightPath', {}, 'Σ(layer carrier × layer brightness)', 'Σ(分层载体 × 分层受光亮度)');
    const renderingDescription = (() => {
      if (!Number.isFinite(Number(baseScore)) || !Number.isFinite(Number(renderedScore))) {
        return ledgerText('weatherTransparency', {}, 'weather transparency factor', '天气通透度');
      }
      if (Number.isFinite(Number(renderingFactor))) {
        return ledgerText('renderingMultiplierFormula', { base: fmt(baseScore, 1), factor: fmt(renderingFactor, 2), rendered: fmt(renderedScore, 1) }, '{{base}} × air rendering {{factor}} = {{rendered}}', '{{base}} × 空气显色系数 {{factor}} = {{rendered}}');
      }
      if (Number.isFinite(Number(renderingAdjustment))) {
        const sign = Number(renderingAdjustment) >= 0 ? '+' : '-';
        return ledgerText('renderingAdjustmentFormula', { base: fmt(baseScore, 1), sign, adjustment: fmt(Math.abs(Number(renderingAdjustment)), 1), rendered: fmt(renderedScore, 1) }, '{{base}} {{sign}} rendering adjustment {{adjustment}} = {{rendered}}', '{{base}} {{sign}} 显色修正 {{adjustment}} = {{rendered}}');
      }
      return ledgerText('renderingFormula', { base: fmt(baseScore, 1), factor: fmt(renderingFactor, 2), rendered: fmt(renderedScore, 1) }, '{{base}} adjusted by rendering = {{rendered}}', '{{base}} 经显色修正 = {{rendered}}');
    })();

    const lightPathDetail = (() => {
      if (prediction?.lightPathAnalysis?.capReason === 'overcast_cap_40') {
        return ledgerText('details.lightPathLowCloudBlock', {}, 'low clouds block the sunlight path to the colorable clouds', '低云遮住太阳方向，光线不容易照到中高云');
      }
      if (prediction?.lightPathAnalysis?.capReason === 'precipitation_cap_50') {
        return ledgerText('details.lightPathRain', {}, 'rain weakens direct sunset light', '降水会削弱日落直射光');
      }
      return prediction?.lightPathAnalysis?.source === 'solar_direction_openmeteo'
        ? ledgerText('details.directionalSamples', {}, 'solar-azimuth samples at 10/25/50/75/100km are included', '已接入太阳方位 10/25/50/75/100km 周边采样')
        : Number.isFinite(Number(lightPathScore))
          ? ledgerText('details.lightPathScoreEvidence', { light: fmt(lightPathScore, 1) }, 'path evidence score {{light}} is folded into brightness', '光路证据 {{light}} 已并入受光亮度')
          : '';
    })();

    const carrierDetail = (() => {
      const parts = [];
      if (Number.isFinite(upperCloudCover)) {
        parts.push(ledgerText(
          'details.upperCloudCanvas',
          { high: fmt(highClouds, 1), mid: fmt(midClouds, 1), upper: fmt(upperCloudCover, 1), range: fmt(prediction?.canvasAnalysis?.cloudRangeScore, 1) },
          'upper canvas {{upper}} = high {{high}}×0.75 + mid {{mid}}×0.45; range score {{range}}',
          '中高云画布 {{upper}} = 高云 {{high}}×0.75 + 中云 {{mid}}×0.45；区间分 {{range}}'
        ));
      }
      if (Number(prediction?.canvasAnalysis?.highCloudBonus)) {
        parts.push(ledgerText(
          'details.highCloudBonus',
          { bonus: signed(prediction.canvasAnalysis.highCloudBonus) },
          'high-cloud dominant bonus {{bonus}}',
          '高云主导 bonus {{bonus}}'
        ));
      }
      if (Number(cloudTypeAdjustment?.canvasBonus)) {
        parts.push(ledgerText(
          'details.cloudTypeAdjustment',
          { bonus: signed(cloudTypeAdjustment.canvasBonus), reason: cloudTypeAdjustment.reason || '--' },
          'cloud type {{reason}} {{bonus}}',
          '云种 {{reason}} {{bonus}}'
        ));
      }
      if (Number(cloudThicknessAdjustment?.adjustment)) {
        parts.push(ledgerText(
          'details.cloudThicknessAdjustment',
          {
            thickness: cloudThickness?.thickness || '--',
            thin: fmt(cloudThicknessEvidence.thin, 1),
            thick: fmt(cloudThicknessEvidence.thick, 1),
            net: fmt(cloudThicknessEvidence.net, 1),
            pressure: fmt(cloudThicknessEvidence.pressure ?? cloudThicknessAdjustment.pressure, 2),
            diffuse: fmt(Number(cloudThicknessEvidence.diffuseRatio) * 100, 0),
            water: fmt(cloudThicknessEvidence.waterIndex, 1),
            relief: fmt(cloudThicknessEvidence.carrierRelief, 2),
            adjustment: signed(cloudThicknessAdjustment.adjustment),
            solar: cloudThickness?.reasons?.includes('low_solar_transmission')
              ? ledgerText('details.lowSolarTransmissionYes', {}, 'yes', '命中')
              : ledgerText('details.lowSolarTransmissionNo', {}, 'no', '未命中'),
            base: fmt(cloudThicknessAdjustment.baseScore, 1),
            max: fmt(cloudThicknessAdjustment.maxPenalty, 1)
          },
          'cloud thickness {{thickness}}, base {{base}} × 30% × pressure {{pressure}} = max {{max}} scaled; diffuse {{diffuse}}%, water {{water}}, carrier relief {{relief}}, low solar transmission {{solar}}, adjustment {{adjustment}}',
          '云厚 {{thickness}}，画布 {{base}} × 30% × 压力 {{pressure}}，最大折损 {{max}}；散射 {{diffuse}}%，水汽 {{water}}，载体缓冲 {{relief}}，低太阳透射 {{solar}}，修正 {{adjustment}}'
        ));
      }
      if (directionalCurtainCarrier?.applied) {
        parts.push(ledgerText(
          'details.directionalCurtainCarrier',
          { score: fmt(directionalCurtainCarrier.score, 1), high: fmt(directionalCurtainCarrier.metrics?.high, 1), lowMid: fmt(directionalCurtainCarrier.metrics?.lowMidBlock, 1) },
          'solar-direction curtain {{score}}, high cloud {{high}}, low/mid block {{lowMid}}',
          '日落方向幕布 {{score}}，高云 {{high}}，低中云遮挡 {{lowMid}}'
        ));
      }
      if (aerosolCarrier?.activatedScore >= 12) {
        parts.push(ledgerText(
          'details.aerosolCarrier',
          { activation: fmt(aerosolCarrier.lightPathActivation, 2) },
          'thin haze can carry warm sunset color when the light path is open, activation ×{{activation}}',
          '云层很少时，薄雾在光路通畅时可承接一点暖色，光路激活 ×{{activation}}'
        ));
      }
      return parts.join('；');
    })();

    const baseScoreDetail = (() => {
      const contributions = Array.isArray(layerBrightness?.layerContributions)
        ? layerBrightness.layerContributions
        : (Array.isArray(breakdown.layerContributions) ? breakdown.layerContributions : []);
      if (!contributions.length) return '';
      return contributions
        .map(layer => ledgerText(
          'details.layerContribution',
          {
            layer: layerLabel(layer.key),
            carrier: fmt(layer.carrier, 1),
            brightness: fmt(layer.brightness, 2),
            score: fmt(layer.score, 1)
          },
          '{{layer}}: carrier {{carrier}} × brightness {{brightness}} = {{score}}',
          '{{layer}}：载体 {{carrier}} × 受光 {{brightness}} = {{score}}'
        ))
        .join('；');
    })();

    const brightnessDetail = (() => {
      if (!layerBrightness?.applied) return '';
      const factors = layerBrightness.factors || {};
      const layers = layerBrightness.layers || {};
      return ledgerText(
        'details.layerBrightness',
        {
          brightness: fmt(layerBrightness.effectiveBrightness, 1),
          gate: fmt(layerBrightness.brightnessGate, 2),
          canvas: fmt(layers.cloudCanvas, 1),
          low: fmt(layers.low, 1),
          lowBlock: fmt(factors.lowBlockFactor, 2),
          solar: fmt(factors.solarFactor, 2),
          path: fmt(factors.pathFactor, 2),
          air: fmt(factors.airTransmission, 2),
          thickness: fmt(factors.thicknessFactor, 2),
          beam: fmt(factors.beamFactor, 2)
        },
        'brightness {{brightness}}, gate {{gate}}; layer carrier {{canvas}}, low-cloud block {{low}} / transmission {{lowBlock}}, solar {{solar}}, path {{path}}, air {{air}}, thickness {{thickness}}, beam {{beam}}',
        '亮度 {{brightness}}，门控 {{gate}}；分层载体 {{canvas}}，低云遮挡 {{low}} / 透过 {{lowBlock}}，太阳几何 {{solar}}，光路因子 {{path}}，空气 {{air}}，云厚 {{thickness}}，直射/散射 {{beam}}'
      );
    })();

    const adjustmentHtml = capEvents.length
      ? capEvents.map((event, idx) => step(
        idx + 5,
        event.label,
        event.tone === 'good'
          ? ledgerText('details.positiveAdjustment', {}, 'favorable condition adjustment', '有利条件修正')
          : ledgerText('details.limitingAdjustment', {}, 'limiting condition adjustment', '限制条件修正'),
        event.value,
        event.detail,
        event.tone === 'good' ? 'good' : 'cap'
      )).join('')
      : '';

    return `
      <div class="score-breakdown-popover score-breakdown-ledger" hidden>
        <div class="score-ledger-hero">
          <div class="score-breakdown-title">${escape(this.i18n.t('prediction.scoreBreakdown.title'))}</div>
          <div class="score-ledger-subtitle">${escape(ledgerText('whyThisScore', {}, 'Why this score', '为什么是这个分数'))}</div>
        </div>
        <div class="score-ledger-summary">${escape(summary)}</div>
        <div class="score-ledger-steps">
          ${step(1, ledgerText('labels.cloudCarrier', {}, 'Cloud carrier', '云层载体'), ledgerText('details.cloudCarrier', {}, 'usable color carrier from cloud layers, solar-direction cloud, or thin haze', '可被染色的本地云面、日落方向云幕或薄雾载体'), fmt(carrierScore, 1), carrierDetail)}
          ${step(2, ledgerText('labels.layerBrightness', {}, 'Layer brightness', '分层受光亮度'), ledgerText('details.layerBrightnessShort', {}, 'sun direction, blockage, and illumination evidence explain whether each carrier layer is lit', '太阳方向、遮挡和亮度响应共同解释各层载体是否被照亮'), layerBrightness?.applied ? fmt(layerBrightness.effectiveBrightness, 1) : '--', [brightnessDetail, lightPathDetail].filter(Boolean).join('；'))}
          ${step(3, ledgerText('labels.baseScore', {}, 'Base score', '基础分'), weightedDescription, fmt(baseScore, 1), baseScoreDetail)}
          ${step(4, ledgerText('labels.rendering', {}, 'Air rendering', '空气显色'), renderingDescription, fmt(renderedScore, 1), ledgerText('details.renderingFactors', { visibility: fmt(prediction?.renderingAnalysis?.visibilityFactor, 2), humidity: fmt(prediction?.renderingAnalysis?.humidityFactor, 2), aerosol: fmt(aerosolFactor, 2) }, 'visibility ×{{visibility}}, humidity ×{{humidity}}, aerosol ×{{aerosol}}', '能见度 ×{{visibility}}，湿度 ×{{humidity}}，气溶胶 ×{{aerosol}}'))}
          ${adjustmentHtml}
          ${step(capEvents.length ? capEvents.length + 5 : 5, ledgerText('labels.final', {}, 'Final', '最终分'), capEvents.length ? ledgerText('details.afterAdjustments', {}, 'after weather and visibility adjustments', '结合天气和能见度后') : ledgerText('details.finalDisplayed', {}, 'final displayed result', '最终展示结果'), fmt(finalScore, 0), '', 'final')}
        </div>
      </div>
    `;
  }

  formatChineseRelativeAzimuth(azimuth, language = 'zh-CN') {
    const angle = Number(azimuth);
    if (!Number.isFinite(angle)) return '';

    const normalized = ((angle % 360) + 360) % 360;
    const nearestQuarter = Math.round(normalized / 90);
    const cardinalAngle = nearestQuarter * 90;
    const cardinalIndex = nearestQuarter % 4;
    let offset = Math.round(normalized - cardinalAngle);
    if (offset === -0) offset = 0;

    const chars = language === 'zh-TW'
      ? { n: '北', e: '東', s: '南', w: '西', straight: '正', lean: '偏' }
      : { n: '北', e: '东', s: '南', w: '西', straight: '正', lean: '偏' };
    const cardinals = [chars.n, chars.e, chars.s, chars.w];
    const sideByCardinal = [
      offset >= 0 ? chars.e : chars.w,
      offset >= 0 ? chars.s : chars.n,
      offset >= 0 ? chars.w : chars.e,
      offset >= 0 ? chars.n : chars.s,
    ];

    if (offset === 0) return `${chars.straight}${cardinals[cardinalIndex]}`;
    return `${cardinals[cardinalIndex]}${chars.lean}${sideByCardinal[cardinalIndex]} ${Math.abs(offset)}°`;
  }

  /**
   * 根据当前语言返回方位角方向描述
   * @param {Object} prediction - 预测对象
   * @returns {string} 本地化方向描述
   * @private
   */
  getLocalizedAzimuthDirection(prediction) {
    if (!prediction || prediction.sunAzimuth === null || prediction.sunAzimuth === undefined) {
      return '';
    }

    const rawLanguage = this.i18n?.currentLanguage || this.i18n?.getCurrentLanguage?.() || 'zh-CN';
    const normalizedLanguage = String(rawLanguage).toLowerCase();
    const language = normalizedLanguage.startsWith('ko') ? 'ko-KR'
      : normalizedLanguage.startsWith('ja') ? 'ja-JP'
        : normalizedLanguage.startsWith('zh-tw') || normalizedLanguage.startsWith('zh-hk') ? 'zh-TW'
          : normalizedLanguage.startsWith('zh') ? 'zh-CN'
            : normalizedLanguage.startsWith('en') ? 'en-US'
              : rawLanguage;
    if (language === 'zh-CN' || language === 'zh-TW') {
      return this.formatChineseRelativeAzimuth(prediction.sunAzimuth, language);
    }

    const directionSets = {
      'ja-JP': [
        '北', '北北東', '北東', '東北東',
        '東', '東南東', '南東', '南南東',
        '南', '南南西', '南西', '西南西',
        '西', '西北西', '北西', '北北西'
      ],
      'ko-KR': [
        '북', '북북동', '북동', '동북동',
        '동', '동남동', '남동', '남남동',
        '남', '남남서', '남서', '서남서',
        '서', '서북서', '북서', '북북서'
      ],
      'en-US': [
        'N', 'NNE', 'NE', 'ENE',
        'E', 'ESE', 'SE', 'SSE',
        'S', 'SSW', 'SW', 'WSW',
        'W', 'WNW', 'NW', 'NNW'
      ]
    };
    const directions = directionSets[language] || directionSets['en-US'];

    const index = Math.round(prediction.sunAzimuth / 22.5) % 16;
    return directions[index];
  }

  /**
   * 渲染云层分层信息
   *
   * @param {Object} cloudLayers - 云层分层数据 {high, mid, low, description}
   * @returns {string} HTML字符串
   *
   * 需求：12.11, 12.12, 12.13 - 显示云层分层信息和影响说明
   */
  renderCloudLayers(cloudLayers) {
    if (!cloudLayers) return '';

    const high = cloudLayers.high ?? 0;
    const mid = cloudLayers.mid ?? 0;
    const low = cloudLayers.low ?? 0;
    const normalizeLabel = (raw, fallback) => {
      const text = String(raw || '').trim();
      if (!text || /[{}<>]/.test(text)) return fallback;
      return text.length > 10 ? fallback : text;
    };

    const highLabel = normalizeLabel(this.i18n.t('prediction.cloudLayers.shortHigh'), '高云');
    const midLabel = normalizeLabel(this.i18n.t('prediction.cloudLayers.shortMid'), '中云');
    const lowLabel = normalizeLabel(this.i18n.t('prediction.cloudLayers.shortLow'), '低云');

    return `
      <div class="compact-cloud-info">
        <span class="cloud-icon" style="flex-shrink:0;">☁️</span>
        <span class="cloud-item" title="${highLabel}"><span class="cloud-label">${highLabel}</span>: <strong class="cloud-value">${high.toFixed(0)}%</strong>
          <span class="cloud-mini-bar-track"><span class="cloud-mini-bar-fill" style="width:${Math.min(high,100)}%;background:var(--cloud-high-color);"></span></span>
        </span>
        <span class="cloud-sep" style="flex-shrink:0;">|</span>
        <span class="cloud-item" title="${midLabel}"><span class="cloud-label">${midLabel}</span>: <strong class="cloud-value">${mid.toFixed(0)}%</strong>
          <span class="cloud-mini-bar-track"><span class="cloud-mini-bar-fill" style="width:${Math.min(mid,100)}%;background:var(--cloud-mid-color);"></span></span>
        </span>
        <span class="cloud-sep" style="flex-shrink:0;">|</span>
        <span class="cloud-item" title="${lowLabel}"><span class="cloud-label">${lowLabel}</span>: <strong class="cloud-value">${low.toFixed(0)}%</strong>
          <span class="cloud-mini-bar-track"><span class="cloud-mini-bar-fill" style="width:${Math.min(low,100)}%;background:var(--cloud-low-color);"></span></span>
        </span>
      </div>
    `;
  }

  /**
   * 更新未来预测时间线
   * @param {Array} predictions - 预测数据数组
   * @private
   */
  updateForecastTimeline(predictions) {
    const forecastSection = document.getElementById('forecast-section');
    const forecastTimeline = document.getElementById('forecast-timeline');
    const forecastLoading = document.getElementById('forecast-loading');

    if (!forecastTimeline) {
      console.error('未找到预测时间线元素');
      return;
    }

    // 按日期分组预测
    const predictionsByDate = {};
    predictions.forEach(prediction => {
      const dateKey = prediction.date.toDateString();
      if (!predictionsByDate[dateKey]) {
        predictionsByDate[dateKey] = {
          date: prediction.date,
          sunrise: null,
          sunset: null
        };
      }
      if (prediction.type === 'sunrise') {
        predictionsByDate[dateKey].sunrise = prediction;
      } else {
        predictionsByDate[dateKey].sunset = prediction;
      }
    });

    // 只取前3天的数据（不包括今天），因为"今日预测"已经在上方单独显示了
    const daysToShow = Object.values(predictionsByDate).slice(1, 4);

    // 如果没有未来预测，隐藏整个区域
    if (daysToShow.length === 0) {
      forecastTimeline.dataset.loaded = 'true';
      if (forecastLoading) forecastLoading.classList.add('hidden');
      if (forecastSection) forecastSection.classList.add('hidden');
      return;
    }

    const now = new Date();

    // 构建横向排列的时间线HTML
    let html = '<div class="forecast-horizontal-container">';

    daysToShow.forEach((dayPredictions, index) => {
      const dateStr = this.formatDate(dayPredictions.date);
      const dayLabel = index === 0 ? this.i18n.t('time.tomorrow') :
                        index === 1 ? this.i18n.t('time.dayAfterTomorrow') :
                        this.i18n.t('time.daysLater', { days: index + 1 });

      const qualityTextMap = this._isEnglishUI()
        ? { excellent: 'Excellent', good: 'Good', fair: 'Fair', poor: 'Poor' }
        : { excellent: '极佳', good: '良好', fair: '一般', poor: '较差' };
      const scoreSuffix = this._uiText(' pts', '分');

      // 朝霞行
      let sunriseRow = '';
      if (dayPredictions.sunrise) {
        const pred = dayPredictions.sunrise;
        const sunriseTime = pred.sunriseTime || pred.sunsetTime;
        const isPassed = sunriseTime ? now > new Date(sunriseTime.getTime() + EVENT_PASSED_BUFFER_MS) : false;
        const score = Math.round(pred.score ?? 0);
        const scoreQuality = this.getQualityFromScore(score);
        const quality = qualityTextMap[scoreQuality] ?? '较差';
        sunriseRow = `
          <div class="fcard-row-item ${isPassed ? 'passed' : ''}" data-index="${predictions.indexOf(pred)}">
            <span class="fcard-row-icon">${this.renderSunEventIcon('sunrise', 'sun-event-icon fcard-sun-event-icon')}</span>
            <span class="fcard-row-label">${this.i18n.t('prediction.sunrise')}</span>
            <span class="fcard-row-score quality-${scoreQuality}" title="${quality}">${score}${scoreSuffix}</span>
          </div>`;
      }

      // 晚霞行
      let sunsetRow = '';
      if (dayPredictions.sunset) {
        const pred = dayPredictions.sunset;
        const sunsetTime = pred.sunsetTime;
        const isPassed = sunsetTime ? now > new Date(sunsetTime.getTime() + EVENT_PASSED_BUFFER_MS) : false;
        const score = Math.round(pred.score ?? 0);
        const scoreQuality = this.getQualityFromScore(score);
        const quality = qualityTextMap[scoreQuality] ?? '较差';
        sunsetRow = `
          <div class="fcard-row-item ${isPassed ? 'passed' : ''}" data-index="${predictions.indexOf(dayPredictions.sunset)}">
            <span class="fcard-row-icon">${this.renderSunEventIcon('sunset', 'sun-event-icon fcard-sun-event-icon')}</span>
            <span class="fcard-row-label">${this.i18n.t('prediction.sunset')}</span>
            <span class="fcard-row-score quality-${scoreQuality}" title="${quality}">${score}${scoreSuffix}</span>
          </div>`;
      }

      html += `
        <div class="forecast-day-card">
          <div class="fcard-day-label">${dayLabel}</div>
          <div class="fcard-day-date">${dateStr}</div>
          <div class="fcard-day-rows">
            ${sunriseRow}
            ${sunsetRow}
          </div>
        </div>
      `;
    });

    html += '</div>';

    forecastTimeline.innerHTML = html;
    forecastTimeline.dataset.loaded = 'true';
    if (forecastLoading) forecastLoading.classList.add('hidden');

    // 旧版独立未来预测区仍存在时才显示；新版已合入天气信息 tab，不主动切走当前视图。
    if (forecastSection) {
      forecastSection.classList.remove('hidden');
    }

    console.log('[PredictionController] 预测时间线已更新（横向排列）');
  }

  /**
   * 渲染单个影响因素
   * @param {string} name - 因素名称
   * @param {number} score - 评分
   * @param {string} value - 值
   * @returns {string} HTML字符串
   * @private
   */
  renderFactor(name, score, value) {
    const percentage = (score / 100) * 100;
    return `
      <div class="factor-item">
        <div class="factor-header">
          <span class="factor-name">${name}</span>
          <span class="factor-value">${value}</span>
        </div>
        <div class="factor-bar">
          <div class="factor-bar-fill" style="width: ${percentage}%"></div>
        </div>
        <div class="factor-score">${score.toFixed(0)}/100</div>
      </div>
    `;
  }

  /**
   * 获取质量等级对应的CSS类
   * @param {string} quality - 质量等级
   * @returns {string} CSS类名
   * @private
   */
  getQualityClass(quality) {
    const qualityMap = {
      'excellent': 'quality-excellent',
      'good': 'quality-good',
      'fair': 'quality-fair',
      'poor': 'quality-poor'
    };
    return qualityMap[quality] || 'quality-fair';
  }

  /**
   * 获取质量等级标签
   * @param {string} quality - 质量等级
   * @returns {string} 标签文本
   * @private
   */
  getQualityLabel(quality) {
    return this.i18n.t(`prediction.${quality}`) || this.i18n.t('prediction.fair');
  }

  /**
   * 格式化时间
   * @param {Date|string} time - 时间
   * @returns {string} 格式化后的时间字符串
   * @private
   */
  formatTime(time, timeZone = null) {
    try {
      if (time === null || time === undefined) return '--:--';
      const date = typeof time === 'string' ? new Date(time) : time;
      if (!date || isNaN(date.getTime())) {
        return '--:--';
      }
      if (timeZone) {
        return new Intl.DateTimeFormat(this.i18n.getLanguage(), {
          timeZone,
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }).format(date);
      }
      // 兼容无目标时区的旧数据
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    } catch (error) {
      console.error('格式化时间失败:', error);
      return '--:--';
    }
  }

  /**
   * 格式化日期
   * @param {Date} date - 日期
   * @returns {string} 格式化后的日期字符串
   * @private
   */
  formatDate(date) {
    try {
      // 使用当前语言环境的日期格式
      const locale = this.i18n.getLanguage();
      const formatter = new Intl.DateTimeFormat(locale, {
        month: '2-digit',
        day: '2-digit'
      });
      return formatter.format(date);
    } catch (error) {
      console.error('格式化日期失败:', error);
      return '';
    }
  }

  /**
   * 格式化日落时间
   * 
   * @param {string|Date} sunsetTime - 日落时间
   * @returns {string} 格式化后的时间字符串
   * @private
   */
  formatSunsetTime(sunsetTime) {
    try {
      const date = typeof sunsetTime === 'string' ? new Date(sunsetTime) : sunsetTime;

      if (isNaN(date.getTime())) {
        return sunsetTime.toString();
      }

      // 使用本地时间方法获取小时和分钟（天文学计算已经返回本地时间）
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');

      return `${hours}:${minutes}`;
    } catch (error) {
      console.error('格式化日落时间失败:', error);
      return sunsetTime.toString();
    }
  }

  /**
   * 显示错误消息
   *
   * @param {string} message - 错误消息
   * @private
   */
  showError(message) {
    const errorElement = document.getElementById('error-message');
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.style.display = 'block';
      errorElement.className = 'error-message show';

      // 3秒后自动隐藏
      setTimeout(() => {
        errorElement.style.display = 'none';
        errorElement.className = 'error-message';
      }, 3000);
    } else {
      console.error(message);
    }
  }

  /**
   * 刷新界面文本（语言切换后）
   * 需求：14 - 多语言支持
   */
  refreshUIText() {
    console.log('[PredictionController] 刷新界面文本...');

    // 更新预测区域标题
    const predictionSection = document.getElementById('prediction-section');
    if (predictionSection) {
      const title = predictionSection.querySelector('h2');
      if (title) title.textContent = this.i18n.t('prediction.title');
    }

    // 如果有当前预测数据，重新生成status和description以更新翻译
    if (this.predictions && this.predictions.length > 0) {
      // 遍历所有预测并重新生成翻译后的文本
      this.predictions.forEach(prediction => {
        if (prediction.canvasAnalysis && prediction.lightPathAnalysis && prediction.renderingAnalysis) {
          // 重新调用calculateFinalScore来获取新语言的status和description
          const finalResult = this.enhancedPredictionService.calculateFinalScore(
            prediction.canvasAnalysis,
            prediction.lightPathAnalysis,
            prediction.renderingAnalysis,
            prediction.type // 传递正确的类型（sunrise/sunset）
          );
          // 更新预测对象中的文本字段
          prediction.status = finalResult.status;
          prediction.description = finalResult.description;
          prediction.advice = finalResult.advice;
        }
      });

      // 新版预测卡没有 compact-analysis 旧 DOM；语言切换时直接重渲染，避免维护死路径。
      this.updatePredictionDisplay(this.predictions);
    }
  }
}

export default PredictionController;
