/**
 * PredictionService - 基础火烧云预测服务（后端版）
 *
 * 分析气象数据，计算火烧云（晚霞/朝霞）出现的可能性和质量
 * 复用 SunCalculator 和 GaussianScore 工具类
 *
 * 需求：22 (前后端分离 - Phase 1)
 * @author Backend Migration v1.0
 */

const SunCalculator = require('../utils/SunCalculator.js');
const GaussianScore = require('../utils/GaussianScore.js');

// ========== 服务类定义 ==========

class PredictionService {
  /**
   * 创建预测服务实例
   *
   * @param {Object} options - 配置选项
   * @param {Object} options.weights - 自定义权重（可选）
   */
  constructor(options = {}) {
    this.weights = options.weights || GaussianScore.DEFAULT_WEIGHTS;
  }

  /**
   * 计算火烧云预测
   *
   * 整合各气象因素评分，计算加权总分，并确定质量等级
   *
   * @param {Object} weatherData - 天气数据对象
   * @param {Date|string} date - 预测日期
   * @param {number} lat - 纬度（-90到90）
   * @param {number} lon - 经度（-180到180）
   * @param {string} type - 预测类型：'sunrise' 或 'sunset'
   * @returns {Object} 预测结果对象（对齐前端 SunsetPrediction 模型）
   *
   * 需求：22.1, 22.2, 22.3 - 核心预测算法后端化
   */
  calculatePrediction(weatherData, date, lat, lon, type = 'sunset') {
    // ========== 参数验证 ==========

    if (!weatherData || typeof weatherData !== 'object') {
      throw new Error('无效的天气数据对象');
    }

    // 将日期字符串转换为 Date 对象
    if (typeof date === 'string') {
      date = new Date(date);
    }

    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
      throw new Error('无效的日期对象');
    }

    if (typeof lat !== 'number' || lat < -90 || lat > 90) {
      throw new Error('纬度必须在-90到90之间');
    }

    if (typeof lon !== 'number' || lon < -180 || lon > 180) {
      throw new Error('经度必须在-180到180之间');
    }

    if (!['sunrise', 'sunset'].includes(type)) {
      throw new Error('预测类型必须是 sunrise 或 sunset');
    }

    // ========== 计算日出/日落时间 ==========

    const sunsetTime = SunCalculator.getSunsetTime(date, lat, lon);
    const sunriseTime = SunCalculator.getSunriseTime(date, lat, lon);

    // ========== 计算各因素得分 ==========

    const scores = GaussianScore.calculateAllScores(weatherData);

    // 构建因素详情对象（包含值和得分）
    const factors = {
      cloudCover: {
        value: weatherData.cloudCover || 0,
        score: scores.cloudCover
      },
      humidity: {
        value: weatherData.humidity || 0,
        score: scores.humidity
      },
      visibility: {
        value: weatherData.visibility || 0,
        score: scores.visibility
      },
      lowClouds: {
        value: weatherData.lowCloudCover || weatherData.cloudCover || 0,
        score: scores.lowClouds
      }
    };

    // ========== 计算加权总分和质量等级 ==========

    const totalScore = GaussianScore.calculateWeightedScore(scores, this.weights);
    const quality = GaussianScore.getQualityLevel(totalScore);

    // ========== 计算黄金时段和蓝调时段 ==========

    const referenceTime = type === 'sunrise' ? sunriseTime : sunsetTime;
    const goldenHour = SunCalculator.getGoldenHour(referenceTime, type);
    const blueHour = SunCalculator.getBlueHour(referenceTime, type);

    // ========== 计算太阳方位角（与评分无关）==========

    const sunAzimuth = SunCalculator.getSunAzimuth(date, referenceTime, lat, lon);

    // ========== 分析云层分层 ==========

    const cloudLayers = SunCalculator.analyzeCloudLayers(
      weatherData.highClouds || 0,
      weatherData.midClouds || 0,
      weatherData.lowClouds || 0
    );

    // ========== 构建预测结果（对齐前端 SunsetPrediction 模型）==========

    return {
      date: date,
      score: totalScore,
      quality: quality,
      factors: factors,
      sunsetTime: sunsetTime,
      sunriseTime: sunriseTime,
      type: type,
      goldenHour: goldenHour,
      blueHour: blueHour,
      sunAzimuth: sunAzimuth,
      cloudLayers: cloudLayers
    };
  }

  /**
   * 计算预测评分（不包含时间计算）
   *
   * 仅计算各因素得分、加权总分和质量等级
   *
   * @param {Object} weatherData - 天气数据对象
   * @returns {Object} {factors, score, quality}
   */
  calculateScore(weatherData) {
    if (!weatherData || typeof weatherData !== 'object') {
      throw new Error('无效的天气数据对象');
    }

    const scores = GaussianScore.calculateAllScores(weatherData);

    const factors = {
      cloudCover: {
        value: weatherData.cloudCover || 0,
        score: scores.cloudCover
      },
      humidity: {
        value: weatherData.humidity || 0,
        score: scores.humidity
      },
      visibility: {
        value: weatherData.visibility || 0,
        score: scores.visibility
      },
      lowClouds: {
        value: weatherData.lowCloudCover || weatherData.cloudCover || 0,
        score: scores.lowClouds
      }
    };

    const totalScore = GaussianScore.calculateWeightedScore(scores, this.weights);
    const quality = GaussianScore.getQualityLevel(totalScore);

    return {
      factors,
      score: totalScore,
      quality
    };
  }

  /**
   * 获取质量等级
   *
   * @param {number} score - 评分（0-100）
   * @returns {string} 质量等级
   */
  getQuality(score) {
    return GaussianScore.getQualityLevel(score);
  }
}

// ========== 导出 ==========

module.exports = PredictionService;
