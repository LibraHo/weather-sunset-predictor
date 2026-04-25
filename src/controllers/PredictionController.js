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
  async _calculatePredictionWithBackend(weatherData, date, lat, lon, type, weatherDataArray = null) {
    // 检查是否启用后端基础预测
    if (this.features.USE_BACKEND_PREDICTION) {
      try {
        console.log(`[PredictionController] 使用后端 API 计算预测 (${type})`);

        // 找前 1-2 小时数据用于云厚评估
        if (weatherDataArray && weatherData.timestamp) {
          const ts = weatherData.timestamp;
          for (let offset = 1; offset <= 2; offset++) {
            const prevTs = ts - offset * 3600000;
            const prev = weatherDataArray.find(d => d.timestamp === prevTs);
            if (prev && prev.shortwaveRadiation != null && prev.shortwaveRadiation > 50) {
              weatherData._prevHourData = prev;
              break;
            }
          }
        }

        return await this.predictionAPIService.calculate(weatherData, date, lat, lon, type);
      } catch (error) {
        console.error(`[PredictionController] 后端 API 调用失败（已禁用本地旧算法回退）:`, error.message);
        throw error;
      }
    } else {
      // 使用前端计算
      return this.predictionService.calculatePrediction(weatherData, date, lat, lon, type, {
        timezone: weatherData?.timezone || null
      });
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
    const targetTimezone = weatherDataArray.find(item => item?.timezone)?.timezone || null;

    // 输出天气数据范围信息
    if (weatherDataArray.length > 0) {
      const firstDataTime = new Date(weatherDataArray[0].timestamp);
      const lastDataTime = new Date(weatherDataArray[weatherDataArray.length - 1].timestamp);
      console.log(`[PredictionController] 天气数据时间范围: ${firstDataTime.toLocaleString('zh-CN')} 到 ${lastDataTime.toLocaleString('zh-CN')}`);
    }

    const predictions = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

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
          ${this.i18n.t('prediction.sunrise')}
        </button>
        <button class="prediction-toggle-btn${defaultTab === 'sunset' ? ' active' : ''}" data-tab="sunset">
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
    const targetTimezone = prediction.timezone || null;
    const forecast = this.buildForecastViewModel(prediction, icon, title, timeLabel, dateLabel, type, targetTimezone);
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

    return `
      <div class="prediction-card prediction-app-card ${qualityClass}" data-type="${type}">
        <div class="prediction-app-shell">
          <div class="prediction-app-nav prediction-app-nav-compact" aria-label="${forecast.type}预测操作">
            <div class="prediction-share-menu" data-share-type="${type}">
              <button class="prediction-share-btn prediction-nav-share" data-type="${type}" aria-label="${this.i18n.t('share.title')}" aria-expanded="false">
                ${shareIconSvg}
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
          </div>

          <div class="phenomenon-title-card">
            <div class="phenomenon-icon-tile" aria-hidden="true">${forecast.icon}</div>
            <div class="phenomenon-title-copy">
              <span class="phenomenon-date-tag">${dateLabel}</span>
              <h3>${forecast.type}</h3>
            </div>
          </div>

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
              ${forecast.direction ? this.renderInfoRow('🧭', forecast.directionLabel, forecast.direction) : ''}
            </div>
          </div>

          ${this.renderCloudConditionCard(forecast.clouds)}
          ${this.renderAnalysisCard(forecast.analysis, forecast.conclusion)}
          <div id="radar-compass-${type}" style="margin-top:12px;display:none;"></div>
          <div class="prediction-app-footer">观天有时 · 收获美景</div>
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
      scoreDesc: this.getScoreDescription(score),
      mainTime: this.formatTime(type === 'sunrise' ? (prediction.sunriseTime || prediction.sunsetTime) : prediction.sunsetTime, targetTimezone),
      bestViewingTime: `${this.formatTime(viewingWindow.start, targetTimezone)}–${this.formatTime(viewingWindow.end, targetTimezone)}`,
      direction,
      directionLabel: type === 'sunrise' ? this.i18n.t('prediction.sunriseDirectionLabel') : this.i18n.t('prediction.sunsetDirectionLabel'),
      clouds: [
        { label: '高云', value: Number(clouds.high ?? 0), color: '#4EA3FF' },
        { label: '中云', value: Number(clouds.mid ?? 0), color: '#8B9DFF' },
        { label: '低云', value: Number(clouds.low ?? 0), color: '#B7C0CF' }
      ],
      quality: prediction.quality || this.getQualityFromScore(score),
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
    return direction ? `${direction} ↑` : '';
  }

  getScoreDescription(score) {
    if (score >= 80) return '观赏条件很好';
    if (score >= 60) return '观赏条件不错';
    if (score >= 40) return '有一定机会';
    return '观赏条件偏弱';
  }

  getQualityFromScore(score) {
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'fair';
    return 'poor';
  }

  getScoreTheme(quality, score) {
    const value = Math.max(0, Math.min(100, Number(score) || 0));
    if (value >= 80) return ['#F97316', '#FACC15', '#E11D48'];

    // 0–80 使用单色：从灰逐步过渡到更深橙色，但圆环本身不做渐变。
    const stops = [
      { max: 20, color: '#9CA3AF' },
      { max: 40, color: '#C4A173' },
      { max: 60, color: '#E6A23C' },
      { max: 80, color: '#EA580C' }
    ];
    const color = stops.find(stop => value < stop.max)?.color || '#EA580C';
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
          <circle cx="90" cy="90" r="${radius}" fill="none" stroke="#EEF1F7" stroke-width="12"/>
          <circle cx="90" cy="90" r="${radius}" fill="none" stroke="url(#app-gauge-grad-${type}-${forecast.quality})" stroke-width="12"
            stroke-dasharray="${scoreFill.toFixed(2)} ${scoreGap.toFixed(2)}" stroke-dashoffset="${(circumference * 0.25).toFixed(2)}" stroke-linecap="round"/>
        </svg>
        <div class="score-gauge-center">
          <div><span class="score-gauge-number" style="color:${scoreTheme[1]}">${forecast.score.toFixed(0)}</span><span class="score-gauge-total">/100</span></div>
        </div>
        <div class="score-gauge-caption">
          <div class="score-gauge-grade" style="color:${scoreTheme[1]}">${forecast.scoreLabel}</div>
          <div class="score-gauge-desc">${forecast.scoreDesc}</div>
          <div class="score-breakdown-hint-trigger">查看评分明细</div>
        </div>
      </div>
    `;
  }

  renderInfoRow(icon, label, value) {
    return `
      <div class="app-info-row">
        <span class="app-info-icon" aria-hidden="true">${icon}</span>
        <span class="app-info-label">${label}</span>
        <strong class="app-info-value">${value}</strong>
      </div>
    `;
  }

  renderCloudConditionCard(clouds) {
    const rows = clouds.map(cloud => {
      const value = Math.max(0, Math.min(100, cloud.value));
      return `
        <div class="cloud-condition-item">
          <div class="cloud-condition-top"><span class="cloud-condition-label">☁️ ${cloud.label}</span><strong>${value.toFixed(0)}%</strong></div>
          <div class="cloud-condition-track"><span class="cloud-condition-fill" style="width:${value}%;background:${cloud.color};"></span></div>
        </div>
      `;
    }).join('');
    return `<div class="cloud-condition-card">${rows}</div>`;
  }

  buildAnalysisGroups(prediction) {
    const weather = this.extractAnalysisWeather(prediction);
    const groups = [
      { title: '有利条件', type: 'positive', icon: '✅', items: [] },
      { title: '一般因素', type: 'neutral', icon: 'ℹ️', items: [] },
      { title: '注意因素', type: 'warning', icon: '⚠️', items: [] }
    ];
    const add = (groupType, title, desc) => {
      const group = groups.find(g => g.type === groupType);
      group.items.push({ title, desc });
    };

    if (weather.high >= 60) add('positive', `高层云充沛（${weather.high.toFixed(0)}%）`, '色彩载体丰富，火烧云基础扎实');
    else if (weather.high >= 35) add('positive', `高层云充足（${weather.high.toFixed(0)}%）`, '具备较好的霞光染色载体');
    else if (weather.high >= 15) add('neutral', `高层云适中（${weather.high.toFixed(0)}%）`, '可形成火烧云，但色彩可能偏淡');
    else add('warning', `高层云偏少（${weather.high.toFixed(0)}%）`, '缺少主要色彩载体');

    if (weather.mid >= 20 && weather.mid <= 60) add('positive', `中层云适中（${weather.mid.toFixed(0)}%）`, '利于色彩扩散和层次感');
    else if (weather.mid < 20) add('neutral', `中层云较少（${weather.mid.toFixed(0)}%）`, weather.high >= 35 ? '但高层云充足，可独立形成火烧云' : '层次感可能不足');
    else add('warning', `中层云偏厚（${weather.mid.toFixed(0)}%）`, '可能让画面偏灰，削弱霞光通透感');

    if (weather.low < 15) add('positive', `低云稀少（${weather.low.toFixed(0)}%）`, '不会遮挡火烧云');
    else if (weather.low < 35) add('neutral', `低云较多（${weather.low.toFixed(0)}%）`, '可能部分遮挡低空色彩');
    else add('warning', `低云偏厚（${weather.low.toFixed(0)}%）`, '遮挡风险较大');

    if (weather.visibility >= 15) add('positive', `能见度良好（${weather.visibility.toFixed(0)}km）`, '空气通透，观赏视野好');
    else if (weather.visibility >= 8) add('neutral', `能见度一般（${weather.visibility.toFixed(0)}km）`, '色彩饱和度可能略受影响');
    else add('warning', `能见度偏低（${weather.visibility.toFixed(0)}km）`, '雾霾或水汽可能影响观赏');

    if (weather.humidity >= 40 && weather.humidity <= 70) add('positive', `湿度适中（${weather.humidity.toFixed(0)}%）`, '利于光线散射');
    else if (weather.humidity > 70) add('warning', `湿度偏高（${weather.humidity.toFixed(0)}%）`, '可能略影响通透感');
    else add('neutral', `湿度偏低（${weather.humidity.toFixed(0)}%）`, '空气较干，色彩可能偏淡');

    if (weather.aod != null) {
      if (weather.aod >= 0.08 && weather.aod <= 0.35) add('positive', `气溶胶适中（AOD ${weather.aod.toFixed(2)}）`, '有利于增强红橙色散射');
      else if (weather.aod > 0.35) add('warning', `气溶胶偏高（AOD ${weather.aod.toFixed(2)}）`, '可能灰霾发暗');
      else add('neutral', `空气过于通透（AOD ${weather.aod.toFixed(2)}）`, '颜色可能偏淡');
    }

    if (weather.layerCount <= 1 && weather.high >= 35) {
      add('warning', '云层单一', '但高云质量好，仍可形成色彩鲜明的火烧云');
    }

    return groups.filter(group => group.items.length > 0);
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
      layerCount
    };
  }

  buildAnalysisConclusion(prediction, score, clouds) {
    const layerCount = prediction.breakdown?.layerDiversity?.layerCount ?? [clouds.high, clouds.mid, clouds.low].filter(v => Number(v) >= 10).length;
    if (score >= 80) return layerCount >= 2 ? '条件优秀，强烈推荐出行观赏' : '条件优秀，色彩可期；云层单一，层次感略有不足';
    if (score >= 60) return layerCount >= 2 ? '条件不错，有较大概率出现壮观的火烧云' : '条件不错，火烧云概率较高；云层层次稍欠';
    if (score >= 40) return '条件中等，需看实际云层演变';
    return '关键条件不足，火烧云概率偏低';
  }

  renderAnalysisCard(groups, conclusion) {
    const groupHtml = groups.map(group => this.renderAnalysisGroup(group)).join('');
    return `
      <div class="analysis-card app-analysis-card">
        <div class="analysis-card-title"><span>火烧云形成条件分析</span></div>
        ${groupHtml}
        <div class="conclusion-banner"><span aria-hidden="true">🌿</span><strong>${conclusion}</strong></div>
      </div>
    `;
  }

  renderAnalysisGroup(group) {
    const items = group.items.map(item => this.renderAnalysisItem(item, group.type)).join('');
    return `
      <section class="analysis-group analysis-group-${group.type}">
        <div class="analysis-group-label"><span aria-hidden="true">${group.icon}</span>${group.title}</div>
        <div class="analysis-items">${items}</div>
      </section>
    `;
  }

  renderAnalysisItem(item, type) {
    const icon = type === 'positive' ? '✓' : (type === 'warning' ? '!' : 'i');
    return `
      <div class="analysis-item analysis-item-${type}">
        <span class="analysis-item-icon" aria-hidden="true">${icon}</span>
        <span class="analysis-item-copy"><strong>${item.title}</strong><small>${item.desc}</small></span>
      </div>
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

    const baseScore = prediction?.breakdown?.baseScore;
    const canvasScore = prediction?.canvasAnalysis?.score ?? prediction?.breakdown?.canvasScore;
    const lightPathScore = prediction?.lightPathAnalysis?.score ?? prediction?.breakdown?.lightPathScore;
    const renderingFactor = prediction?.renderingAnalysis?.factor ?? prediction?.breakdown?.renderingFactor;
    const aerosol = prediction?.breakdown?.aerosolScattering;
    const aerosolFactor = prediction?.renderingAnalysis?.aerosolFactor ?? aerosol?.factor;

    const row = (label, value, hint, className = '') => `
      <div class="score-breakdown-row ${className}">
        <span class="score-breakdown-key">${label}</span>
        <span class="score-breakdown-val">${value}</span>
        <span class="score-breakdown-hint">${hint}</span>
      </div>`;

    return `
      <div class="score-breakdown-popover" hidden>
        <div class="score-breakdown-title">分数明细</div>
        ${row(this.i18n.t('prediction.composite.finalScore'), fmt(prediction?.score, 0), '最终展示分', 'score-breakdown-row-total')}
        <div class="score-breakdown-formula">基础分 = 画布 ×0.8 + 光路 ×0.2</div>
        ${row(this.i18n.t('prediction.composite.title'), fmt(baseScore, 1), '云层与光路融合后的基础分')}
        ${row(this.i18n.t('prediction.canvas.title'), fmt(canvasScore, 1), '高云/中云提供色彩载体，低云会遮挡')}
        ${row(this.i18n.t('prediction.lightPath.title'), fmt(lightPathScore, 1), '太阳光是否能照到云层')}
        <div class="score-breakdown-formula">最终分 = 基础分 × 修正系数</div>
        ${row(this.i18n.t('prediction.rendering.title'), `×${fmt(renderingFactor, 2)}`, '湿度、能见度影响颜色表现')}
        ${aerosolFactor != null ? row(this.i18n.t('prediction.rendering.aerosol'), `×${fmt(aerosolFactor, 2)}`, '适中增强红橙散射，过高会发灰') : ''}
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

    const highLabel = normalizeLabel(this.i18n.t('prediction.cloudLayers.shortHigh'), '高云');
    const midLabel = normalizeLabel(this.i18n.t('prediction.cloudLayers.shortMid'), '中云');
    const lowLabel = normalizeLabel(this.i18n.t('prediction.cloudLayers.shortLow'), '低云');

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
      precipitation: precipitationValue,
      aerosolOpticalDepth: prediction.aerosolOpticalDepth ?? factors.aerosolOpticalDepth?.value ?? null,
      pm2_5: prediction.pm2_5 ?? factors.pm2_5?.value ?? null,
      pm10: prediction.pm10 ?? factors.pm10?.value ?? null,
      dust: prediction.dust ?? factors.dust?.value ?? null
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
    const factors = prediction.factors || {};
    const highClouds = canvas?.breakdown?.highClouds ?? factors.highClouds?.value ?? prediction.cloudLayers?.high ?? 0;
    const midClouds = canvas?.breakdown?.midClouds ?? factors.midClouds?.value ?? prediction.cloudLayers?.mid ?? 0;
    const lowClouds = canvas?.breakdown?.lowClouds ?? factors.lowClouds?.value ?? prediction.cloudLayers?.low ?? 0;
    const cloudCover = prediction.cloudCover ?? factors.cloudCover?.value ?? (highClouds + midClouds + lowClouds) / 3;
    const humidity = prediction.humidity ?? factors.humidity?.value ?? 50;
    const visibility = prediction.visibility ?? factors.visibility?.value ?? 10;
    const precipitation = factors.precipitation?.value ?? prediction.precipitation ?? 0;
    const weatherCode = factors.weatherCode?.value ?? prediction.weatherCode ?? null;
    const aerosolOpticalDepth = prediction.aerosolOpticalDepth ?? factors.aerosolOpticalDepth?.value ?? prediction.breakdown?.aerosolScattering?.aerosolOpticalDepth;
    const pm2_5 = prediction.pm2_5 ?? factors.pm2_5?.value ?? prediction.breakdown?.aerosolScattering?.pm2_5;
    const pm10 = prediction.pm10 ?? factors.pm10?.value ?? prediction.breakdown?.aerosolScattering?.pm10;
    const dust = prediction.dust ?? factors.dust?.value ?? prediction.breakdown?.aerosolScattering?.dust;

    let analysis = '';

    // 总体评价（使用增强版状态），详细条目复用 4/18 修好的火烧云分析文案。
    if (prediction.status) {
      analysis += `<strong>${prediction.icon} ${prediction.status}</strong><br><br>`;
      analysis += `${prediction.description}<br>`;
    }

    analysis += this.generateFireCloudAnalysis(
      cloudCover,
      humidity,
      visibility,
      lowClouds,
      precipitation,
      weatherCode,
      {
        cloudCover,
        highClouds,
        midClouds,
        lowClouds,
        visibility,
        humidity,
        precipitation,
        aerosolOpticalDepth,
        pm2_5,
        pm10,
        dust,
        specialMode: prediction.renderingAnalysis?.breakdown?.specialMode
      },
      prediction.score
    );

    // 云厚评估（Phase 22）：只追加厚度信息，不替换详细分析文案。
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

  _getWeatherText(weatherCode, precipitation = 0) {
    if (precipitation >= 8) return '暴雨';
    if (precipitation >= 4) return '大雨';
    if (precipitation >= 1) return '下雨';
    if (precipitation >= 0.1) return '小雨';

    const code = Number(weatherCode);
    if ([95, 96, 99].includes(code)) return '雷雨';
    if ([80, 81, 82, 61, 63, 65, 66, 67].includes(code)) return '下雨';
    if ([51, 53, 55, 56, 57].includes(code)) return '毛毛雨';
    if ([71, 73, 75, 77, 85, 86].includes(code)) return '降雪';
    if ([45, 48].includes(code)) return '有雾';
    if (code === 0) return '晴';
    if ([1, 2].includes(code)) return '少云';
    if (code === 3) return '阴天';
    return null;
  }

  _getPrecipPriorityMessage(weatherInput, weatherCode) {
    const precip = weatherInput.precipitation ?? 0;
    const lowClouds = weatherInput.lowClouds ?? 0;
    const visibility = weatherInput.visibility ?? 0;
    const humidity = weatherInput.humidity ?? 0;
    const weatherText = this._getWeatherText(weatherCode, precip);

    if (precip >= 4) {
      return `今天${weatherText || '下雨'}（${precip.toFixed(1)}mm/h），如果晚霞时段还不停，基本不用看云层结构；重点是降水会直接挡住视野。`;
    }
    if (precip >= 1) {
      return `今天${weatherText || '下雨'}（${precip.toFixed(1)}mm/h），需要先看晚霞时段是否停雨；如果刚好雨停且西边开缝，反而可能很漂亮。`;
    }
    if (precip >= 0.5 || ([61, 63, 65, 80, 81, 82, 95, 96, 99].includes(Number(weatherCode)))) {
      return null;
    }
    if (visibility > 0 && visibility < 5) {
      return `今天能见度较差（${visibility.toFixed(0)}km），即使云型合适，颜色也容易被雾霾/水汽削弱。`;
    }
    if (humidity >= 90 && lowClouds >= 50) {
      return `今天湿度很高（${humidity.toFixed(0)}%）且低云厚，容易灰蒙蒙，火烧云观赏条件较差。`;
    }
    return null;
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

    const precip = weatherInput.precipitation ?? 0;
    const weatherText = this._getWeatherText(weatherCode, precip);
    const hasWeatherCode = weatherCode !== null && weatherCode !== undefined && weatherCode !== '';
    const isClearSky = hasWeatherCode && Number(weatherCode) === 0 && precip < 0.1;
    const hasMeaningfulClouds = (weatherInput.highClouds ?? 0) >= 10 || (weatherInput.midClouds ?? 0) >= 10 || (weatherInput.lowClouds ?? 0) >= 15;
    const isClearLike = precip < 0.1 && !hasMeaningfulClouds && (!hasWeatherCode || Number(weatherCode) === 0);
    const isPostRain = weatherInput.specialMode === 'post_rain' || weatherInput.postRain === true;

    if (precip >= 4) {
      return '<div class="fire-cloud-details fire-cloud-details-compact"><div class="fca-summary">下大雨，基本看不到</div></div>';
    }

    if (isPostRain) {
      return '<div class="fire-cloud-details fire-cloud-details-compact"><div class="fca-summary fca-summary-good">雨后晴</div></div>';
    }

    if (isClearSky || isClearLike) {
      return '';
    }

    const result = this.predictionService._calculateUnifiedScore(weatherInput);
    const { breakdown } = result;
    // 优先用卡片显示的 prediction.score，避免自己重算跟卡片不一致
    const finalScore = predictionScore != null ? Math.round(predictionScore) : Math.round(result.score);

    let html = '<div class="fire-cloud-details fire-cloud-details-concept">';
    html += '<div class="fca-title">火烧云形成条件分析</div>';

    const verdictClass = finalScore >= 70 ? 'fca-summary-great' : (finalScore >= 50 ? 'fca-summary-good' : '');
    const verdictText = finalScore >= 70
      ? '值得期待，重点看云层开口和低云遮挡'
      : finalScore >= 50
        ? '有机会，条件仍需临场观察'
        : '不太推荐，关键条件不足';
    html += `<div class="fca-summary fca-verdict ${verdictClass}">${verdictText}</div>`;
    html += '<div class="fca-metric-grid">';

    const r = (icon, text) => `<div class="fca-row fca-metric"><span class="fca-icon">${icon}</span><span class="fca-text">${text}</span></div>`;
    const priorityMessage = this._getPrecipPriorityMessage(weatherInput, weatherCode);

    if (weatherText) {
      html += r(precip >= 0.5 ? '⚠️' : '✅', `天气：${weatherText}${precip >= 0.1 ? `（降水 ${precip.toFixed(1)}mm/h）` : ''}`);
    }

    if (priorityMessage) {
      html += '</div>';
      html += `<div class="fca-notes"><div class="fca-summary">${priorityMessage}</div></div>`;
      html += '</div>';
      return html;
    }

    // 高云 — 核心载体，阈值更细
    const hc = weatherInput.highClouds ?? 0;
    if (hc >= 60) {
      html += r('✅', `高层云充沛（${hc.toFixed(0)}%），色彩载体极为丰富，火烧云基础扎实`);
    } else if (hc >= 40) {
      html += r('✅', `高层云充足（${hc.toFixed(0)}%），色彩载体丰富`);
    } else if (hc >= 20) {
      html += r('⚠️', `高层云适中（${hc.toFixed(0)}%），可形成火烧云但色彩可能偏淡`);
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
      html += r('⚠️', `中层云较少（${mc.toFixed(0)}%），但高层云充足可独立形成火烧云`);
    } else if (hc >= 40 && mc > 60) {
      html += r('⚠️', `中层云偏厚（${mc.toFixed(0)}%），高云充足影响不大，但层次可能偏灰`);
    } else if (mc >= 10 && mc < 20) {
      html += r('⚠️', `中层云偏少（${mc.toFixed(0)}%），色彩扩散有限`);
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

    // 气溶胶 — 散射潜力与灰霾风险
    const aerosol = breakdown.aerosolScattering;
    if (aerosol && aerosol.level !== 'unknown') {
      const aodText = aerosol.aerosolOpticalDepth != null ? `（AOD ${Number(aerosol.aerosolOpticalDepth).toFixed(2)}）` : '';
      if (aerosol.level === 'optimal') {
        html += r('✅', `气溶胶适中${aodText}，有利于增强红橙色散射`);
      } else if (['high', 'very_high', 'polluted', 'low_visibility_haze', 'moderate_pollution'].includes(aerosol.level)) {
        html += r('⚠️', `颗粒物/气溶胶偏高${aodText}，可能灰霾发暗`);
      } else if (aerosol.level === 'low') {
        html += r('⚠️', `空气过于通透${aodText}，颜色可能偏淡`);
      }
    }

    // 云层立体感 — 根据高云是否充足调整语气
    const layerCount = breakdown.layerDiversity.layerCount ?? 0;
    if (layerCount >= 3) {
      html += r('✅', '云层立体丰富，多层次火烧云可期');
    } else if (layerCount === 2) {
      html += r('✅', '云层层次尚可，双色层搭配');
    } else if (hc >= 40) {
      // 单层但高云充足：不算差，只是缺层次
      html += r('⚠️', '云层单一，但高云质量好，仍可形成色彩鲜明的火烧云');
    } else {
      html += r('⚠️', '云层单一，层次感不足');
    }

    // 降水
    if (precip >= 2) {
      html += r('❌', `降水较强（${precip.toFixed(1)}mm/h），若观赏时段仍在下，基本无法观赏`);
    } else if (precip >= 0.5) {
      html += r('⚠️', `有降水（${precip.toFixed(1)}mm/h），需关注是否在日出/日落前后停雨；雨后开缝反而可能出大片颜色`);
    } else if (precip >= 0.1) {
      html += r('⚠️', `轻微降水（${precip.toFixed(1)}mm/h），可能影响观赏；若刚停雨且能见度转好，有雨后初晴机会`);
    }

    html += '</div>';

    // 结语：直接用 predictionScore（卡片显示分），不再自己重算。底部只保留短解释，避免日志式堆叠。
    html += '<div class="fca-notes">';
    const hasCloudCarrier = hc >= 15 || mc >= 15;
    if (!hasCloudCarrier && finalScore < 40) {
      html += `<div class="fca-summary">高云和中云几乎为零，缺少色彩载体，火烧云概率极低</div>`;
    } else if (finalScore >= 80) {
      if (layerCount >= 2) {
        html += `<div class="fca-summary fca-summary-great">极佳条件，强烈推荐出行观赏</div>`;
      } else {
        html += `<div class="fca-summary fca-summary-great">条件优秀，色彩可期；云层单一，层次感略有不足</div>`;
      }
    } else if (finalScore >= 60) {
      if (layerCount >= 2) {
        html += `<div class="fca-summary fca-summary-good">条件不错，有较大概率出现壮观的火烧云</div>`;
      } else {
        html += `<div class="fca-summary fca-summary-good">条件不错，火烧云概率较高；云层层次稍欠，效果可能偏平面</div>`;
      }
    } else if (finalScore >= 40) {
      html += `<div class="fca-summary">条件中等，火烧云概率一般，需看实际云层演变</div>`;
    } else {
      html += `<div class="fca-summary">火烧云概率较低（${finalScore}分）</div>`;
    }
    html += '</div>';

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
      const formattedAnalysis = analysis
        ? (firstBr > -1
          ? `<strong>${analysis.substring(0, firstBr)}</strong>${analysis.substring(firstBr)}`
          : `<strong>${analysis}</strong>`)
        : '';
      const analysisEl = card.querySelector('.compact-analysis');
      if (analysisEl) {
        analysisEl.innerHTML = formattedAnalysis;
        analysisEl.classList.toggle('compact-analysis-empty', !formattedAnalysis);
      }
    });

    // 顶部切换按钮文本
    const sunriseBtn = document.querySelector('.prediction-toggle-btn[data-tab="sunrise"]');
    const sunsetBtn = document.querySelector('.prediction-toggle-btn[data-tab="sunset"]');
    if (sunriseBtn) sunriseBtn.textContent = `🌄 ${this.i18n.t('prediction.sunrise')}`;
    if (sunsetBtn) sunsetBtn.textContent = `🌅 ${this.i18n.t('prediction.sunset')}`;
  }
}

export default PredictionController;
