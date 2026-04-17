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
    // 改为12小时，减少 Open-Meteo API 调用频率
    maxAgeMs: 12 * 60 * 60 * 1000,
    
    // 手动刷新频控（毫秒）
    // 默认30分钟
    manualRefreshCooldownMs: 30 * 60 * 1000,
    
    // 持久化文件路径
    cacheDir: require('os').homedir() + '/.xiake',
    cacheFile: 'grid-cache.json',
    // 断点续跑状态文件
    jobStateFile: 'grid-job-state.json'
  },

  // 网格配置
  grid: {
    // 默认中国区域范围（兼容旧配置）
    bounds: {
      lonMin: 73,
      lonMax: 135,
      latMin: 18,
      latMax: 53,
      step: 1.0
    },
    // 覆盖区域（中国 + 日本 + 韩国）
    regions: [
      { name: 'china', lonMin: 73, lonMax: 135, latMin: 18, latMax: 53 },
      { name: 'japan', lonMin: 129, lonMax: 146, latMin: 31, latMax: 46 },
      { name: 'korea', lonMin: 124, lonMax: 132, latMin: 33, latMax: 39.5 }
    ]
  },

  // 批量抓取配置
  batch: {
    // 每次请求坐标数（为避免 Open-Meteo 429，进一步降低批次）
    batchSize: 10,
    // 批次间隔（毫秒）
    delayMs: 2500
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
