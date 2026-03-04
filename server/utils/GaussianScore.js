/**
 * GaussianScore - 高斯评分函数工具
 *
 * 提供基于高斯分布和指数函数的评分方法，用于评估各气象因素对火烧云形成的影响
 *
 * 需求：22.3 - 高斯评分函数工具
 *
 * @module server/utils/GaussianScore
 */

/**
 * 默认权重配置
 */
const DEFAULT_WEIGHTS = {
  cloudCover: 0.35,   // 云量权重（最重要）
  humidity: 0.25,     // 湿度权重
  visibility: 0.20,   // 能见度权重
  lowClouds: 0.20     // 低层云权重
};

/**
 * 高斯函数
 *
 * 计算高斯分布值：f(x) = amplitude * exp(-(x - mean)^2 / (2 * sigma^2))
 *
 * @param {number} x - 输入值
 * @param {number} mean - 均值（最优值）
 * @param {number} sigma - 标准差（控制曲线宽度）
 * @param {number} amplitude - 振幅（最大值，默认 100）
 * @returns {number} 高斯函数值
 */
function gaussian(x, mean, sigma, amplitude = 100) {
  return amplitude * Math.exp(-Math.pow(x - mean, 2) / (2 * sigma * sigma));
}

/**
 * 评估云量因素得分
 *
 * 中高层云量在 30-70% 范围内最佳，使用高斯分布曲线评分
 * - 最优值：50%
 * - 标准差：20（30-70% 范围内得分较高）
 *
 * @param {number} cloudCover - 云量百分比（0-100）
 * @returns {number} 评分（0-100）
 *
 * 需求：5.1 - 分析中高层云量（30-70% 为最佳）
 */
function scoreCloudCover(cloudCover) {
  // 验证输入
  if (typeof cloudCover !== 'number' || cloudCover < 0 || cloudCover > 100) {
    return 0;
  }

  const optimal = 50;  // 最佳云量
  const sigma = 20;    // 标准差

  const score = gaussian(cloudCover, optimal, sigma);
  return Math.max(0, Math.min(100, score));
}

/**
 * 评估湿度因素得分
 *
 * 相对湿度在 30-70% 范围内最佳，使用高斯分布曲线评分
 * - 最优值：50%
 * - 标准差：20
 *
 * @param {number} humidity - 相对湿度百分比（0-100）
 * @returns {number} 评分（0-100）
 *
 * 需求：5.2 - 评估相对湿度（30-70% 为最佳范围）
 */
function scoreHumidity(humidity) {
  // 验证输入
  if (typeof humidity !== 'number' || humidity < 0 || humidity > 100) {
    return 0;
  }

  const optimal = 50;  // 最佳湿度
  const sigma = 20;    // 标准差

  const score = gaussian(humidity, optimal, sigma);
  return Math.max(0, Math.min(100, score));
}

/**
 * 评估能见度因素得分
 *
 * 能见度越高越好，使用指数增长曲线评分
 * - 10km 得约 49 分
 * - 20km 得约 74 分
 * - 30km 得约 86 分
 *
 * @param {number} visibility - 能见度（公里）
 * @returns {number} 评分（0-100）
 *
 * 需求：5.3 - 考虑能见度因素（高能见度加分）
 */
function scoreVisibility(visibility) {
  // 验证输入
  if (typeof visibility !== 'number' || visibility < 0) {
    return 0;
  }

  if (visibility === 0) {
    return 0;
  }

  // 使用指数曲线，能见度越高得分越高
  // 1 - exp(-x/15) 在 x=15 时约为 0.63，x=30 时约为 0.86
  const score = 100 * (1 - Math.exp(-visibility / 15));
  return Math.max(0, Math.min(100, score));
}

/**
 * 评估低层云因素得分
 *
 * 低层云越少越好，使用指数衰减曲线评分
 * - 0% 得 100 分
 * - 20% 得约 37 分
 * - 50% 得约 8 分
 * - 100% 得约 0.7 分
 *
 * @param {number} lowCloudCover - 低层云量百分比（0-100）
 * @returns {number} 评分（0-100）
 *
 * 需求：5.4 - 检查低层云量（低层云少为佳）
 */
function scoreLowClouds(lowCloudCover) {
  // 验证输入
  if (typeof lowCloudCover !== 'number' || lowCloudCover < 0 || lowCloudCover > 100) {
    return 0;
  }

  // 低层云越少得分越高，使用指数衰减
  // exp(-x/20) 在 x=0 时为 1，x=20 时约为 0.37，x=50 时约为 0.08
  const score = 100 * Math.exp(-lowCloudCover / 20);
  return Math.max(0, Math.min(100, score));
}

/**
 * 计算加权总分
 *
 * @param {Object} scores - 各因素得分对象
 * @param {number} scores.cloudCover - 云量得分
 * @param {number} scores.humidity - 湿度得分
 * @param {number} scores.visibility - 能见度得分
 * @param {number} scores.lowClouds - 低层云得分
 * @param {Object} weights - 权重配置（可选，默认使用 DEFAULT_WEIGHTS）
 * @returns {number} 加权总分（0-100）
 */
function calculateWeightedScore(scores, weights = DEFAULT_WEIGHTS) {
  const totalScore =
    (scores.cloudCover || 0) * weights.cloudCover +
    (scores.humidity || 0) * weights.humidity +
    (scores.visibility || 0) * weights.visibility +
    (scores.lowClouds || 0) * weights.lowClouds;

  return Math.max(0, Math.min(100, Math.round(totalScore)));
}

/**
 * 根据评分确定质量等级
 *
 * @param {number} score - 评分（0-100）
 * @returns {string} 质量等级：'excellent' | 'good' | 'fair'
 *
 * 需求：5.6, 5.7, 5.8 - 评分等级划分
 */
function getQualityLevel(score) {
  if (score >= 70) {
    return 'excellent';  // 优秀
  } else if (score >= 40) {
    return 'good';       // 良好
  } else {
    return 'fair';       // 一般
  }
}

/**
 * 计算所有因素得分
 *
 * @param {Object} weatherData - 天气数据对象
 * @param {number} weatherData.cloudCover - 云量百分比
 * @param {number} weatherData.humidity - 相对湿度百分比
 * @param {number} weatherData.visibility - 能见度（公里）
 * @param {number} weatherData.lowCloudCover - 低层云量百分比（可选，默认使用 cloudCover）
 * @returns {Object} 各因素得分对象
 */
function calculateAllScores(weatherData) {
  return {
    cloudCover: scoreCloudCover(weatherData.cloudCover || 0),
    humidity: scoreHumidity(weatherData.humidity || 0),
    visibility: scoreVisibility(weatherData.visibility || 0),
    lowClouds: scoreLowClouds(weatherData.lowCloudCover || weatherData.cloudCover || 0)
  };
}

/**
 * 一次性计算预测评分
 *
 * 便捷方法：计算所有因素得分、加权总分和质量等级
 *
 * @param {Object} weatherData - 天气数据对象
 * @param {Object} weights - 权重配置（可选）
 * @returns {Object} {scores, totalScore, quality}
 */
function calculatePredictionScore(weatherData, weights = DEFAULT_WEIGHTS) {
  const scores = calculateAllScores(weatherData);
  const totalScore = calculateWeightedScore(scores, weights);
  const quality = getQualityLevel(totalScore);

  return {
    scores,
    totalScore,
    quality
  };
}

module.exports = {
  // 核心评分函数
  scoreCloudCover,
  scoreHumidity,
  scoreVisibility,
  scoreLowClouds,

  // 聚合函数
  calculateWeightedScore,
  calculateAllScores,
  calculatePredictionScore,

  // 辅助函数
  gaussian,
  getQualityLevel,

  // 常量
  DEFAULT_WEIGHTS
};
