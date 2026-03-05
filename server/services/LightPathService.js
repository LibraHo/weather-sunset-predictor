/**
 * 第三模块：光路逻辑（光路通透评分）
 * 包含 CAPE 和对流降水的安全检查和降级处理
 */

const CloudLayerEstimator = require('./CloudLayerEstimator.js');

// ========== 常量定义 ==========

const LIGHT_PATH_WEIGHTS = {
  NEAR: 0.4,    // 150km点权重
  FAR: 0.6      // 300km点权重（更重要）
};

const CAPE_WEIGHT = 0.5;     // CAPE 权重（降低到 50%）
const CONV_PRECIP_WEIGHT = 0.5; // 对流降水量权重（降低到 50%）

const CAPE_NEUTRAL_VALUE = 500; // 中等稳定性
const CONV_PRECIP_NEUTRAL_VALUE = 0; // 无对流降水

// ========== 辅助函数 ==========

/**
 * 安全获取 CAPE 值
 * @param {Object} weatherData - 天气数据
 * @returns {number} CAPE 值或中性值
 */
function getSafeCAPE(weatherData) {
  if (weatherData.cape === undefined || weatherData.cape === null) {
    return CAPE_NEUTRAL_VALUE;
  }
  return weatherData.cape;
}

/**
 * 安全获取对流降水量值
 * @param {Object} weatherData - 天气数据
 * @returns {number} 对流降水量值或零
 */
function getSafeConvPrecip(weatherData) {
  if (weatherData.convPrecip === undefined || weatherData.convPrecip === null) {
    return CONV_PRECIP_NEUTRAL_VALUE;
  }
  return weatherData.convPrecip;
}

/**
 * 检查分层云量是否缺失并需要使用估算器
 */
function shouldUseCloudLayerEstimator(weatherData) {
  const lowClouds = weatherData.lowClouds || 0;
  const midClouds = weatherData.midClouds || 0;
  const highClouds = weatherData.highClouds || 0;
  const cloudCover = weatherData.cloudCover || 0;
  
  // 所有分层云量都缺失或为 0 时，需要估算
  return (
    (lowClouds == null || lowClouds === undefined || lowClouds === 0) &&
    (midClouds == null || midClouds === undefined || midClouds === 0) &&
    (highClouds == null || highClouds === undefined || highClouds === 0) &&
    cloudCover > 0
  );
}

// ========== 主函数 ==========

/**
 * 计算光路通透评分
 * 包含 CAPE 和对流降水的安全检查和降级处理
 * 
 * @param {Object} weatherData - 天气数据
 * @returns {Object} 光路评分结果
 */
function scoreLightPath(weatherData) {
  // 基础验证：确保天气数据对象存在
  if (!weatherData) {
    return {
      score: 50,
      breakdown: { cape: 50, convPrecip: 50 },
      capeAvailable: false,
      convPrecipAvailable: false,
      weightsUsed: { cape: 0.5, convPrecip: 0.5 }
    };
  }

  // 检查是否需要使用云层估算器
  if (shouldUseCloudLayerEstimator(weatherData)) {
    const estimated = CloudLayerEstimator.estimateCloudLayers(
      weatherData.cloudCover || 0,
      weatherData.temp || 15
    );
    
    weatherData.lowClouds = estimated.lowClouds;
    weatherData.midClouds = estimated.midClouds;
    weatherData.highClouds = estimated.highClouds;
  }

  // 获取 CAPE 和对流降水量（安全检查）
  const cape = getSafeCAPE(weatherData);
  const convPrecip = getSafeConvPrecip(weatherData);

  // CAPE 评分
  let capeScore = 0;
  if (cape < 500) {
    capeScore = cape / 5; // 0-100 分
  } else if (cape < 2000) {
    capeScore = 80 + (cape - 500) / 30; // 500-2000: 80-100 分
  } else {
    capeScore = 100; // 极不稳定
  }

  // 对流降水量评分
  let convPrecipScore = 0;
  if (convPrecip < 0.1) {
    convPrecipScore = 100;
  } else if (convPrecip < 1) {
    convPrecipScore = 80;
  } else if (convPrecip < 5) {
    convPrecipScore = 40;
  } else {
    convPrecipScore = 0;
  }

  // 综合得分
  const lightPathScore = (capeScore * CAPE_WEIGHT) + (convPrecipScore * CONV_PRECIP_WEIGHT);

  return {
    score: Math.max(0, Math.min(100, lightPathScore)),
    breakdown: {
      cape: capeScore,
      convPrecip: convPrecipScore
    },
    capeAvailable: cape !== CAPE_NEUTRAL_VALUE,
    convPrecipAvailable: convPrecip !== CONV_PRECIP_NEUTRAL_VALUE,
    weightsUsed: {
      cape: CAPE_WEIGHT,
      convPrecip: CONV_PRECIP_WEIGHT
    },
    cloudLayerEstimated: shouldUseCloudLayerEstimator({
      lowClouds: weatherData.lowClouds,
      midClouds: weatherData.midClouds,
      highClouds: weatherData.highClouds,
      cloudCover: weatherData.cloudCover
    })
  };
}

module.exports = new LightPathService();
module.exports.LightPathService = LightPathService;
