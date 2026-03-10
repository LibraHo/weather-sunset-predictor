/**
 * 分层云量估算器
 *
 * 用于在提供商（如 Open-Meteo）不返回分层云量时，
 * 基于总云量和温度进行保守估算。
 */

class CloudLayerEstimator {
  /**
   * 基于总云量和温度估算分层云量
   * 
   * @param {number} totalCloudCover - 总云量 (0-100)
   * @param {number} temperature - 温度 (°C)
   * @returns {{ lowClouds: number, midClouds: number, highClouds: number, estimated: boolean, confidence: number }}
   */
  estimateCloudLayers(totalCloudCover, temperature) {
    // 基础验证
    if (totalCloudCover < 0 || totalCloudCover > 100) {
      throw new Error('CloudLayerEstimator: 总云量必须在 0-100 范围内');
    }

    if (typeof temperature !== 'number' || isNaN(temperature)) {
      throw new Error('CloudLayerEstimator: 温度必须为数字');
    }

    // 温度影响因子
    // 温度低时，容易形成低云
    // 温度高时，容易形成高云（对流增强）
    let tempFactor = 0;
    if (temperature < 0) {
      tempFactor = 0.3;  // 低温，低云概率高
    } else if (temperature >= 30) {
      tempFactor = -0.2; // 高温，高云概率高
    }

    // 估算分层云量
    const baseLow = totalCloudCover * 0.4 + (tempFactor * 20);
    const baseMid = totalCloudCover * 0.3;
    const baseHigh = totalCloudCover * 0.3 - (tempFactor * 20);

    // 确保分层云量在合理范围内
    const lowClouds = Math.max(0, Math.min(100, baseLow));
    const midClouds = Math.max(0, Math.min(100, baseMid));
    const highClouds = Math.max(0, Math.min(100, baseHigh));

    // 计算置信度
    // 总云量接近 0 或 100 时，置信度较高
    // 总云量接近 50 时，不确定性较大
    let confidence = 0.5; // 默认置信度 50%
    if (totalCloudCover < 20 || totalCloudCover > 80) {
      confidence = 0.8; // 高置信度
    } else if (totalCloudCover < 40 || totalCloudCover > 60) {
      confidence = 0.6; // 中置信度
    } else {
      confidence = 0.4; // 低置信度（总云量 40-60% 时最不确定）
    }

    // 置信度标记（保守原则：不标记为高置信度）
    return {
      lowClouds,
      midClouds,
      highClouds,
      estimated: true,
      confidence
    };
  }

  /**
   * 判断是否需要使用估算器
   * 
   * @param {number} lowClouds - 低云量
   * @param {number} midClouds - 中云量
   * @param {number} highClouds - 高云量
   * @returns {boolean}
   */
  shouldEstimate(lowClouds, midClouds, highClouds, cloudCover = 0) {
    // 所有分层云量都缺失或为 0，且总云量有值时，需要估算
    return (
      (!lowClouds  || lowClouds  === 0) &&
      (!midClouds  || midClouds  === 0) &&
      (!highClouds || highClouds === 0) &&
      cloudCover > 0
    );
  }

  /**
   * 估算置信度标签
   * 
   * @param {number} confidence - 置信度 (0-1)
   * @returns {string} 置信度标签
   */
  getConfidenceLabel(confidence) {
    if (confidence >= 0.8) {
      return 'high';   // 高置信度
    } else if (confidence >= 0.6) {
      return 'medium'; // 中置信度
    } else if (confidence >= 0.4) {
      return 'low';    // 低置信度
    } else {
      return 'very-low'; // 极低置信度
    }
  }
}

module.exports = new CloudLayerEstimator();
module.exports.CloudLayerEstimator = CloudLayerEstimator;
