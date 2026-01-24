/**
 * PredictionController - 晚霞预测控制器
 * 
 * 管理晚霞预测的生成和显示
 * 
 * 需求：7.1, 7.2 - 未来预测时间线
 * 需求：7.4 - 预测详情展开功能
 * 需求：12.1, 12.2, 12.3, 12.4, 12.5, 12.8, 12.11, 12.12, 12.13 - 朝霞晚霞预测增强功能
 */

import SunsetPredictionService from '../services/SunsetPredictionService.js';
import NotificationService from '../services/NotificationService.js';

class PredictionController {
  /**
   * 创建PredictionController实例
   * @param {StorageService} storageService - 存储服务实例
   */
  constructor(storageService) {
    this.storageService = storageService;
    this.predictionService = new SunsetPredictionService();
    this.notificationService = new NotificationService(storageService);
    this.predictions = []; // 存储当前预测数据
    this.expandedPredictionIndex = null; // 当前展开的预测索引
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

    const predictions = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 为未来3天生成预测
    for (let i = 0; i < 3; i++) {
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
        const sunriseWeatherData = weatherDataArray.find(data => {
          const timeDiff = Math.abs(data.timestamp - sunriseTimestamp);
          return timeDiff < 3600000; // 1小时内
        });

        if (sunriseWeatherData) {
          console.log(`[PredictionController] 找到日出相关天气数据`);

          const sunrisePrediction = this.predictionService.calculatePrediction(
            sunriseWeatherData,
            targetDate,
            location.lat,
            location.lon
          );

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

          predictions.push(sunrisePrediction);
        }

        // 2. 生成日落（晚霞）预测
        const sunsetTime = this.predictionService.getSunsetTime(
          targetDate,
          location.lat,
          location.lon
        );

        console.log(`[PredictionController] 日落时间:`, sunsetTime);

        const sunsetTimestamp = sunsetTime.getTime();
        const sunsetWeatherData = weatherDataArray.find(data => {
          const timeDiff = Math.abs(data.timestamp - sunsetTimestamp);
          return timeDiff < 3600000; // 1小时内
        });

        if (sunsetWeatherData) {
          console.log(`[PredictionController] 找到日落相关天气数据`);

          const sunsetPrediction = this.predictionService.calculatePrediction(
            sunsetWeatherData,
            targetDate,
            location.lat,
            location.lon
          );

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

    // 找到今天的朝霞和晚霞预测
    const todaySunrise = predictions.find(p => p.type === 'sunrise');
    const todaySunset = predictions.find(p => p.type === 'sunset');

    // 显示今日预测（同时显示朝霞和晚霞）
    this.updateTodayPredictions(todaySunrise, todaySunset);

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
   * @private
   */
  updateTodayPredictions(sunrisePrediction, sunsetPrediction) {
    const predictionSection = document.getElementById('prediction-section');
    const predictionDisplay = document.getElementById('prediction-display');

    if (!predictionDisplay) {
      console.error('未找到预测显示元素');
      return;
    }

    let html = '<div class="today-predictions-container">';

    // 朝霞预测
    if (sunrisePrediction) {
      html += this.renderSinglePrediction(sunrisePrediction, '🌄', '朝霞', '日出时间');
    }

    // 晚霞预测
    if (sunsetPrediction) {
      html += this.renderSinglePrediction(sunsetPrediction, '🌅', '晚霞', '日落时间');
    }

    html += '</div>';

    predictionDisplay.innerHTML = html;

    // 显示预测部分
    if (predictionSection) {
      predictionSection.classList.remove('hidden');
    }

    console.log('[PredictionController] 今日预测已更新');
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
  renderSinglePrediction(prediction, icon, title, timeLabel) {
    const viewingWindow = prediction.getOptimalViewingWindow();
    const analysis = this.generateAnalysisText(prediction);

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

    // 云层分层信息（需求12.11）
    let cloudLayersHtml = '';
    if (prediction.cloudLayers) {
      cloudLayersHtml = this.renderCloudLayers(prediction.cloudLayers);
    }

    return `
      <div class="prediction-card">
        <div class="prediction-header">
          <h3>${icon} 今日${title}预测</h3>
        </div>
        <div class="prediction-score-container">
          <div class="prediction-score ${this.getQualityClass(prediction.quality)}">
            ${prediction.score.toFixed(0)}
          </div>
          <div class="prediction-quality ${this.getQualityClass(prediction.quality)}">
            ${this.getQualityLabel(prediction.quality)}
          </div>
        </div>
        <div class="prediction-info">
          <div class="sunset-time">
            <span class="sunset-icon">${icon}</span>
            <span class="sunset-label">${timeLabel}</span>
            <span class="sunset-value">${this.formatTime(prediction.sunsetTime)}</span>
          </div>
          <div class="best-time">
            <span class="best-time-label">最佳观赏时间</span>
            <span class="best-time-value">${this.formatTime(viewingWindow.start)} - ${this.formatTime(viewingWindow.end)}</span>
          </div>
          ${enhancedInfo}
        </div>
        ${cloudLayersHtml}
        <div class="prediction-analysis">
          <h4>📊 分析原因</h4>
          <p class="analysis-text">${analysis}</p>
        </div>
        <div class="prediction-factors">
          <h4>影响因素</h4>
          <div class="factors-grid">
            ${this.renderFactor('云量', prediction.factors.cloudCover.score, prediction.factors.cloudCover.value.toFixed(0) + '%')}
            ${this.renderFactor('湿度', prediction.factors.humidity.score, prediction.factors.humidity.value.toFixed(0) + '%')}
            ${this.renderFactor('能见度', prediction.factors.visibility.score, prediction.factors.visibility.value.toFixed(1) + ' km')}
            ${this.renderFactor('低层云', prediction.factors.lowClouds.score, prediction.factors.lowClouds.value.toFixed(0) + '%')}
          </div>
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

    return `
      <div class="cloud-layers-section">
        <h4>☁️ 云层分层信息</h4>
        <div class="cloud-layers-grid">
          <div class="cloud-layer high-clouds">
            <span class="layer-icon">⛅</span>
            <span class="layer-label">高云 (>6km)</span>
            <span class="layer-value">${cloudLayers.high.toFixed(0)}%</span>
            <div class="layer-bar">
              <div class="layer-bar-fill" style="width: ${cloudLayers.high}%; background-color: #90caf9;"></div>
            </div>
          </div>
          <div class="cloud-layer mid-clouds">
            <span class="layer-icon">☁️</span>
            <span class="layer-label">中云 (2-6km)</span>
            <span class="layer-value">${cloudLayers.mid.toFixed(0)}%</span>
            <div class="layer-bar">
              <div class="layer-bar-fill" style="width: ${cloudLayers.mid}%; background-color: #64b5f6;"></div>
            </div>
          </div>
          <div class="cloud-layer low-clouds">
            <span class="layer-icon">🌫️</span>
            <span class="layer-label">低云 (<2km)</span>
            <span class="layer-value">${cloudLayers.low.toFixed(0)}%</span>
            <div class="layer-bar">
              <div class="layer-bar-fill" style="width: ${cloudLayers.low}%; background-color: #42a5f5;"></div>
            </div>
          </div>
        </div>
        <div class="cloud-layers-description">
          <p>${cloudLayers.description}</p>
        </div>
      </div>
    `;
  }

  /**
   * 生成预测分析文字
   * @param {Object} prediction - 预测数据
   * @returns {string} 分析文字
   * @private
   */
  generateAnalysisText(prediction) {
    const factors = prediction.factors;
    const cloudValue = factors.cloudCover.value;
    const humidityValue = factors.humidity.value;
    const visibilityValue = factors.visibility.value;
    const lowCloudsValue = factors.lowClouds.value;

    let analysis = '';

    // 总体评价
    if (prediction.score >= 70) {
      analysis += '今天的气象条件非常适合观赏' + (prediction.typeName || '晚霞') + '！';
    } else if (prediction.score >= 40) {
      analysis += '今天的气象条件较为适合观赏' + (prediction.typeName || '晚霞') + '。';
    } else {
      analysis += '今天的气象条件不太理想。';
    }

    // 云量分析
    if (cloudValue >= 30 && cloudValue <= 70) {
      analysis += ' 云量适中（' + cloudValue.toFixed(0) + '%），有利于形成绚丽的色彩。';
    } else if (cloudValue < 30) {
      analysis += ' 云量偏少（' + cloudValue.toFixed(0) + '%），可能缺少足够的云层来反射光线。';
    } else {
      analysis += ' 云量较多（' + cloudValue.toFixed(0) + '%），可能遮挡过多阳光。';
    }

    // 湿度分析
    if (humidityValue >= 30 && humidityValue <= 70) {
      analysis += ' 湿度适宜（' + humidityValue.toFixed(0) + '%），空气中的水汽有助于光线散射。';
    } else if (humidityValue < 30) {
      analysis += ' 湿度偏低（' + humidityValue.toFixed(0) + '%），空气较干燥。';
    } else {
      analysis += ' 湿度较高（' + humidityValue.toFixed(0) + '%），可能影响能见度。';
    }

    // 能见度分析
    if (visibilityValue >= 10) {
      analysis += ' 能见度良好（' + visibilityValue.toFixed(1) + ' km），视野清晰。';
    } else if (visibilityValue >= 5) {
      analysis += ' 能见度一般（' + visibilityValue.toFixed(1) + ' km）。';
    } else {
      analysis += ' 能见度较差（' + visibilityValue.toFixed(1) + ' km），可能有雾霾。';
    }

    // 低层云分析
    if (lowCloudsValue < 20) {
      analysis += ' 低层云较少，不会遮挡视线。';
    } else if (lowCloudsValue < 40) {
      analysis += ' 有一些低层云，可能略微影响观赏效果。';
    } else {
      analysis += ' 低层云较多（' + lowCloudsValue.toFixed(0) + '%），可能遮挡部分景观。';
    }

    return analysis;
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

    // 构建时间线HTML
    let html = '<div class="forecast-list">';

    Object.values(predictionsByDate).forEach((dayPredictions, index) => {
      const dateStr = this.formatDate(dayPredictions.date);
      const dayLabel = index === 0 ? '今天' : index === 1 ? '明天' : '后天';

      html += `
        <div class="forecast-day-group">
          <div class="forecast-day-header">
            <span class="day-label">${dayLabel}</span>
            <span class="date-label">${dateStr}</span>
          </div>
          <div class="forecast-day-predictions">
      `;

      // 朝霞预测
      if (dayPredictions.sunrise) {
        const pred = dayPredictions.sunrise;
        html += `
          <div class="forecast-item" data-index="${predictions.indexOf(pred)}">
            <div class="forecast-header">
              <div class="forecast-type">
                <span class="type-icon">🌄</span>
                <span class="type-label">朝霞</span>
              </div>
              <div class="forecast-score ${this.getQualityClass(pred.quality)}">
                ${pred.score.toFixed(0)}
              </div>
            </div>
            <div class="forecast-summary">
              <span class="quality-badge ${this.getQualityClass(pred.quality)}">
                ${this.getQualityLabel(pred.quality)}
              </span>
              <span class="sunset-time-small">
                🌄 ${this.formatTime(pred.sunsetTime)}
              </span>
            </div>
          </div>
        `;
      }

      // 晚霞预测
      if (dayPredictions.sunset) {
        const pred = dayPredictions.sunset;
        html += `
          <div class="forecast-item" data-index="${predictions.indexOf(pred)}">
            <div class="forecast-header">
              <div class="forecast-type">
                <span class="type-icon">🌅</span>
                <span class="type-label">晚霞</span>
              </div>
              <div class="forecast-score ${this.getQualityClass(pred.quality)}">
                ${pred.score.toFixed(0)}
              </div>
            </div>
            <div class="forecast-summary">
              <span class="quality-badge ${this.getQualityClass(pred.quality)}">
                ${this.getQualityLabel(pred.quality)}
              </span>
              <span class="sunset-time-small">
                🌅 ${this.formatTime(pred.sunsetTime)}
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

    console.log('[PredictionController] 预测时间线已更新');
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
    const labelMap = {
      'excellent': '优秀',
      'good': '良好',
      'fair': '一般',
      'poor': '较差'
    };
    return labelMap[quality] || '一般';
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
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      return `${month}月${day}日`;
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

    // 构建详情HTML
    let html = '<div class="prediction-details-content">';
    html += '<h3 class="details-title">详细气象数据</h3>';
    html += '<div class="details-grid">';

    // 温度
    if (prediction.temperature !== undefined) {
      html += this.renderDetailItem('🌡️', '温度', `${prediction.temperature}°C`);
    }

    // 湿度
    if (prediction.humidity !== undefined) {
      html += this.renderDetailItem('💧', '湿度', `${prediction.humidity}%`);
    }

    // 云量
    if (prediction.cloudCover !== undefined) {
      html += this.renderDetailItem('☁️', '云量', `${prediction.cloudCover}%`);
    }

    // 风速
    if (prediction.windSpeed !== undefined) {
      html += this.renderDetailItem('💨', '风速', `${prediction.windSpeed} km/h`);
    }

    // 气压
    if (prediction.pressure !== undefined) {
      html += this.renderDetailItem('🌡️', '气压', `${prediction.pressure} hPa`);
    }

    // 能见度
    if (prediction.visibility !== undefined) {
      html += this.renderDetailItem('👁️', '能见度', `${prediction.visibility} km`);
    }

    html += '</div>';

    // 日落时间
    if (prediction.sunsetTime) {
      html += '<div class="sunset-time-detail">';
      html += '<span class="sunset-icon">🌅</span>';
      html += '<div class="sunset-info">';
      html += '<span class="sunset-label">最佳观赏时间</span>';
      html += `<span class="sunset-value">${this.formatSunsetTime(prediction.sunsetTime)}</span>`;
      html += '</div>';
      html += '</div>';
    }

    // 影响因素说明
    if (prediction.factors) {
      html += '<div class="factors-explanation">';
      html += '<h4>影响因素分析</h4>';
      html += '<ul class="factors-list">';
      
      if (prediction.factors.cloudScore !== undefined) {
        html += `<li>云量评分: ${prediction.factors.cloudScore.toFixed(1)}</li>`;
      }
      if (prediction.factors.humidityScore !== undefined) {
        html += `<li>湿度评分: ${prediction.factors.humidityScore.toFixed(1)}</li>`;
      }
      if (prediction.factors.visibilityScore !== undefined) {
        html += `<li>能见度评分: ${prediction.factors.visibilityScore.toFixed(1)}</li>`;
      }
      
      html += '</ul>';
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
}

export default PredictionController;
