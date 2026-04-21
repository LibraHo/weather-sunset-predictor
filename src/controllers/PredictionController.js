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
 * 分享面板组件
 */
class SharePanel {
  constructor() {
    this.panel = null;
    this.isOpen = false;
    this.i18n = i18n;
    this.currentPrediction = null;
  }

  /**
   * 创建分享面板 DOM
   */
  createPanel() {
    const panel = document.createElement('div');
    panel.id = 'share-panel';
    panel.className = 'share-panel hidden';
    panel.innerHTML = `
      <div class="share-overlay"></div>
      <div class="share-container">
        <div class="share-header">
          <h3>${this.i18n.t('share.panelTitle')}</h3>
          <button class="share-close" aria-label="${this.i18n.t('buttons.close')}">✕</button>
        </div>
        <div class="share-content">
          <button class="share-btn share-btn-save" data-action="save">
            <svg class="share-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            <span>${this.i18n.t('share.saveImage')}</span>
          </button>
          <button class="share-btn share-btn-copy" data-action="copy">
            <svg class="share-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            <span>${this.i18n.t('share.copyLink')}</span>
          </button>
          <button class="share-btn share-btn-native hidden" data-action="native">
            <svg class="share-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="18" cy="5" r="3"/>
              <circle cx="6" cy="12" r="3"/>
              <circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
            <span>${this.i18n.t('share.nativeShare')}</span>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(panel);
    this.panel = panel;
    this.attachEventListeners();
  }

  /**
   * 绑定事件监听器
   */
  attachEventListeners() {
    // 关闭按钮
    const closeBtn = this.panel.querySelector('.share-close');
    closeBtn.addEventListener('click', () => this.close());

    // 点击遮罩关闭
    const overlay = this.panel.querySelector('.share-overlay');
    overlay.addEventListener('click', () => this.close());

    // 保存图片按钮
    const saveBtn = this.panel.querySelector('[data-action="save"]');
    saveBtn.addEventListener('click', () => this.handleSaveImage());

    // 复制链接按钮
    const copyBtn = this.panel.querySelector('[data-action="copy"]');
    copyBtn.addEventListener('click', () => this.handleCopyLink());

    // 原生分享按钮
    const nativeBtn = this.panel.querySelector('[data-action="native"]');
    if (nativeBtn && navigator.share) {
      nativeBtn.classList.remove('hidden');
      nativeBtn.addEventListener('click', () => this.handleNativeShare());
    }
  }

  /**
   * 打开分享面板
   * @param {Object} prediction - 预测数据
   */
  open(prediction) {
    if (!this.panel) {
      this.createPanel();
    }
    this.currentPrediction = prediction;
    this.panel.classList.remove('hidden');
    this.isOpen = true;

    // 检查原生分享支持
    const nativeBtn = this.panel.querySelector('[data-action="native"]');
    if (nativeBtn) {
      if (navigator.share) {
        nativeBtn.classList.remove('hidden');
      } else {
        nativeBtn.classList.add('hidden');
      }
    }
  }

  /**
   * 关闭分享面板
   */
  close() {
    if (this.panel) {
      this.panel.classList.add('hidden');
    }
    this.isOpen = false;
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

      const blob = await generateShareCard(prediction, locationName, period);

      // 下载
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `sunset-${period}-${Date.now()}.png`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);

      this.showToast('图片已保存');
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
          const blob = await generateShareCard(prediction, locationName, period);
          const file = new File([blob], `霞客-${period === 'sunrise' ? '朝霞' : '晚霞'}预测.png`, { type: 'image/png' });

          await navigator.share({
            title: shareText,
            text: shareText,
            files: [file],
          });
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
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('原生分享失败:', error);
        this.showToast('分享失败');
      }
    }
    this.close();
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

    // 初始化后端 API 服务
    this.predictionAPIService = new PredictionAPIService(config.proxy.url);
    console.log('[PredictionController] 功能开关:', this.features);

    // 统一评分通过 predictionService._calculateUnifiedScore() 调用
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
  async _calculatePredictionWithBackend(weatherData, date, lat, lon, type) {
    // 检查是否启用后端基础预测
    if (this.features.USE_BACKEND_PREDICTION) {
      try {
        console.log(`[PredictionController] 使用后端 API 计算预测 (${type})`);
        return await this.predictionAPIService.calculate(weatherData, date, lat, lon, type);
      } catch (error) {
        console.error(`[PredictionController] 后端 API 调用失败（已禁用本地旧算法回退）:`, error.message);
        throw error;
      }
    } else {
      // 使用前端计算
      return this.predictionService.calculatePrediction(weatherData, date, lat, lon, type);
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
      prediction.sunAzimuth = this.predictionService.getSunAzimuth(baseDate, referenceTime, lat, lon);
    }

    if (!prediction.getAzimuthDirection) {
      prediction.getAzimuthDirection = () => {
        if (prediction.sunAzimuth === null || prediction.sunAzimuth === undefined) return '';

        const directions = [
          '北', '东北偏北', '东北', '东北偏东',
          '东', '东南偏东', '东南', '东南偏南',
          '南', '西南偏南', '西南', '西南偏西',
          '西', '西北偏西', '西北', '西北偏北'
        ];

        const index = Math.round(prediction.sunAzimuth / 22.5) % 16;
        return directions[index];
      };
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

    // 输出天气数据范围信息
    if (weatherDataArray.length > 0) {
      const firstDataTime = new Date(weatherDataArray[0].timestamp);
      const lastDataTime = new Date(weatherDataArray[weatherDataArray.length - 1].timestamp);
      console.log(`[PredictionController] 天气数据时间范围: ${firstDataTime.toLocaleString('zh-CN')} 到 ${lastDataTime.toLocaleString('zh-CN')}`);
    }

    const predictions = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 为未来5天生成预测
    for (let i = 0; i < 5; i++) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + i);

      console.log(`[PredictionController] 处理第 ${i} 天:`, targetDate);

      try {
        // 1. 生成日出（朝霞）预测
        const sunriseTime = this.predictionService.getSunriseTime(
          targetDate,
          location.lat,
          location.lon
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
            'sunrise'
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
          // 确保 sunriseTime 字段有值（渲染层用 type===sunrise 时取 sunriseTime）
          if (!sunrisePrediction.sunriseTime) {
            sunrisePrediction.sunriseTime = sunriseTime;
          }

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
                highClouds: { value: sunriseWeatherData.highClouds, name: '高云量', unit: '%' }
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
          location.lon
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
            'sunset'
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
          sunsetPrediction.sunsetTime = sunsetTime; // 用于显示日落时间

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
                highClouds: { value: sunsetWeatherData.highClouds, name: '高云量', unit: '%' }
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
      }
    }

    console.log(`[PredictionController] 生成了 ${predictions.length} 个预测`);
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
      const sunriseEndTime = new Date(sunriseTime.getTime() + 2 * 60 * 60 * 1000);
      if (now > sunriseEndTime) {
        console.log('[PredictionController] 今日朝霞时间已过，切换到明天的朝霞预测');
        displaySunrise = tomorrowSunrise;
        sunriseTime = tomorrowSunrise ? tomorrowSunrise.sunriseTime : null;
      }
    }

    // 晚霞时间检查 - 独立判断
    if (sunsetTime && todaySunset) {
      const sunsetEndTime = new Date(sunsetTime.getTime() + 1.5 * 60 * 60 * 1000);
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
   * - 日落后 → 显示明日朝霞 + 明日晚霞（默认明日朝霞）
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
    const isAfterSunset = sunsetTime && now > new Date(sunsetTime.getTime() + 1.5 * 60 * 60 * 1000); // 日落后1.5小时

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
    const sunriseCardHtml = displaySunrise
      ? this.renderSinglePrediction(displaySunrise, '🌄', this.i18n.t('prediction.sunrise'), this.i18n.t('prediction.sunriseTime'), sunriseDateLabel, 'sunrise')
      : `<div class="prediction-unavailable-card">
          <span class="prediction-date-badge">${sunriseDateLabel}</span>
          <h3>🌄 ${this.i18n.t('prediction.sunrise')}</h3>
          <p class="unavailable-reason">${this.i18n.t('prediction.predictionUnavailable')}</p>
          <p class="hint-text">${this.i18n.t('prediction.viewFutureOrRefresh')}</p>
        </div>`;

    // 生成晚霞卡片 HTML
    const sunsetCardHtml = displaySunset
      ? this.renderSinglePrediction(displaySunset, '🌅', this.i18n.t('prediction.sunset'), this.i18n.t('prediction.sunsetTime'), sunsetDateLabel, 'sunset')
      : `<div class="prediction-unavailable-card">
          <span class="prediction-date-badge">${sunsetDateLabel}</span>
          <h3>🌅 ${this.i18n.t('prediction.sunset')}</h3>
          <p class="unavailable-reason">${this.i18n.t('prediction.predictionUnavailable')}</p>
          <p class="hint-text">${this.i18n.t('prediction.viewFutureOrRefresh')}</p>
        </div>`;

    // 手机版默认显示哪个
    const defaultTab = displayConfig.activeTab;

    // 渲染带切换开关的布局
    const html = `
      <div class="prediction-toggle-bar" id="prediction-toggle-bar">
        <button class="prediction-toggle-btn${defaultTab === 'sunrise' ? ' active' : ''}" data-tab="sunrise">
          🌄 ${sunriseDateLabel}${this.i18n.t('prediction.sunrise')}
        </button>
        <button class="prediction-toggle-btn${defaultTab === 'sunset' ? ' active' : ''}" data-tab="sunset">
          🌅 ${sunsetDateLabel}${this.i18n.t('prediction.sunset')}
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

    // 绑定分享按钮事件
    const shareButtons = predictionDisplay.querySelectorAll('.prediction-share-btn');
    shareButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const type = btn.dataset.type;
        const prediction = type === 'sunrise' ? displaySunrise : displaySunset;
        if (prediction) {
          getSharePanel().open(prediction);
        }
      });
    });

    // 显示预测部分
    if (predictionSection) {
      predictionSection.classList.remove('hidden');
    }

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
  renderSinglePrediction(prediction, icon, title, timeLabel, dateLabel = '今日', type = 'sunset') {
    const viewingWindow = prediction.getOptimalViewingWindow();
    const analysis = this.generateAnalysisText(prediction, dateLabel, prediction.cloudLayers);

    // 任务 13.5：添加黄金时段、蓝调时段、太阳方位角、云层分层显示
    // 需求12.2/12.3：顺序逻辑 — 日出：蓝调先→黄金后；日落：黄金先→蓝调后
    let enhancedInfo = '';

    const goldenLabel = this.i18n.t('prediction.goldenHour');
    const blueLabel = this.i18n.t('prediction.blueHour');

    const goldenRow = prediction.goldenHour
      ? `<div class="compact-extra-time compact-extra-golden"><span class="hour-label">${goldenLabel}</span><span class="hour-time">${this.formatTime(prediction.goldenHour.start)}–${this.formatTime(prediction.goldenHour.end)}</span></div>`
      : '';
    const blueRow = prediction.blueHour
      ? `<div class="compact-extra-time compact-extra-blue"><span class="hour-label">${blueLabel}</span><span class="hour-time">${this.formatTime(prediction.blueHour.start)}–${this.formatTime(prediction.blueHour.end)}</span></div>`
      : '';

    // 日出：蓝调 → 黄金（时间升序）；日落：黄金 → 蓝调（时间升序）
    if (type === 'sunrise') {
      enhancedInfo = blueRow + goldenRow;
    } else {
      enhancedInfo = goldenRow + blueRow;
    }

    // 太阳方位角（需求12.5：有方位角就显示）
    const shouldShowAzimuth = prediction.shouldShowAzimuth
      ? prediction.shouldShowAzimuth()
      : prediction.sunAzimuth !== null && prediction.sunAzimuth !== undefined;

    if (shouldShowAzimuth) {
      const direction = this.getLocalizedAzimuthDirection(prediction);
      const directionLabel = type === 'sunrise'
        ? this.i18n.t('prediction.sunriseDirectionLabel')
        : this.i18n.t('prediction.sunsetDirectionLabel');
      enhancedInfo += `
        <div class="compact-extra-time compact-extra-azimuth">
          <span class="azimuth-line-label">${directionLabel} :</span>
          <span class="azimuth-line-value">${direction}</span>
          <span class="azimuth-direction-icon" style="transform: rotate(${prediction.sunAzimuth}deg);" aria-hidden="true">↑</span>
        </div>
      `;
    }

    // 云层分层信息（需求12.11）- 只显示云层数据，不显示description
    let cloudLayersHtml = '';
    if (prediction.cloudLayers) {
      cloudLayersHtml = this.renderCloudLayers(prediction.cloudLayers);
    }

    // 分析文本：第一句加粗
    const firstBr = analysis.indexOf('<br>');
    const formattedAnalysis = firstBr > -1
      ? `<strong>${analysis.substring(0, firstBr)}</strong>${analysis.substring(firstBr)}`
      : `<strong>${analysis}</strong>`;

    // 现代圆形仪表盘评分：SVG 圆弧 + 渐变色
    const score = prediction.score;
    const qualityClass = this.getQualityClass(prediction.quality);
    const qualityLabel = this.getQualityLabel(prediction.quality);

    // SVG 圆弧参数
    const radius = 36;
    const circumference = 2 * Math.PI * radius;
    const arcLength = circumference * 0.75; // 仪表盘 270° 弧度
    const scoreFill = arcLength * (score / 100);
    const scoreGap = arcLength - scoreFill;
    // 颜色：poor→红, fair→橙, good→黄绿, excellent→绿
    const gaugeColor = prediction.quality === 'excellent' ? '#22c55e'
      : prediction.quality === 'good' ? '#f59e0b'
      : prediction.quality === 'fair' ? '#f97316'
      : '#ef4444';

    const svgGauge = `
      <svg class="score-gauge-svg" viewBox="0 0 96 96" width="96" height="96">
        <defs>
          <linearGradient id="gauge-grad-${type}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="${gaugeColor}" stop-opacity="0.7"/>
            <stop offset="100%" stop-color="${gaugeColor}" stop-opacity="1"/>
          </linearGradient>
        </defs>
        <!-- 轨道背景 -->
        <circle cx="48" cy="48" r="${radius}"
          fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="8"
          stroke-dasharray="${arcLength} ${circumference - arcLength}"
          stroke-dashoffset="${circumference * 0.125}"
          stroke-linecap="butt"/>
        <!-- 进度弧 -->
        <circle cx="48" cy="48" r="${radius}"
          fill="none" stroke="url(#gauge-grad-${type})" stroke-width="8"
          stroke-dasharray="${scoreFill.toFixed(2)} ${scoreGap.toFixed(2) + circumference * 0.25}"
          stroke-dashoffset="${circumference * 0.125}"
          stroke-linecap="butt"
          style="filter:drop-shadow(0 0 6px ${gaugeColor}88)"/>
        <!-- 分数数字 -->
        <text x="48" y="46" text-anchor="middle" dominant-baseline="middle"
          font-size="20" font-weight="800" fill="${gaugeColor}">${score.toFixed(0)}</text>
        <!-- 满分标注 -->
        <text x="48" y="63" text-anchor="middle"
          font-size="9" font-weight="600" fill="rgba(255,255,255,0.45)">/100</text>
      </svg>`;

    // 分享按钮 SVG 图标
    const shareIconSvg = `
      <svg class="share-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
        <polyline points="16 6 12 2 8 6"/>
        <line x1="12" y1="2" x2="12" y2="15"/>
      </svg>
    `;

    return `
      <div class="prediction-card ${qualityClass}" data-type="${type}">
        <div class="prediction-header">
          <span class="prediction-date-badge">${dateLabel}</span>
          <h3>${icon} ${title}</h3>
          <button class="prediction-share-btn" data-type="${type}" aria-label="${this.i18n.t('share.title')}">
            ${shareIconSvg}
          </button>
        </div>
        <div class="prediction-dashboard-row">
          <div class="score-gauge-wrap ${qualityClass}">
            ${svgGauge}
            <span class="score-gauge-label" style="color:${gaugeColor}">${qualityLabel}</span>
          </div>
          <div class="time-display">
            <div class="main-time">${this.formatTime(type === 'sunrise' ? (prediction.sunriseTime || prediction.sunsetTime) : prediction.sunsetTime)}</div>
            <div class="viewing-time"><span class="viewing-time-label">${this.i18n.t('prediction.bestViewingTime')}</span>: <span class="viewing-time-range">${this.formatTime(viewingWindow.start)}–${this.formatTime(viewingWindow.end)}</span></div>
            ${enhancedInfo}
          </div>
        </div>
        ${cloudLayersHtml}
        <div class="compact-analysis">${formattedAnalysis}</div>
        <div id="radar-compass-${type}" style="margin-top:12px;display:none;"></div>
      </div>
    `;
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

    const language = this.i18n?.currentLanguage || 'zh-CN';
    const directions = language === 'en-US'
      ? [
        'N', 'NNE', 'NE', 'ENE',
        'E', 'ESE', 'SE', 'SSE',
        'S', 'SSW', 'SW', 'WSW',
        'W', 'WNW', 'NW', 'NNW'
      ]
      : [
        '北', '东北偏北', '东北', '东北偏东',
        '东', '东南偏东', '东南', '东南偏南',
        '南', '西南偏南', '西南', '西南偏西',
        '西', '西北偏西', '西北', '西北偏北'
      ];

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

    const highLabel = normalizeLabel(this.i18n.t('prediction.cloudLayers.shortHigh'), 'High');
    const midLabel = normalizeLabel(this.i18n.t('prediction.cloudLayers.shortMid'), 'Mid');
    const lowLabel = normalizeLabel(this.i18n.t('prediction.cloudLayers.shortLow'), 'Low');

    return `
      <div class="compact-cloud-info" style="display:flex;align-items:center;flex-wrap:nowrap;gap:4px;width:100%;overflow:hidden;">
        <span class="cloud-icon" style="flex-shrink:0;">☁️</span>
        <span class="cloud-item" style="flex:1 1 0;min-width:0;" title="${highLabel}"><span class="cloud-label">${highLabel}</span>: <strong class="cloud-value">${high.toFixed(0)}%</strong>
          <span class="cloud-mini-bar-track"><span class="cloud-mini-bar-fill" style="width:${Math.min(high,100)}%;background:#90caf9;"></span></span>
        </span>
        </span>
        <span class="cloud-sep" style="flex-shrink:0;">|</span>
        <span class="cloud-item" style="flex:1 1 0;min-width:0;" title="${midLabel}"><span class="cloud-label">${midLabel}</span>: <strong class="cloud-value">${mid.toFixed(0)}%</strong>
          <span class="cloud-mini-bar-track"><span class="cloud-mini-bar-fill" style="width:${Math.min(mid,100)}%;background:#64b5f6;"></span></span>
        </span>
        <span class="cloud-sep" style="flex-shrink:0;">|</span>
        <span class="cloud-item" style="flex:1 1 0;min-width:0;" title="${lowLabel}"><span class="cloud-label">${lowLabel}</span>: <strong class="cloud-value">${low.toFixed(0)}%</strong>
          <span class="cloud-mini-bar-track"><span class="cloud-mini-bar-fill" style="width:${Math.min(low,100)}%;background:#42a5f5;"></span></span>
        </span>
      </div>
    `;
  }

  /**
   * 生成预测分析文字
   * @param {Object} prediction - 预测数据
   * @param {string} dateLabel - 日期标签（今日/明日）
   * @param {Object} cloudLayers - 云层分层数据（可选）
   * @returns {string} 分析文字
   * @private
   */
  generateAnalysisText(prediction, dateLabel = '今日', cloudLayers = null) {
    // 检查是否是增强版预测（包含canvasAnalysis等增强版特有字段）
    const isEnhanced = prediction.canvasAnalysis && prediction.lightPathAnalysis && prediction.renderingAnalysis;

    if (isEnhanced) {
      return this.generateEnhancedAnalysisText(prediction, dateLabel);
    }

    // 旧版预测逻辑
    const factors = prediction.factors;
    const cloudValue = factors.cloudCover?.value ?? 50;
    const humidityValue = factors.humidity?.value ?? 50;
    const visibilityValue = factors.visibility?.value ?? 10;
    const lowCloudsValue = factors.lowClouds?.value ?? 0;
    const precipitationValue = factors.precipitation?.value ?? 0;
    const weatherCodeValue = factors.weatherCode?.value ?? null;

    let analysis = '';

    // 总体评价
    if (prediction.score >= 80) {
      analysis += `${dateLabel}的气象条件非常适合观赏${prediction.typeName || '晚霞'}！<br><br>`;
    } else if (prediction.score >= 60) {
      analysis += `${dateLabel}的气象条件较为适合观赏${prediction.typeName || '晚霞'}。<br><br>`;
    } else if (prediction.score >= 40) {
      analysis += `${dateLabel}的气象条件一般。<br><br>`;
    } else {
      analysis += `${dateLabel}的气象条件不太理想。<br><br>`;
    }

    // 火烧云专项分析 —— 传入完整天气数据（含高云/中云），优先使用统一算法
    const fullWeatherData = {
      cloudCover:    cloudValue,
      highClouds:    factors.highClouds?.value ?? 0,
      midClouds:     factors.midClouds?.value  ?? 0,
      lowClouds:     lowCloudsValue,
      visibility:    visibilityValue,
      humidity:      humidityValue,
      precipitation: precipitationValue
    };
    analysis += this.generateFireCloudAnalysis(cloudValue, humidityValue, visibilityValue, lowCloudsValue, precipitationValue, weatherCodeValue, fullWeatherData, prediction.score);

    return analysis;
  }

  /**
   * 生成增强版预测的分析文本
   * @param {Object} prediction - 增强版预测数据
   * @param {string} dateLabel - 日期标签
   * @returns {string} 分析文本
   * @private
   */
  generateEnhancedAnalysisText(prediction, dateLabel = '今日') {
    const canvas = prediction.canvasAnalysis;
    const lightPath = prediction.lightPathAnalysis;
    const rendering = prediction.renderingAnalysis;

    let analysis = '';

    // 总体评价（使用增强版的状态描述）
    if (prediction.status) {
      analysis += `<strong>${prediction.icon} ${prediction.status}</strong><br><br>`;
      analysis += `${prediction.description}<br>`;
    }

    // 简化版画布评分
    analysis += `<div style="margin-top:8px;font-size:13px;">`;
    analysis += this.i18n.t('prediction.canvas.canvasScore', {
      score: canvas.score.toFixed(0),
      level: canvas.cloudLevel
    }) + '<br>';
    analysis += `   ${this.i18n.t('prediction.canvas.cloudBreakdown', {
      high: canvas.breakdown.highClouds,
      mid: canvas.breakdown.midClouds,
      low: canvas.breakdown.lowClouds
    })}`;
    if (canvas.lowCloudPenalty < 1.0) {
      analysis += this.i18n.t('prediction.canvas.lowCloudPenalty', {
        reason: canvas.penaltyReason
      });
    }
    analysis += `</div>`;

    // 简化版光路评分
    analysis += `<div style="margin-top:8px;font-size:13px;">`;
    analysis += this.i18n.t('prediction.lightPath.lightPathScore', {
      score: lightPath.score.toFixed(0)
    });
    // 展示封顶原因
    if (lightPath.capReason) {
      const capText = lightPath.capReason === 'overcast_cap_40'
        ? '⛅ 阴天封顶 ≤40'
        : lightPath.capReason === 'precipitation_cap_50'
          ? '🌧 降水封顶 ≤50'
          : lightPath.capReason;
      analysis += `<br><span style="color:#ff9800;font-size:12px;">${capText}</span>`;
    } else if (lightPath.explain && lightPath.explain !== '光路通畅') {
      analysis += `<br><span style="color:#aaa;font-size:12px;">${lightPath.explain}</span>`;
    }
    if (prediction.severeWeatherCap?.reason) {
      analysis += `<br>⛔ ${prediction.severeWeatherCap.reason}`;
    }
    analysis += `</div>`;

    // 简化版渲染修正
    analysis += `<div style="margin-top:8px;font-size:13px;">`;
    analysis += this.i18n.t('prediction.rendering.renderingFactor', {
      factor: rendering.factor.toFixed(2),
      visibility: rendering.breakdown.visibility,
      aqi: rendering.breakdown.aqi,
      color: rendering.breakdown.colorTendency
    });
    if (rendering.breakdown.specialMode) {
      analysis += this.i18n.t('prediction.rendering.specialMode', {
        mode: rendering.breakdown.specialMode
      });
    }
    analysis += `</div>`;

    // 云厚评估（Phase 22）
    if (prediction.cloudThickness) {
      const ct = prediction.cloudThickness;
      const ctIcon = ct.thickness === 'thin' ? '🌤' : ct.thickness === 'thick' ? '🌫' : ct.thickness === 'moderate' ? '☁' : '❓';
      const ctLabel = this.i18n.t(`prediction.cloudThickness.${ct.thickness}`);
      const ctDesc = this.i18n.t(`prediction.cloudThickness.${ct.thickness}Desc`);
      analysis += `<div style="margin-top:8px;font-size:13px;">`;
      analysis += `${ctIcon} <strong>${this.i18n.t('prediction.cloudThickness.title')}</strong>: ${ctLabel}`;
      if (ct.thickness !== 'unknown') analysis += ` — ${ctDesc}`;
      // 显示原始数据
      const canvas = prediction.canvasAnalysis;
      if (canvas?.breakdown) {
        const parts = [];
        if (ct.reasons?.length) parts.push(`判定: ${ct.reasons.join(', ')}`);
        if (ct.modifier !== 1.0) parts.push(`修正: ×${ct.modifier}`);
        if (parts.length) analysis += `<br><span style="color:#888;font-size:11px;">${parts.join(' | ')}</span>`;
      }
      analysis += `</div>`;
    }

    return analysis;
  }

  /**
   * 生成火烧云专项分析（使用统一评分服务）
   *
   * @param {number} cloudValue      - 总云量百分比（兼容旧调用）
   * @param {number} humidityValue   - 湿度百分比
   * @param {number} visibilityValue - 能见度（km）
   * @param {number} lowCloudsValue  - 低层云百分比
   * @param {number} precipitation   - 降水 mm/h
   * @param {number|null} weatherCode - 天气代码（保留兼容）
   * @param {Object|null} fullWeatherData - 完整天气数据（含高云/中云），优先使用
   * @returns {string} 火烧云分析 HTML
   * @private
   */
  generateFireCloudAnalysis(cloudValue, humidityValue, visibilityValue, lowCloudsValue, precipitation = 0, weatherCode = null, fullWeatherData = null, predictionScore = null) {
    const weatherInput = fullWeatherData || {
      cloudCover:    cloudValue,
      highClouds:    0,
      midClouds:     0,
      lowClouds:     lowCloudsValue,
      visibility:    visibilityValue,
      humidity:      humidityValue,
      precipitation: precipitation
    };

    const result = this.predictionService._calculateUnifiedScore(weatherInput);
    const { breakdown } = result;
    // 优先用卡片显示的 prediction.score，避免自己重算跟卡片不一致
    const finalScore = predictionScore != null ? Math.round(predictionScore) : Math.round(result.score);

    let html = '<div class="fire-cloud-details">';
    html += '<div class="fca-title">🔥 火烧云形成条件分析：</div>';

    const r = (icon, text) => `<div class="fca-row">${icon} ${text}</div>`;

    // 高云 — 核心载体，阈值更细
    const hc = weatherInput.highClouds ?? 0;
    if (hc >= 60) {
      html += r('✅', `高层云充沛（${hc.toFixed(0)}%），色彩载体极为丰富，火烧云基础扎实`);
    } else if (hc >= 40) {
      html += r('✅', `高层云充足（${hc.toFixed(0)}%），色彩载体丰富`);
    } else if (hc >= 20) {
      html += r('ℹ️', `高层云适中（${hc.toFixed(0)}%），可形成火烧云但色彩可能偏淡`);
    } else if (hc >= 10) {
      html += r('⚠️', `高层云偏少（${hc.toFixed(0)}%），色彩载体有限，效果打折扣`);
    } else {
      html += r('❌', `高层云极少（${hc.toFixed(0)}%），缺少色彩载体`);
    }

    // 中云 — 辅助扩散
    const mc = weatherInput.midClouds ?? 0;
    if (mc >= 20 && mc <= 60) {
      html += r('✅', `中层云适中（${mc.toFixed(0)}%），利于色彩扩散和层次感`);
    } else if (hc >= 40 && mc < 10) {
      html += r('ℹ️', `中层云较少（${mc.toFixed(0)}%），但高层云充足可独立形成火烧云`);
    } else if (hc >= 40 && mc > 60) {
      html += r('⚠️', `中层云偏厚（${mc.toFixed(0)}%），高云充足影响不大，但层次可能偏灰`);
    } else if (mc >= 10 && mc < 20) {
      html += r('ℹ️', `中层云偏少（${mc.toFixed(0)}%），色彩扩散有限`);
    } else if (mc > 60) {
      html += r('⚠️', `中层云过厚（${mc.toFixed(0)}%），可能遮挡光线`);
    } else if (mc >= 1) {
      html += r('⚠️', `中层云不足（${mc.toFixed(0)}%），缺少色彩扩散层`);
    }
    // mc === 0 时不输出中云行，避免无信息噪音

    // 低云 — 遮挡因素
    const lc = weatherInput.lowClouds ?? 0;
    if (lc < 15) {
      html += r('✅', `低云稀少（${lc.toFixed(0)}%），不会遮挡火烧云`);
    } else if (lc < 30) {
      html += r('⚠️', `低云较多（${lc.toFixed(0)}%），可能部分遮挡低空色彩`);
    } else if (lc < 50) {
      html += r('❌', `低云较厚（${lc.toFixed(0)}%），遮挡风险较大`);
    } else {
      html += r('❌', `低云过厚（${lc.toFixed(0)}%），严重影响观赏`);
    }

    // 能见度
    const vis = weatherInput.visibility ?? 0;
    if (vis >= 20) {
      html += r('✅', `能见度极佳（${vis.toFixed(0)}km），视野通透`);
    } else if (vis >= 10) {
      html += r('✅', `能见度良好（${vis.toFixed(0)}km）`);
    } else if (vis >= 5) {
      html += r('⚠️', `能见度一般（${vis.toFixed(0)}km），色彩饱和度可能降低`);
    } else {
      html += r('❌', `能见度差（${vis.toFixed(0)}km），有雾霾影响`);
    }

    // 湿度
    const hum = weatherInput.humidity ?? 0;
    if (hum >= 40 && hum <= 70) {
      html += r('✅', `湿度适中（${hum.toFixed(0)}%），利于光线散射`);
    } else if ((hum >= 30 && hum < 40) || (hum > 70 && hum <= 80)) {
      const label = hum < 40 ? '略低' : '偏高';
      html += r('⚠️', `湿度${label}（${hum.toFixed(0)}%）`);
    } else {
      const label = hum < 30 ? '不足' : '过高';
      html += r('❌', `湿度${label}（${hum.toFixed(0)}%）`);
    }

    // 云层立体感 — 根据高云是否充足调整语气
    const layerCount = breakdown.layerDiversity.layerCount ?? 0;
    if (layerCount >= 3) {
      html += r('✅', '云层立体丰富，多层次火烧云可期');
    } else if (layerCount === 2) {
      html += r('ℹ️', '云层层次尚可，双色层搭配');
    } else if (hc >= 40) {
      // 单层但高云充足：不算差，只是缺层次
      html += r('ℹ️', '云层单一，但高云质量好，仍可形成色彩鲜明的火烧云');
    } else {
      html += r('⚠️', '云层单一，层次感不足');
    }

    // 降水
    const precip = weatherInput.precipitation ?? 0;
    if (precip >= 2) {
      html += r('❌', `降水较强（${precip.toFixed(1)}mm/h），基本无法观赏`);
    } else if (precip >= 0.5) {
      html += r('⚠️', `有降水（${precip.toFixed(1)}mm/h），火烧云概率降低`);
    } else if (precip >= 0.1) {
      html += r('⚠️', `轻微降水（${precip.toFixed(1)}mm/h），可能影响观赏`);
    }

    // 结语：直接用 predictionScore（卡片显示分），不再自己重算
    const hasCloudCarrier = hc >= 15 || mc >= 15;
    if (!hasCloudCarrier && finalScore < 40) {
      html += `<div class="fca-summary">😶 高云和中云几乎为零，缺少色彩载体，火烧云概率极低</div>`;
    } else if (finalScore >= 80) {
      if (layerCount >= 2) {
        html += `<div class="fca-summary fca-summary-great">✨ 极佳条件，强烈推荐出行观赏！</div>`;
      } else {
        html += `<div class="fca-summary fca-summary-great">✨ 条件优秀，色彩可期；云层单一，层次感略有不足</div>`;
      }
    } else if (finalScore >= 60) {
      if (layerCount >= 2) {
        html += `<div class="fca-summary fca-summary-good">✨ 条件不错，有较大概率出现壮观的火烧云</div>`;
      } else {
        html += `<div class="fca-summary fca-summary-good">✨ 条件不错，火烧云概率较高；云层层次稍欠，效果可能偏平面</div>`;
      }
    } else if (finalScore >= 40) {
      html += `<div class="fca-summary">💡 条件中等，火烧云概率一般，需看实际云层演变</div>`;
    } else {
      html += `<div class="fca-summary">😶 火烧云概率较低（${finalScore}分）</div>`;
    }

    html += '</div>';

    return html;
  }

  /**
   * 更新未来预测时间线
   * @param {Array} predictions - 预测数据数组
   * @private
   */
  updateForecastTimeline(predictions) {
    const forecastSection = document.getElementById('forecast-section');
    const forecastTimeline = document.getElementById('forecast-timeline');

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
      forecastSection.classList.add('hidden');
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

      const qualityTextMap = { excellent: '极佳', good: '良好', fair: '一般', poor: '较差' };

      // 朝霞行
      let sunriseRow = '';
      if (dayPredictions.sunrise) {
        const pred = dayPredictions.sunrise;
        const sunriseTime = pred.sunriseTime || pred.sunsetTime;
        const isPassed = sunriseTime ? now > new Date(sunriseTime.getTime() + 2 * 60 * 60 * 1000) : false;
        const score = Math.round(pred.score ?? 0);
        const quality = qualityTextMap[pred.quality] ?? '较差';
        sunriseRow = `
          <div class="fcard-row-item ${isPassed ? 'passed' : ''}" data-index="${predictions.indexOf(pred)}">
            <span class="fcard-row-icon">🌄</span>
            <span class="fcard-row-label">朝霞</span>
            <span class="fcard-row-score quality-${pred.quality}">${score}分</span>
          </div>`;
      }

      // 晚霞行
      let sunsetRow = '';
      if (dayPredictions.sunset) {
        const pred = dayPredictions.sunset;
        const sunsetTime = pred.sunsetTime;
        const isPassed = sunsetTime ? now > new Date(sunsetTime.getTime() + 1.5 * 60 * 60 * 1000) : false;
        const score = Math.round(pred.score ?? 0);
        const quality = qualityTextMap[pred.quality] ?? '较差';
        sunsetRow = `
          <div class="fcard-row-item ${isPassed ? 'passed' : ''}" data-index="${predictions.indexOf(dayPredictions.sunset)}">
            <span class="fcard-row-icon">🌅</span>
            <span class="fcard-row-label">晚霞</span>
            <span class="fcard-row-score quality-${pred.quality}">${score}分</span>
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

    // 显示预测时间线部分
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
  formatTime(time) {
    try {
      if (time === null || time === undefined) return '--:--';
      const date = typeof time === 'string' ? new Date(time) : time;
      if (!date || isNaN(date.getTime())) {
        return '--:--';
      }
      // 使用本地时间方法获取小时和分钟（天文学计算已经返回本地时间）
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

      // 优先原位更新文案，避免语言切换重建整块 DOM（导致雷达容器丢失）
      const cards = document.querySelectorAll('.prediction-card[data-type]');
      if (cards.length > 0) {
        this._refreshPredictionTextsInPlace();
      } else {
        // 回退：无卡片时再全量重渲染
        this.updatePredictionDisplay(this.predictions);
      }
    }
  }

  _refreshPredictionTextsInPlace() {
    const cards = document.querySelectorAll('.prediction-card[data-type]');
    cards.forEach((card) => {
      const type = card.dataset.type;
      const prediction = this.predictions.find(p => p?.type === type);
      if (!prediction) return;

      const titleEl = card.querySelector('.prediction-header h3');
      if (titleEl) {
        const icon = type === 'sunrise' ? '🌄' : '🌅';
        const title = type === 'sunrise' ? this.i18n.t('prediction.sunrise') : this.i18n.t('prediction.sunset');
        titleEl.textContent = `${icon} ${title}`;
      }

      const viewingLabel = card.querySelector('.viewing-time-label');
      if (viewingLabel) viewingLabel.textContent = this.i18n.t('prediction.bestViewingTime');

      const golden = card.querySelector('.compact-extra-golden .hour-label');
      if (golden) golden.textContent = this.i18n.t('prediction.goldenHour');

      const blue = card.querySelector('.compact-extra-blue .hour-label');
      if (blue) blue.textContent = this.i18n.t('prediction.blueHour');

      const azimuthLabel = card.querySelector('.compact-extra-azimuth .azimuth-line-label');
      if (azimuthLabel) {
        azimuthLabel.textContent = type === 'sunrise'
          ? `${this.i18n.t('prediction.sunriseDirectionLabel')} :`
          : `${this.i18n.t('prediction.sunsetDirectionLabel')} :`;
      }

      const qualityLabel = card.querySelector('.score-gauge-label');
      if (qualityLabel) qualityLabel.textContent = this.getQualityLabel(prediction.quality);

      const analysis = this.generateAnalysisText(prediction, '', prediction.cloudLayers);
      const firstBr = analysis.indexOf('<br>');
      const formattedAnalysis = firstBr > -1
        ? `<strong>${analysis.substring(0, firstBr)}</strong>${analysis.substring(firstBr)}`
        : `<strong>${analysis}</strong>`;
      const analysisEl = card.querySelector('.compact-analysis');
      if (analysisEl) analysisEl.innerHTML = formattedAnalysis;
    });

    // 顶部切换按钮文本
    const sunriseBtn = document.querySelector('.prediction-toggle-btn[data-tab="sunrise"]');
    const sunsetBtn = document.querySelector('.prediction-toggle-btn[data-tab="sunset"]');
    if (sunriseBtn) sunriseBtn.textContent = `🌄 ${this.i18n.t('prediction.sunrise')}`;
    if (sunsetBtn) sunsetBtn.textContent = `🌅 ${this.i18n.t('prediction.sunset')}`;
  }
}

export default PredictionController;
