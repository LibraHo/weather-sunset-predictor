/**
 * API 配置文件
 * 用于管理 Windy API 的访问模式
 */

const API_CONFIG = {
  // API 访问模式: 'proxy' | 'direct'
  // - proxy: 通过后端服务器代理（推荐，更安全）
  // - direct: 前端直接调用（需要 API 密钥）
  mode: 'proxy',

  // 后端服务器配置（当 mode='proxy' 时使用）
  proxy: {
    url: 'http://localhost:3000',
    description: '后端代理服务器地址'
  },

  // Windy API 配置（当 mode='direct' 时使用）
  direct: {
    apiKey: '', // 用户需要在设置中配置
    description: 'Windy API 密钥（仅在直连模式下需要）'
  },

  // ========== 前后端分离功能开关（需求22）==========

  // 功能迁移开关 - 控制哪些功能使用后端 API
  features: {
    // Phase 1: 基础预测服务后端化
    USE_BACKEND_PREDICTION: true,

    // Phase 2: 周边采样聚合后端化
    USE_BACKEND_SURROUNDING: false,

    // Phase 3: 增强预测模型后端化
    USE_BACKEND_ENHANCED: false
  }
};

// 从 localStorage 读取用户配置（如果有）
function loadConfig() {
  const savedMode = localStorage.getItem('api_mode');
  if (savedMode) {
    API_CONFIG.mode = savedMode;
  }

  const savedProxyUrl = localStorage.getItem('api_proxy_url');
  if (savedProxyUrl) {
    API_CONFIG.proxy.url = savedProxyUrl;
  }

  // 读取功能开关配置
  const savedFeatures = localStorage.getItem('api_features');
  if (savedFeatures) {
    try {
      const parsedFeatures = JSON.parse(savedFeatures);
      Object.assign(API_CONFIG.features, parsedFeatures);
    } catch (error) {
      console.warn('[config.api.js] 解析功能开关配置失败:', error);
    }
  }

  return API_CONFIG;
}

// 保存配置到 localStorage
function saveConfig(config) {
  if (config.mode) {
    localStorage.setItem('api_mode', config.mode);
    API_CONFIG.mode = config.mode;
  }

  if (config.proxyUrl) {
    localStorage.setItem('api_proxy_url', config.proxyUrl);
    API_CONFIG.proxy.url = config.proxyUrl;
  }

  // 保存功能开关配置
  if (config.features) {
    localStorage.setItem('api_features', JSON.stringify(config.features));
    Object.assign(API_CONFIG.features, config.features);
  }
}

// 导出配置和工具函数
export { API_CONFIG, loadConfig, saveConfig };
export default API_CONFIG;
