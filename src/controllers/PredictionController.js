/**
 * PredictionController - 晚霞预测控制器
 *
 * 管理晚霞预测的生成和显示
 *
 * 需求：7.1, 7.2 - 未来预测时间线
 * 需求：7.4 - 预测详情展开功能
 * 需求：12.1, 12.2, 12.3, 12.4, 12.5, 12.8, 12.11, 12.12, 12.13 - 朝霞晚霞预测增强功能
 * 需求：14 - 多语言支持
 */

import SunsetPredictionService from '../services/SunsetPredictionService.js';
import EnhancedSunsetPredictionService from '../services/EnhancedSunsetPredictionService.js';
import NotificationService from '../services/NotificationService.js';
import i18n from '../i18n.js';

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
    this.expandedPredictionIndex = null; // 当前展开的预测索引
    this.useEnhancedModel = true; // 默认使用增强模型
    this.i18n = i18n; // 需求14：添加i18n实例
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
          if (this.useEnhancedModel) {
            // 增强版需要传入具体的日出时间来计算正确的太阳高度角
            sunrisePrediction = await this.enhancedPredictionService.calculateEnhancedPrediction(
              sunriseWeatherData,
              sunriseTime,  // 使用日出时间而不是日期
              location.lat,
              location.lon,
              'sunrise'
            );
            console.log(`[PredictionController] 使用增强模型生成朝霞预测，得分: ${sunrisePrediction.score}`);
          } else {
            sunrisePrediction = this.predictionService.calculatePrediction(
              sunriseWeatherData,
              targetDate,
              location.lat,
              location.lon,
              'sunrise'
            );
          }

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
          sunrisePrediction.sunsetTime = sunriseTime; // 用于显示日出时间

          // 为增强版预测添加最佳观看窗口方法和factors属性
          if (this.useEnhancedModel) {
            if (!sunrisePrediction.getOptimalViewingWindow) {
              sunrisePrediction.getOptimalViewingWindow = () => {
                return {
                  start: new Date(sunriseTime.getTime() - 30 * 60 * 1000), // 日出前30分钟
                  end: new Date(sunriseTime.getTime() + 30 * 60 * 1000),   // 日出后30分钟
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

        console.log(`[PredictionController] 第${i}天 日落时间:`, sunsetTime, `时间戳: ${sunsetTime.getTime()}`);
        console.log(`[PredictionController] 第${i}天 targetDate:`, targetDate, `时间戳: ${targetDate.getTime()}`);

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
          if (this.useEnhancedModel) {
            // 增强版需要传入具体的日落时间来计算正确的太阳高度角
            sunsetPrediction = await this.enhancedPredictionService.calculateEnhancedPrediction(
              sunsetWeatherData,
              sunsetTime,  // 使用日落时间而不是日期
              location.lat,
              location.lon,
              'sunset'
            );
            console.log(`[PredictionController] 使用增强模型生成晚霞预测，得分: ${sunsetPrediction.score}`);
          } else {
            sunsetPrediction = this.predictionService.calculatePrediction(
              sunsetWeatherData,
              targetDate,
              location.lat,
              location.lon,
              'sunset'
            );
          }

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
            if (!sunsetPrediction.getOptimalViewingWindow) {
              sunsetPrediction.getOptimalViewingWindow = () => {
                return {
                  start: new Date(sunsetTime.getTime() - 30 * 60 * 1000), // 日落前30分钟
                  end: new Date(sunsetTime.getTime() + 30 * 60 * 1000),   // 日落后30分钟
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
    if (todaySunrise && todaySunrise.sunsetTime) {
      sunriseTime = todaySunrise.sunsetTime;
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

    // 朝霞时间检查 - 独立判断
    if (sunriseTime && todaySunrise) {
      const sunriseEndTime = new Date(sunriseTime.getTime() + 2 * 60 * 60 * 1000);
      if (now > sunriseEndTime) {
        console.log('[PredictionController] 今日朝霞时间已过，切换到明天的朝霞预测');
        displaySunrise = tomorrowSunrise;
        sunriseTime = tomorrowSunrise ? tomorrowSunrise.sunsetTime : null;
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

    // 显示预测
    this.updateTodayPredictions(
      displaySunrise,
      displaySunset,
      sunriseTime,
      sunsetTime,
      displayDate,
      { sunriseIsToday, sunsetIsToday }
    );

    // 显示未来预测时间线
    this.updateForecastTimeline(predictions);

    // 绑定点击事件到预测卡片（任务 13.5）
    this.bindPredictionCardEvents();

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
    const isToday = displayDate.toDateString() === today.toDateString();
    const dateLabel = isToday ? this.i18n.t('date.today') : this.i18n.t('date.tomorrow');

    // 如果两个预测都缺失，显示错误提示
    if (!sunrisePrediction && !sunsetPrediction) {
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

    let html = '<div class="today-predictions-container">';

    // 确定每个预测的日期标签
    const sunriseDateLabel = sunrisePrediction && sunrisePrediction.date &&
      sunrisePrediction.date.toDateString() === today.toDateString() ? this.i18n.t('date.today') : this.i18n.t('date.tomorrow');
    const sunsetDateLabel = sunsetPrediction && sunsetPrediction.date &&
      sunsetPrediction.date.toDateString() === today.toDateString() ? this.i18n.t('date.today') : this.i18n.t('date.tomorrow');

    // 朝霞预测
    if (sunrisePrediction) {
      html += this.renderSinglePrediction(sunrisePrediction, '🌄', this.i18n.t('prediction.sunrise'), this.i18n.t('prediction.sunriseTime'), sunriseDateLabel);
    } else {
      // 朝霞预测未生成
      html += `
        <div class="prediction-unavailable-card">
          <span class="prediction-date-badge">${sunriseDateLabel}</span>
          <h3>🌄 ${this.i18n.t('prediction.sunrise')}</h3>
          <p class="unavailable-reason">${this.i18n.t('prediction.predictionUnavailable')}</p>
          <p class="hint-text">${this.i18n.t('prediction.viewFutureOrRefresh')}</p>
        </div>
      `;
    }

    // 晚霞预测
    if (sunsetPrediction) {
      html += this.renderSinglePrediction(sunsetPrediction, '🌅', this.i18n.t('prediction.sunset'), this.i18n.t('prediction.sunsetTime'), sunsetDateLabel);
    } else {
      // 晚霞预测未生成
      html += `
        <div class="prediction-unavailable-card">
          <span class="prediction-date-badge">${sunsetDateLabel}</span>
          <h3>🌅 ${this.i18n.t('prediction.sunset')}</h3>
          <p class="unavailable-reason">${this.i18n.t('prediction.predictionUnavailable')}</p>
          <p class="hint-text">${this.i18n.t('prediction.viewFutureOrRefresh')}</p>
        </div>
      `;
    }

    html += '</div>';

    predictionDisplay.innerHTML = html;

    // 显示预测部分
    if (predictionSection) {
      predictionSection.classList.remove('hidden');
    }

    console.log(`[PredictionController] ${dateLabel}预测已更新`);
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
  renderSinglePrediction(prediction, icon, title, timeLabel, dateLabel = '今日') {
    const viewingWindow = prediction.getOptimalViewingWindow();
    const analysis = this.generateAnalysisText(prediction, dateLabel, prediction.cloudLayers);

    // 任务 13.5：添加黄金时段、蓝调时段、太阳方位角、云层分层显示
    let enhancedInfo = '';

    // 黄金时段（需求12.2）
    if (prediction.goldenHour) {
      enhancedInfo += `
        <div class="golden-hour-info">
          <span class="time-label">🌟 黄金时段</span>
          <span class="time-value">${this.formatTime(prediction.goldenHour.start)} - ${this.formatTime(prediction.goldenHour.end)}</span>
        </div>
      `;
    }

    // 蓝调时段（需求12.3）
    if (prediction.blueHour) {
      enhancedInfo += `
        <div class="blue-hour-info">
          <span class="time-label">🌌 蓝调时段</span>
          <span class="time-value">${this.formatTime(prediction.blueHour.start)} - ${this.formatTime(prediction.blueHour.end)}</span>
        </div>
      `;
    }

    // 太阳方位角（需求12.5，仅当评分>70时）
    if (prediction.shouldShowAzimuth && prediction.shouldShowAzimuth()) {
      const direction = prediction.getAzimuthDirection();
      enhancedInfo += `
        <div class="sun-azimuth-info">
          <span class="azimuth-label">🧭 太阳方位</span>
          <span class="azimuth-value">${direction} (${prediction.sunAzimuth}°)</span>
        </div>
      `;
    }

    // 云层分层信息（需求12.11）- 只显示云层数据，不显示description
    let cloudLayersHtml = '';
    if (prediction.cloudLayers) {
      cloudLayersHtml = this.renderCloudLayers(prediction.cloudLayers);
    }

    return `
      <div class="prediction-card">
        <div class="prediction-header">
          <span class="prediction-date-badge">${dateLabel}</span>
          <h3>${icon} ${title}${this.i18n.t('prediction.score')}</h3>
        </div>
        <div class="prediction-score-container">
          <div class="score-card ${this.getQualityClass(prediction.quality)}">
            <div class="score-circle">
              <span class="score-number">${prediction.score.toFixed(0)}</span>
              <span class="score-label">${this.i18n.t('prediction.points')}</span>
            </div>
            <div class="quality-badge">
              ${this.getQualityLabel(prediction.quality)}
            </div>
          </div>
        </div>
        <div class="prediction-info">
          <div class="sunset-time">
            <span class="sunset-icon">${icon}</span>
            <span class="sunset-label">${timeLabel}</span>
            <span class="sunset-value">${this.formatTime(prediction.sunsetTime)}</span>
          </div>
          <div class="best-time">
            <span class="best-time-label">${this.i18n.t('prediction.bestViewingTime')}</span>
            <span class="best-time-value">${this.formatTime(viewingWindow.start)} - ${this.formatTime(viewingWindow.end)}</span>
          </div>
          ${enhancedInfo}
        </div>
        ${cloudLayersHtml}
        <div class="prediction-analysis">
          <h4>${this.i18n.t('prediction.analysisTitle')}</h4>
          <p class="analysis-text">${analysis}</p>
        </div>
      </div>
    `;
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

    return `
      <div class="cloud-layers-section">
        <h4>${this.i18n.t('prediction.cloudLayers.title')}</h4>
        <div class="cloud-layers-grid">
          <div class="cloud-layer">
            <span class="cloud-layer-label">${this.i18n.t('prediction.cloudLayers.highCloudLabel')}</span>
            <span class="cloud-layer-value">${high.toFixed(0)}%</span>
            <div class="cloud-layer-bar">
              <div class="cloud-layer-bar-fill" style="width: ${high}%; background-color: #90caf9;"></div>
            </div>
          </div>
          <div class="cloud-layer">
            <span class="cloud-layer-label">${this.i18n.t('prediction.cloudLayers.midCloudLabel')}</span>
            <span class="cloud-layer-value">${mid.toFixed(0)}%</span>
            <div class="cloud-layer-bar">
              <div class="cloud-layer-bar-fill" style="width: ${mid}%; background-color: #64b5f6;"></div>
            </div>
          </div>
          <div class="cloud-layer">
            <span class="cloud-layer-label">${this.i18n.t('prediction.cloudLayers.lowCloudLabel')}</span>
            <span class="cloud-layer-value">${low.toFixed(0)}%</span>
            <div class="cloud-layer-bar">
              <div class="cloud-layer-bar-fill" style="width: ${low}%; background-color: #42a5f5;"></div>
            </div>
          </div>
        </div>
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

    let analysis = '';

    // 总体评价
    if (prediction.score >= 70) {
      analysis += `${dateLabel}的气象条件非常适合观赏${prediction.typeName || '晚霞'}！<br><br>`;
    } else if (prediction.score >= 40) {
      analysis += `${dateLabel}的气象条件较为适合观赏${prediction.typeName || '晚霞'}。<br><br>`;
    } else {
      analysis += `${dateLabel}的气象条件不太理想。<br><br>`;
    }

    // 火烧云专项分析
    analysis += this.generateFireCloudAnalysis(cloudValue, humidityValue, visibilityValue, lowCloudsValue);

    // 云量分析
    if (cloudValue >= 30 && cloudValue <= 70) {
      analysis += ' 云量适中（' + cloudValue.toFixed(0) + '%），有利于形成绚丽的色彩。<br>';
    } else if (cloudValue < 30) {
      analysis += ' 云量偏少（' + cloudValue.toFixed(0) + '%），可能缺少足够的云层来反射光线。<br>';
    } else {
      analysis += ' 云量较多（' + cloudValue.toFixed(0) + '%），可能遮挡过多阳光。<br>';
    }

    // 湿度分析
    if (humidityValue >= 30 && humidityValue <= 70) {
      analysis += ' 湿度适宜（' + humidityValue.toFixed(0) + '%），空气中的水汽有助于光线散射。<br>';
    } else if (humidityValue < 30) {
      analysis += ' 湿度偏低（' + humidityValue.toFixed(0) + '%），空气较干燥。<br>';
    } else {
      analysis += ' 湿度较高（' + humidityValue.toFixed(0) + '%），可能影响能见度。<br>';
    }

    // 能见度分析
    if (visibilityValue >= 10) {
      analysis += ' 能见度良好（' + visibilityValue.toFixed(1) + ' km），视野清晰。<br>';
    } else if (visibilityValue >= 5) {
      analysis += ' 能见度一般（' + visibilityValue.toFixed(1) + ' km）<br>';
    } else {
      analysis += ' 能见度较差（' + visibilityValue.toFixed(1) + ' km），可能有雾霾。<br>';
    }

    // 低层云分析
    if (lowCloudsValue < 20) {
      analysis += ' 低层云较少，不会遮挡视线。';
    } else if (lowCloudsValue < 40) {
      analysis += ' 有一些低层云，可能略微影响观赏效果。';
    } else {
      analysis += ' 低层云较多（' + lowCloudsValue.toFixed(0) + '%），可能遮挡部分景观。';
    }

    // 云层分层分析（整合到分析原因中）
    if (cloudLayers && cloudLayers.description) {
      analysis += '<br><br><strong>云层分析：</strong>' + cloudLayers.description;
    }

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
      score: lightPath.score.toFixed(0),
      near: lightPath.nearPointScore,
      far: lightPath.farPointScore
    });
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

    return analysis;
  }

  /**
   * 生成火烧云专项分析
   * @param {number} cloudValue - 云量百分比
   * @param {number} humidityValue - 湿度百分比
   * @param {number} visibilityValue - 能见度（km）
   * @param {number} lowCloudsValue - 低层云百分比
   * @returns {string} 火烧云分析文字
   * @private
   */
  generateFireCloudAnalysis(cloudValue, humidityValue, visibilityValue, lowCloudsValue) {
    let fireCloudAnalysis = '';
    let fireCloudScore = 0;
    const fireCloudConditions = [];

    // 评分标准（满分100分）
    // 1. 云量 30-70%: 最佳（+30分）
    // ⚠️ 关键：云量是火烧云形成的必要条件
    if (cloudValue >= 30 && cloudValue <= 70) {
      fireCloudScore += 30;
      fireCloudConditions.push(`✅ 云量理想（${cloudValue.toFixed(0)}%），能充分反射阳光`);
    } else if (cloudValue >= 20 && cloudValue < 30) {
      fireCloudScore += 15;
      fireCloudConditions.push(`⚠️ 云量略少（${cloudValue.toFixed(0)}%），火烧云效果可能偏淡`);
    } else if (cloudValue > 70) {
      fireCloudScore += 10;
      fireCloudConditions.push(`⚠️ 云量过多（${cloudValue.toFixed(0)}%），可能遮挡阳光`);
    } else {
      fireCloudScore += 5;
      fireCloudConditions.push(`❌ 云量严重不足（${cloudValue.toFixed(0)}%），无法形成火烧云`);
    }

    // 2. 湿度 40-75%: 最佳（+25分）
    if (humidityValue >= 40 && humidityValue <= 75) {
      fireCloudScore += 25;
      fireCloudConditions.push(`✅ 湿度适中（${humidityValue.toFixed(0)}%），利于光线散射`);
    } else if (humidityValue >= 30 && humidityValue < 40) {
      fireCloudScore += 15;
      fireCloudConditions.push(`⚠️ 湿度略低（${humidityValue.toFixed(0)}%），色彩可能不够鲜艳`);
    } else if (humidityValue > 75) {
      fireCloudScore += 10;
      fireCloudConditions.push(`⚠️ 湿度偏高（${humidityValue.toFixed(0)}%），可能影响色彩饱和度`);
    } else {
      fireCloudScore += 5;
      fireCloudConditions.push(`❌ 湿度不足（${humidityValue.toFixed(0)}%），光线散射弱`);
    }

    // 3. 能见度 >15km: 最佳（+25分）
    if (visibilityValue >= 15) {
      fireCloudScore += 25;
      fireCloudConditions.push(`✅ 能见度极佳（${visibilityValue.toFixed(1)} km），视野通透`);
    } else if (visibilityValue >= 10) {
      fireCloudScore += 20;
      fireCloudConditions.push(`✅ 能见度良好（${visibilityValue.toFixed(1)} km），观赏体验佳`);
    } else if (visibilityValue >= 5) {
      fireCloudScore += 10;
      fireCloudConditions.push(`⚠️ 能见度一般（${visibilityValue.toFixed(1)} km），色彩可能略暗`);
    } else {
      fireCloudScore += 5;
      fireCloudConditions.push(`❌ 能见度差（${visibilityValue.toFixed(1)} km），有雾霾影响`);
    }

    // 4. 低层云 <30%: 最佳（+20分）
    if (lowCloudsValue < 20) {
      fireCloudScore += 20;
      fireCloudConditions.push(`✅ 低云稀少（${lowCloudsValue.toFixed(0)}%），不会遮挡火烧云`);
    } else if (lowCloudsValue < 30) {
      fireCloudScore += 15;
      fireCloudConditions.push(`✅ 低云较少（${lowCloudsValue.toFixed(0)}%），对观赏影响小`);
    } else if (lowCloudsValue < 50) {
      fireCloudScore += 10;
      fireCloudConditions.push(`⚠️ 低云较多（${lowCloudsValue.toFixed(0)}%），可能部分遮挡`);
    } else {
      fireCloudScore += 5;
      fireCloudConditions.push(`❌ 低云密集（${lowCloudsValue.toFixed(0)}%），严重影响观赏`);
    }

    // ⚠️ 关键修复：如果云量严重不足（<20%），强制降低评价
    let finalScore = fireCloudScore;
    let finalEvaluation = '';

    if (cloudValue < 20) {
      // 云量严重不足，不可能有火烧云
      finalEvaluation = '❌ 云量严重不足，无法形成火烧云';
      finalScore = Math.min(fireCloudScore, 30); // 强制降低分数
    } else if (cloudValue > 80) {
      // 云量过多，遮挡阳光
      finalEvaluation = '❌ 云量过多，遮挡阳光难以形成火烧云';
      finalScore = Math.min(fireCloudScore, 40); // 强制降低分数
    } else if (fireCloudScore >= 80) {
      finalEvaluation = '🌟 具备出现绚烂火烧云的所有条件！';
    } else if (fireCloudScore >= 60) {
      finalEvaluation = '✨ 有较大概率出现壮观的火烧云景象';
    } else if (fireCloudScore >= 40) {
      finalEvaluation = '💫 可能出现轻微的火烧云效果';
    } else {
      finalEvaluation = '⛅ 形成明显火烧云的可能性较低';
    }

    // 生成综合评价
    let level = '';
    if (finalScore >= 80) {
      level = '（极佳）';
    } else if (finalScore >= 60) {
      level = '（良好）';
    } else if (finalScore >= 40) {
      level = '（一般）';
    } else {
      level = '（较差）';
    }

    fireCloudAnalysis = ` 🔥 火烧云指数：${finalScore.toFixed(0)}/100${level}`;

    // 组合所有条件
    fireCloudAnalysis += '<div class="fire-cloud-details" style="margin-top: 10px; padding: 10px; background: rgba(255, 243, 224, 0.3); border-radius: 8px;">';
    fireCloudAnalysis += '<div style="font-weight: 600; margin-bottom: 8px;">🔥 火烧云形成条件分析：</div>';
    fireCloudConditions.forEach(condition => {
      fireCloudAnalysis += `<div style="font-size: 14px; margin: 4px 0;">${condition}</div>`;
    });
    fireCloudAnalysis += `<div style="margin-top: 8px; font-weight: 600; color: var(--color-text);">${finalEvaluation}</div>`;
    fireCloudAnalysis += '</div>';

    return fireCloudAnalysis;
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

      html += `
        <div class="forecast-day-column">
          <div class="forecast-day-header">
            <span class="day-label">${dayLabel}</span>
            <span class="date-label">${dateStr}</span>
          </div>
          <div class="forecast-day-predictions">
      `;

      // 朝霞预测
      if (dayPredictions.sunrise) {
        const pred = dayPredictions.sunrise;
        const sunriseTime = pred.sunsetTime; // 对于朝霞，sunsetTime 实际存储的是日出时间

        // 判断是否已过（日出时间 + 2小时）
        const isPassed = now > new Date(sunriseTime.getTime() + 2 * 60 * 60 * 1000);
        const passedLabel = isPassed ? `<span class="passed-badge">${this.i18n.t('prediction.passed')}</span>` : '';

        html += `
          <div class="forecast-item ${this.getQualityClass(pred.quality)} ${isPassed ? 'passed' : ''}" data-index="${predictions.indexOf(pred)}">
            <div class="forecast-header">
              <div class="forecast-type">
                <span class="type-icon">🌄</span>
                <span class="type-label">${this.i18n.t('prediction.sunrise')}</span>
                ${passedLabel}
              </div>
              <div class="forecast-score">
                <span>${pred.score.toFixed(0)}</span>
              </div>
            </div>
            <div class="forecast-summary">
              <span class="quality-badge ${this.getQualityClass(pred.quality)}">
                ${this.getQualityLabel(pred.quality)}
              </span>
              <span class="sunset-time-small">
                🌄 ${this.formatTime(sunriseTime)}
              </span>
            </div>
          </div>
        `;
      }

      // 晚霞预测
      if (dayPredictions.sunset) {
        const pred = dayPredictions.sunset;
        const sunsetTime = pred.sunsetTime;

        // 判断是否已过（日落时间 + 1.5小时）
        const isPassed = now > new Date(sunsetTime.getTime() + 1.5 * 60 * 60 * 1000);
        const passedLabel = isPassed ? `<span class="passed-badge">${this.i18n.t('prediction.passed')}</span>` : '';

        html += `
          <div class="forecast-item ${this.getQualityClass(pred.quality)} ${isPassed ? 'passed' : ''}" data-index="${predictions.indexOf(pred)}">
            <div class="forecast-header">
              <div class="forecast-type">
                <span class="type-icon">🌅</span>
                <span class="type-label">${this.i18n.t('prediction.sunset')}</span>
                ${passedLabel}
              </div>
              <div class="forecast-score">
                <span>${pred.score.toFixed(0)}</span>
              </div>
            </div>
            <div class="forecast-summary">
              <span class="quality-badge ${this.getQualityClass(pred.quality)}">
                ${this.getQualityLabel(pred.quality)}
              </span>
              <span class="sunset-time-small">
                🌅 ${this.formatTime(sunsetTime)}
              </span>
            </div>
          </div>
        `;
      }

      html += `
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
      const date = typeof time === 'string' ? new Date(time) : time;
      if (isNaN(date.getTime())) {
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
   * 绑定预测卡片点击事件
   * 
   * 任务 13.5：实现预测详情展开功能
   * - 绑定预测卡片点击事件
   * - 显示详细气象数据
   * 
   * 需求：7.4 - 当用户点击某一天的预测时，系统应显示该天的详细气象数据
   * 
   * @private
   */
  bindPredictionCardEvents() {
    // 获取所有预测卡片元素
    const forecastItems = document.querySelectorAll('.forecast-item');
    
    if (!forecastItems || forecastItems.length === 0) {
      console.log('未找到预测卡片元素，跳过事件绑定');
      return;
    }

    // 为每个预测卡片绑定点击事件
    forecastItems.forEach((item, index) => {
      // 移除旧的事件监听器（如果有）
      const newItem = item.cloneNode(true);
      item.parentNode.replaceChild(newItem, item);
      
      // 添加新的点击事件监听器
      newItem.addEventListener('click', () => {
        this.handlePredictionCardClick(index);
      });

      // 添加键盘可访问性支持
      newItem.setAttribute('tabindex', '0');
      newItem.setAttribute('role', 'button');
      newItem.setAttribute('aria-expanded', 'false');
      
      newItem.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.handlePredictionCardClick(index);
        }
      });
    });

    console.log(`已绑定 ${forecastItems.length} 个预测卡片的点击事件`);
  }

  /**
   * 处理预测卡片点击事件
   * 
   * 当用户点击预测卡片时：
   * 1. 如果该卡片已展开，则收起
   * 2. 如果该卡片未展开，则展开并显示详细气象数据
   * 3. 收起其他已展开的卡片
   * 
   * @param {number} index - 预测卡片的索引
   * @private
   */
  handlePredictionCardClick(index) {
    console.log(`预测卡片 ${index} 被点击`);

    // 检查是否有预测数据
    if (!this.predictions || this.predictions.length === 0) {
      console.warn('没有可用的预测数据');
      this.showError('暂无预测数据');
      return;
    }

    // 检查索引是否有效
    if (index < 0 || index >= this.predictions.length) {
      console.error(`无效的预测索引: ${index}`);
      return;
    }

    const prediction = this.predictions[index];

    // 如果点击的是已展开的卡片，则收起
    if (this.expandedPredictionIndex === index) {
      this.collapsePredictionDetails(index);
      this.expandedPredictionIndex = null;
      return;
    }

    // 收起之前展开的卡片
    if (this.expandedPredictionIndex !== null) {
      this.collapsePredictionDetails(this.expandedPredictionIndex);
    }

    // 展开新的卡片
    this.expandPredictionDetails(index, prediction);
    this.expandedPredictionIndex = index;
  }

  /**
   * 展开预测详情
   * 
   * 显示详细的气象数据，包括：
   * - 温度
   * - 湿度
   * - 云量
   * - 风速
   * - 气压
   * - 能见度
   * - 日落时间
   * 
   * @param {number} index - 预测卡片的索引
   * @param {Object} prediction - 预测数据对象
   * @private
   */
  expandPredictionDetails(index, prediction) {
    const forecastItems = document.querySelectorAll('.forecast-item');
    const forecastItem = forecastItems[index];

    if (!forecastItem) {
      console.error(`未找到索引为 ${index} 的预测卡片`);
      return;
    }

    // 更新 aria-expanded 属性
    forecastItem.setAttribute('aria-expanded', 'true');

    // 添加展开状态的样式类
    forecastItem.classList.add('expanded');

    // 检查是否已存在详情容器
    let detailsContainer = forecastItem.querySelector('.prediction-details');
    
    if (!detailsContainer) {
      // 创建详情容器
      detailsContainer = document.createElement('div');
      detailsContainer.className = 'prediction-details';
      forecastItem.appendChild(detailsContainer);
    }

    // 渲染详细气象数据
    detailsContainer.innerHTML = this.renderPredictionDetails(prediction);

    // 添加展开动画
    detailsContainer.style.maxHeight = '0';
    detailsContainer.style.overflow = 'hidden';
    detailsContainer.style.transition = 'max-height 0.3s ease-out';
    
    // 使用 setTimeout 触发动画
    setTimeout(() => {
      detailsContainer.style.maxHeight = detailsContainer.scrollHeight + 'px';
    }, 10);

    console.log(`预测详情已展开: 索引 ${index}`);
  }

  /**
   * 收起预测详情
   * 
   * @param {number} index - 预测卡片的索引
   * @private
   */
  collapsePredictionDetails(index) {
    const forecastItems = document.querySelectorAll('.forecast-item');
    const forecastItem = forecastItems[index];

    if (!forecastItem) {
      console.error(`未找到索引为 ${index} 的预测卡片`);
      return;
    }

    // 更新 aria-expanded 属性
    forecastItem.setAttribute('aria-expanded', 'false');

    // 移除展开状态的样式类
    forecastItem.classList.remove('expanded');

    // 获取详情容器
    const detailsContainer = forecastItem.querySelector('.prediction-details');
    
    if (detailsContainer) {
      // 添加收起动画
      detailsContainer.style.maxHeight = detailsContainer.scrollHeight + 'px';
      
      // 触发重排以确保动画生效
      detailsContainer.offsetHeight;
      
      detailsContainer.style.maxHeight = '0';
      
      // 动画结束后移除元素
      setTimeout(() => {
        if (detailsContainer.parentNode) {
          detailsContainer.remove();
        }
      }, 300);
    }

    console.log(`预测详情已收起: 索引 ${index}`);
  }

  /**
   * 渲染预测详情HTML
   *
   * 根据预测数据生成详细的气象信息HTML
   *
   * @param {Object} prediction - 预测数据对象
   * @returns {string} HTML字符串
   * @private
   */
  renderPredictionDetails(prediction) {
    // 检查预测对象是否有效
    if (!prediction) {
      return '<p class="error-text">无法加载预测详情</p>';
    }

    const factors = prediction.factors;
    if (!factors) {
      return '<p class="error-text">暂无详细数据</p>';
    }

    // 构建详情HTML
    let html = '<div class="prediction-details-content">';
    html += '<h3 class="details-title">详细气象数据</h3>';
    html += '<div class="details-grid">';

    // 从factors中获取数据
    // 温度
    if (factors.cloudCover && factors.cloudCover.value !== undefined) {
      // 使用日出日落时间对应的温度（这里简化显示）
      html += this.renderDetailItem('🌡️', '总评分', `${prediction.score.toFixed(0)}分`);
    }

    // 湿度
    if (factors.humidity && factors.humidity.value !== undefined) {
      html += this.renderDetailItem('💧', '湿度', `${factors.humidity.value.toFixed(0)}%`);
    }

    // 云量
    if (factors.cloudCover && factors.cloudCover.value !== undefined) {
      html += this.renderDetailItem('☁️', '云量', `${factors.cloudCover.value.toFixed(0)}%`);
    }

    // 能见度
    if (factors.visibility && factors.visibility.value !== undefined) {
      html += this.renderDetailItem('👁️', '能见度', `${factors.visibility.value.toFixed(1)} km`);
    }

    // 低云
    if (factors.lowClouds && factors.lowClouds.value !== undefined) {
      html += this.renderDetailItem('🌫️', '低云', `${factors.lowClouds.value.toFixed(0)}%`);
    }

    html += '</div>';

    // 日落/日出时间
    if (prediction.sunsetTime) {
      const timeLabel = prediction.type === 'sunrise' ? '日出时间' : '日落时间';
      html += '<div class="sunset-time-detail">';
      html += '<span class="sunset-icon">🌅</span>';
      html += '<div class="sunset-info">';
      html += `<span class="sunset-label">${timeLabel}</span>`;
      html += `<span class="sunset-value">${this.formatTime(prediction.sunsetTime)}</span>`;
      html += '</div>';
      html += '</div>';
    }

    // 最佳观赏窗口
    if (prediction.getOptimalViewingWindow) {
      const window = prediction.getOptimalViewingWindow();
      html += '<div class="viewing-window-detail">';
      html += '<span class="window-icon">⏰</span>';
      html += '<div class="window-info">';
      html += '<span class="window-label">最佳观赏时间</span>';
      html += `<span class="window-value">${this.formatTime(window.start)} - ${this.formatTime(window.end)}</span>`;
      html += '</div>';
      html += '</div>';
    }

    html += '</div>';

    return html;
  }

  /**
   * 渲染单个详情项
   * 
   * @param {string} icon - 图标
   * @param {string} label - 标签
   * @param {string} value - 值
   * @returns {string} HTML字符串
   * @private
   */
  renderDetailItem(icon, label, value) {
    return `
      <div class="detail-item">
        <span class="detail-icon">${icon}</span>
        <div class="detail-content">
          <span class="detail-label">${label}</span>
          <span class="detail-value">${value}</span>
        </div>
      </div>
    `;
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

      // 重新渲染预测显示
      this.updatePredictionDisplay(this.predictions);
    }
  }
}

export default PredictionController;
