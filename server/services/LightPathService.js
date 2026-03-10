/**
 * LightPathService - 光路通透评分服务
 *
 * 基于分层云量（low/mid/high）评估太阳方位角方向的光路通透性。
 * Open-Meteo 提供 cloud_cover_low/mid/high，直接使用，无需 CAPE/convPrecip。
 *
 * 物理模型：
 * - 低云（< 2km）：直接遮挡光路，权重最高（0.7）
 * - 中云（2-6km）：适量中云有助于染色，超过 40% 才惩罚（权重 0.2）
 * - 高云（> 6km）：卷云几乎不阻光，超过 70% 才轻微惩罚（权重 0.1）
 */

const CloudLayerEstimator = require('./CloudLayerEstimator.js');

// ========== 常量 ==========

const CLOUD_LAYER_WEIGHTS = {
  LOW:  0.7,
  MID:  0.2,
  HIGH: 0.1
};

// ========== 辅助函数 ==========

/**
 * 检查分层云量是否缺失，需要用估算器补全
 */
function needsCloudLayerEstimation(weatherData) {
  const { lowClouds = 0, midClouds = 0, highClouds = 0, cloudCover = 0 } = weatherData;
  return (lowClouds === 0 && midClouds === 0 && highClouds === 0 && cloudCover > 0);
}

/**
 * 计算基于分层云量的光路得分
 *
 * @param {number} lowCloud  - 低云量 (0-100)
 * @param {number} midCloud  - 中云量 (0-100)
 * @param {number} highCloud - 高云量 (0-100)
 * @returns {number} 光路得分 (0-100)
 */
function scoreByCloudLayers(lowCloud, midCloud, highCloud) {
  // 低云：> 20% 开始快速下降
  const lowScore = lowCloud <= 20 ? 100
    : lowCloud >= 80 ? 0
    : 100 - ((lowCloud - 20) / 60) * 100;

  // 中云：> 40% 才开始下降
  const midScore = midCloud <= 40 ? 100
    : midCloud >= 90 ? 10
    : 100 - ((midCloud - 40) / 50) * 90;

  // 高云：> 70% 才轻微下降（最多降 30 分）
  const highScore = highCloud <= 70 ? 100
    : 100 - ((highCloud - 70) / 30) * 30;

  return Math.max(0, Math.min(100,
    lowScore  * CLOUD_LAYER_WEIGHTS.LOW  +
    midScore  * CLOUD_LAYER_WEIGHTS.MID  +
    highScore * CLOUD_LAYER_WEIGHTS.HIGH
  ));
}

// ========== 主类 ==========

class LightPathService {
  /**
   * 计算光路通透评分
   *
   * @param {Object} weatherData - 天气数据（含 lowClouds/midClouds/highClouds/cloudCover）
   * @returns {Object} 光路评分结果
   */
  scoreLightPath(weatherData) {
    if (!weatherData) {
      return { score: 50, breakdown: {}, estimated: false, reason: 'no_data' };
    }

    let { lowClouds = 0, midClouds = 0, highClouds = 0, cloudCover = 0 } = weatherData;
    let estimated = false;

    // 分层数据缺失时用估算器补全
    if (needsCloudLayerEstimation(weatherData)) {
      const est = CloudLayerEstimator.estimateCloudLayers(cloudCover, weatherData.temp || 15);
      lowClouds  = est.lowClouds;
      midClouds  = est.midClouds;
      highClouds = est.highClouds;
      estimated  = true;
    }

    const score = scoreByCloudLayers(lowClouds, midClouds, highClouds);

    return {
      score: parseFloat(score.toFixed(1)),
      breakdown: {
        lowClouds:  parseFloat(lowClouds.toFixed(1)),
        midClouds:  parseFloat(midClouds.toFixed(1)),
        highClouds: parseFloat(highClouds.toFixed(1))
      },
      estimated,
      weightsUsed: CLOUD_LAYER_WEIGHTS
    };
  }
}

// ========== 导出 ==========

const instance = new LightPathService();
module.exports = instance;
module.exports.LightPathService = LightPathService;
module.exports.scoreByCloudLayers = scoreByCloudLayers;
