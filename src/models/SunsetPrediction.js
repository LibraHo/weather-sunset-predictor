/**
 * SunsetPrediction - 晚霞预测结果模型
 * 
 * 表示特定日期的火烧云（晚霞/朝霞）预测结果
 * 
 * 需求：5.5, 5.6, 5.7, 5.8 - 预测质量评分和分类
 * 需求：12.1, 12.2, 12.3, 12.4, 12.5, 12.11 - 朝霞晚霞预测增强功能
 */

class SunsetPrediction {
  /**
   * 创建晚霞/朝霞预测对象
   * 
   * @param {Date} date - 预测日期
   * @param {number} score - 预测评分（0-100）
   * @param {string} quality - 质量等级：'excellent', 'good', 'fair'
   * @param {Object} factors - 影响因素对象，包含各气象因素的得分
   * @param {Date} sunsetTime - 日落时间
   * @param {Date} sunriseTime - 日出时间（需求12.1）
   * @param {string} type - 预测类型：'sunrise' 或 'sunset'（需求12.4）
   * @param {Object} goldenHour - 黄金时段 {start, end}（需求12.2）
   * @param {Object} blueHour - 蓝调时段 {start, end}（需求12.3）
   * @param {number} sunAzimuth - 太阳方位角（度数）（需求12.5）
   * @param {Object} cloudLayers - 云层分层信息 {high, mid, low, description}（需求12.11）
   * 
   * 需求：5.5 - 输出0-100的预测质量评分
   * 需求：5.6, 5.7, 5.8 - 根据评分标记质量等级
   */
  constructor(date, score, quality, factors, sunsetTime, sunriseTime = null, type = 'sunset', goldenHour = null, blueHour = null, sunAzimuth = null, cloudLayers = null) {
    this.date = date;
    this.score = score;
    this.quality = quality;
    this.factors = factors;
    this.sunsetTime = sunsetTime;
    this.sunriseTime = sunriseTime;
    this.type = type;
    this.goldenHour = goldenHour;
    this.blueHour = blueHour;
    this.sunAzimuth = sunAzimuth;
    this.cloudLayers = cloudLayers;
  }

  /**
   * 获取质量等级的中文标签
   * 
   * @returns {string} 质量等级标签
   * 
   * 需求：5.6 - 评分高于70时标记为"优秀"
   * 需求：5.7 - 评分在40-70之间时标记为"良好"
   * 需求：5.8 - 评分低于40时标记为"一般"
   */
  getQualityLabel() {
    if (this.score >= 70) return '优秀';
    if (this.score >= 40) return '良好';
    return '一般';
  }

  /**
   * 获取最佳观赏时间窗口
   * 
   * @returns {Object} 包含开始和结束时间的对象
   * 
   * 需求：6.4 - 显示最佳观赏时间（日落前后30分钟）
   */
  getOptimalViewingWindow() {
    const referenceTime = this.type === 'sunrise' ? this.sunriseTime : this.sunsetTime;
    if (!referenceTime) return { start: null, end: null, description: '时间未知' };
    const start = new Date(referenceTime.getTime() - 30 * 60 * 1000);
    const end = new Date(referenceTime.getTime() + 30 * 60 * 1000);
    
    return {
      start,
      end,
      referenceTime
    };
  }

  /**
   * 获取预测类型的中文标签
   * 
   * @returns {string} 预测类型标签
   * 
   * 需求：12.4 - 朝霞和晚霞的独立预测
   */
  getTypeLabel() {
    return this.type === 'sunrise' ? '朝霞' : '晚霞';
  }

  /**
   * 判断是否应该显示太阳方位角
   * 
   * @returns {boolean} 是否显示方位角
   * 
   * 需求：12.5 - 显示太阳方位角信息（存在即显示）
   */
  shouldShowAzimuth() {
    return this.sunAzimuth !== null && this.sunAzimuth !== undefined;
  }

  /**
   * 获取方位角的方向描述
   * 
   * @returns {string} 方向描述（如"东北"、"西南"等）
   * 
   * 需求：12.5 - 太阳方位角信息
   */
  getAzimuthDirection() {
    if (this.sunAzimuth === null) return '';

    const directions = [
      '北', '东北偏北', '东北', '东北偏东',
      '东', '东南偏东', '东南', '东南偏南',
      '南', '西南偏南', '西南', '西南偏西',
      '西', '西北偏西', '西北', '西北偏北'
    ];

    const index = Math.round(this.sunAzimuth / 22.5) % 16;
    return directions[index];
  }

  /**
   * 将预测对象转换为JSON格式
   * 
   * @returns {Object} JSON对象
   */
  toJSON() {
    return {
      date: this.date,
      score: this.score,
      quality: this.quality,
      factors: this.factors,
      sunsetTime: this.sunsetTime,
      sunriseTime: this.sunriseTime,
      type: this.type,
      goldenHour: this.goldenHour,
      blueHour: this.blueHour,
      sunAzimuth: this.sunAzimuth,
      cloudLayers: this.cloudLayers
    };
  }

  /**
   * 从JSON对象创建预测实例
   * 
   * @param {Object} json - JSON对象
   * @returns {SunsetPrediction} 预测实例
   */
  static fromJSON(json) {
    return new SunsetPrediction(
      new Date(json.date),
      json.score,
      json.quality,
      json.factors,
      new Date(json.sunsetTime),
      json.sunriseTime ? new Date(json.sunriseTime) : null,
      json.type || 'sunset',
      json.goldenHour,
      json.blueHour,
      json.sunAzimuth,
      json.cloudLayers
    );
  }
}

export default SunsetPrediction;
