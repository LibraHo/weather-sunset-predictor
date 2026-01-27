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
}

// 导出配置和工具函数
export { API_CONFIG, loadConfig, saveConfig };
export default API_CONFIG;
