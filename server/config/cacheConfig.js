/**
 * 缓存配置文件
 *
 * 定义不同类型数据的TTL（过期时间）策略
 * 需求：22 (前后端分离 - Phase 4)
 */

// ========== 缓存 TTL 配置 ==========

const CACHE_TTL = {
  // 预测数据缓存（30分钟）
  // 理由：天气数据半小时内变化不大，但需要保持相对实时性
  PREDICTION: 30 * 60, // 1800秒 = 30分钟

  // 周边预测缓存（1小时）
  // 理由：周边区域较大，短时间内变化较小，可使用较长TTL
  SURROUNDING: 60 * 60, // 3600秒 = 1小时

  // 天气数据缓存（15分钟）
  // 理由：天气数据变化较快，需要较短的TTL以保持准确性
  WEATHER_DATA: 15 * 60, // 900秒 = 15分钟

  // 火烧云覆盖层缓存（30分钟）
  // 理由：覆盖层生成较慢，但云况变化相对较快
  FIRECLOUD_OVERLAY: 30 * 60, // 1800秒 = 30分钟

  // 火烧云网格评分缓存（20分钟）
  FIRECLOUD_GRID: 20 * 60, // 1200秒 = 20分钟

  // 火烧云瓦片 PNG 缓存（20分钟）
  FIRECLOUD_TILE: 20 * 60, // 1200秒 = 20分钟

  // 默认缓存时间（1小时）
  DEFAULT: 60 * 60 // 3600秒 = 1小时
};

// ========== 缓存键前缀 ==========

const CACHE_PREFIX = {
  // 预测数据
  PREDICTION: 'pred:',
  PREDICTION_ENHANCED: 'pred:enhanced:',
  PREDICTION_CANVAS: 'pred:canvas:',
  PREDICTION_RENDERING: 'pred:rendering:',

  // 周边数据
  SURROUNDING: 'surrounding:',

  // 天气数据
  WEATHER: 'weather:',

  // 覆盖层
  OVERLAY: 'overlay:',

  // GFS数据
  GFS_DATA: 'gfs:data:',
  GFS_OVERLAY: 'gfs:overlay:',

  // 火烧云瓦片
  FIRECLOUD_GRID: 'fc:grid:',
  FIRECLOUD_TILE: 'fc:tile:'
};

// ========== 缓存配置对象 ==========

const cacheConfig = {
  // TTL配置
  ttl: CACHE_TTL,

  // 键前缀
  prefix: CACHE_PREFIX,

  /**
   * 生成缓存键
   * @param {string} type - 缓存类型（使用CACHE_PREFIX中的键）
   * @param {string} identifier - 标识符（如坐标、日期等）
   * @returns {string} 完整的缓存键
   */
  buildKey(type, identifier) {
    const prefix = this.prefix[type] || '';
    return `${prefix}${identifier}`;
  },

  /**
   * 获取指定类型的TTL
   * @param {string} type - 缓存类型
   * @returns {number} TTL（秒）
   */
  getTTL(type) {
    return this.ttl[type] || this.ttl.DEFAULT;
  }
};

// ========== 导出 ==========

module.exports = cacheConfig;
