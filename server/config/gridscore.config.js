/**
 * GridScoreService 配置文件
 * 
 * 集中管理网格评分服务的所有可配置参数
 * 修改此文件后重启服务即可生效，无需修改代码
 */

module.exports = {
  // 缓存配置
  cache: {
    // 缓存最大年龄（毫秒）
    // 默认3小时，日出和日落各刷新一次
    maxAgeMs: 3 * 60 * 60 * 1000,
    
    // 手动刷新频控（毫秒）
    // 默认30分钟
    manualRefreshCooldownMs: 30 * 60 * 1000,
    
    // 持久化文件路径
    cacheDir: require('os').homedir() + '/.xiake',
    cacheFile: 'grid-cache.json'
  },

  // 网格配置
  grid: {
    // 中国区域范围
    bounds: {
      lonMin: 73,   // 最西经度
      lonMax: 135,  // 最东经度
      latMin: 18,   // 最南纬度
      latMax: 53,   // 最北纬度
      step: 1.0     // 网格步长（度），先降采样提高稳定性
    }
  },

  // 批量抓取配置
  batch: {
    // 每次请求坐标数（为避免 Open-Meteo 429，降低批次）
    batchSize: 20
  },

  // 并发控制
  concurrency: {
    // 并发请求限制（为避免 Open-Meteo 429，降为串行）
    limit: 1
  },

  // API配置
  api: {
    // 天气数据预测时长（小时）
    forecastHours: 24
  }
};
