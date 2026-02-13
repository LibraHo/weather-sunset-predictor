/**
 * API 配置文件
 * 用于管理 Windy API 的访问模式
 */

const isBrowser = typeof window !== 'undefined' && !!window.location;
const isLocalHostname = isBrowser && ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);

const DEFAULT_PROXY_URL = isLocalHostname
  ? 'http://localhost:3000'
  : (isBrowser ? window.location.origin : 'http://localhost:3000');

const API_CONFIG = {
  // API 访问模式已固定为后端代理（直连模式已移除）
  mode: 'proxy',

  // 后端服务器配置（当 mode='proxy' 时使用）
  proxy: {
    url: DEFAULT_PROXY_URL,
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

// 从 localStorage 读取用户配置（如果有）
function loadConfig() {
  const savedProxyUrl = localStorage.getItem('api_proxy_url');
  if (savedProxyUrl) {
    const isSavedLocalhostUrl = /^https?:\/\/localhost(?::\d+)?$/i.test(savedProxyUrl) ||
      /^https?:\/\/127\.0\.0\.1(?::\d+)?$/i.test(savedProxyUrl);

    // 在生产域名环境，自动忽略历史保存的 localhost 配置，避免前端误连本机
    if (!isLocalHostname && isSavedLocalhostUrl && isBrowser) {
      API_CONFIG.proxy.url = window.location.origin;
      localStorage.setItem('api_proxy_url', API_CONFIG.proxy.url);
      console.warn('[config.api.js] 检测到非本地环境中的 localhost 代理地址，已自动切换为当前域名');
    } else {
      API_CONFIG.proxy.url = savedProxyUrl;
    }
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
