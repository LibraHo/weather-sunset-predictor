/**
 * API 配置文件
 * 用于管理 Windy API 的访问模式
 */

const API_CONFIG = {
  // API 访问模式已固定为后端代理（直连模式已移除）
  mode: 'proxy',

  // 后端地址模式：
  //   'auto'   — 自动使用当前页面同源地址（适合前后端同域部署）
  //   'manual' — 手动指定后端地址（适合本地开发或跨域部署）
  proxyMode: 'auto',

  // 后端服务器配置（当 mode='proxy' 时使用）
  proxy: {
    url: 'http://localhost:3000',   // 仅 proxyMode='manual' 时生效
    description: '后端代理服务器地址'
  },

  // ========== 前后端分离功能开关（需求22）==========

  // 功能迁移开关 - 控制哪些功能使用后端 API
  features: {
    // Phase 1: 基础预测服务后端化 ✅ 已完成
    USE_BACKEND_PREDICTION: true,

    // Phase 2: 周边采样聚合后端化 ✅ 已完成（2026-02-04）
    USE_BACKEND_SURROUNDING: true,

    // Phase 3: 增强预测模型后端化 ✅ 已完成（2026-02-04）
    USE_BACKEND_ENHANCED: true
  }
};

/**
 * 获取当前生效的后端代理 URL。
 * - auto 模式：返回当前页面的 origin（协议 + 域名 + 端口）
 * - manual 模式：返回用户手动配置的 URL
 * @returns {string}
 */
function resolveProxyUrl() {
  if (API_CONFIG.proxyMode === 'auto') {
    // 在浏览器环境中使用页面 origin；Node/Jest 环境回退到 manual URL
    if (typeof window !== 'undefined' && window.location && window.location.origin) {
      return window.location.origin;
    }
  }
  return API_CONFIG.proxy.url;
}

// 从 localStorage 读取用户配置（如果有）
function loadConfig() {
  // 读取代理模式
  const savedProxyMode = localStorage.getItem('api_proxy_mode');
  if (savedProxyMode === 'auto' || savedProxyMode === 'manual') {
    API_CONFIG.proxyMode = savedProxyMode;
  }

  // manual 模式下读取手动配置的 URL
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
  // 模式固定为 proxy，不再持久化 api_mode
  API_CONFIG.mode = 'proxy';

  if (config.proxyMode === 'auto' || config.proxyMode === 'manual') {
    localStorage.setItem('api_proxy_mode', config.proxyMode);
    API_CONFIG.proxyMode = config.proxyMode;
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
export { API_CONFIG, loadConfig, saveConfig, resolveProxyUrl };
export default API_CONFIG;
