/**
 * Main application entry point
 * 
 * 初始化应用程序，创建必要的服务和控制器实例
 */

import StorageService from './services/StorageService.js';
import ConfigService from './services/ConfigService.js';
import GeocodingService from './services/GeocodingService.js';
import MockGeocodingService from './services/MockGeocodingService.js';
import WeatherController from './controllers/WeatherController.js';
import PredictionController from './controllers/PredictionController.js';
import AppController from './controllers/AppController.js';
import GlobalErrorBoundary from './utils/GlobalErrorBoundary.js';
import ErrorHandler from './utils/ErrorHandler.js';
import { API_CONFIG, loadConfig, resolveProxyUrl } from '../config.api.js';

console.log('Weather Sunset Predictor - Application Starting...');

// 优先加载持久化配置（proxyMode / api_proxy_url 等）
loadConfig();

// 从脚本 URL 读取 port 参数，作为 manual 模式的快速注入方式。
// 例如：<script src="src/app.js?port=3001"> 会强制切换到 manual 模式并使用 localhost:3001。
// 若已持久化为 auto 模式，此参数不覆盖用户选择。
try {
  const scriptUrl = new URL(import.meta.url);
  const backendPort = scriptUrl.searchParams.get('port');
  if (backendPort && /^\d+$/.test(backendPort)) {
    // 仅当用户未明确选择过模式时（首次访问），才通过 port 参数注入 manual 配置
    const hasSavedMode = localStorage.getItem('api_proxy_mode');
    if (!hasSavedMode) {
      const newProxyUrl = `http://localhost:${backendPort}`;
      API_CONFIG.proxyMode = 'manual';
      API_CONFIG.proxy.url = newProxyUrl;
      localStorage.setItem('api_proxy_mode', 'manual');
      localStorage.setItem('api_proxy_url', newProxyUrl);
      console.log(`[App] 通过 port 参数注入后端地址 (manual): ${newProxyUrl}`);
    }
  }
} catch (e) {
  console.warn('[App] 无法从脚本URL读取端口配置:', e.message);
}

console.log(`[App] 后端代理模式: ${API_CONFIG.proxyMode}, 地址: ${resolveProxyUrl()}`);

// 初始化全局错误边界
const globalErrorBoundary = new GlobalErrorBoundary({
  onError: (errorInfo, event) => {
    // 自定义错误处理逻辑
    console.log('[App] Error caught by global boundary:', errorInfo.type);
    
    // 可以在这里添加错误上报到服务器的逻辑
    // reportErrorToServer(errorInfo);
  },
  showErrorPage: true,
  logErrors: true
});

globalErrorBoundary.initialize();
console.log('Global Error Boundary initialized');

// 创建服务实例
const storageService = new StorageService();
const configService = new ConfigService();

// E2E 测试模式：检测 URL 参数或 localStorage 标记
const isE2ETestMode = window.location.search.includes('e2e=true') ||
                         localStorage.getItem('e2e_test_mode') === 'true';

// 使用真实的地理编码服务（支持所有城市）
// E2E 测试模式下使用 Mock 服务
const geocodingService = isE2ETestMode
  ? new MockGeocodingService()
  : new GeocodingService();

// 优先从配置文件读取API密钥，然后从localStorage读取
const config = await configService.loadConfig();
let savedAPIKey = storageService.getAPIKey();

// 优先级：配置文件 > localStorage
if (config && config.apiKey) {
  console.log('[App] 使用配置文件中的API密钥');
  savedAPIKey = config.apiKey;
}

// 配置：是否使用模拟API（用于离线测试）
// 优先从 localStorage 读取（测试环境），然后从配置文件读取，如果没有配置则使用默认值false
let USE_MOCK_API = configService.getUseMockAPI() !== null
  ? configService.getUseMockAPI()
  : (config && typeof config.useMockAPI !== 'undefined' ? config.useMockAPI : false);

// E2E 测试模式下强制使用 Mock API
if (isE2ETestMode) {
  USE_MOCK_API = true;
  console.log('[App] E2E 测试模式已启用，强制使用 Mock API');
}

console.log('[App] API密钥状态:', savedAPIKey ? '已配置' : '未配置');
console.log('[App] Mock API:', USE_MOCK_API ? '启用' : '禁用');

// API 模式固定为后端代理（直连模式已移除）
const useProxy = true;
console.log('[App] API模式: 后端代理（固定）');

const weatherController = new WeatherController(storageService, savedAPIKey, USE_MOCK_API, useProxy);
const predictionController = new PredictionController(storageService);

const appController = new AppController(
  storageService,
  weatherController,
  predictionController,
  geocodingService
);

// 当 DOM 加载完成后初始化应用
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
  });
} else {
  // DOM 已经加载完成
  initializeApp();
}

/**
 * 初始化应用程序
 */
async function initializeApp() {
  try {
    console.log('Initializing application...');
    await appController.initialize();
    console.log('Application initialized successfully');
  } catch (error) {
    console.error('Failed to initialize application:', error);
    
    // 使用ErrorHandler处理错误
    const errorInfo = ErrorHandler.handleError(error, 'Application Initialization');
    
    // 显示用户友好的错误消息
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.style.cssText = 'position: fixed; top: 20px; left: 50%; transform: translateX(-50%); z-index: 9999; max-width: 500px; background: #d32f2f; color: white; padding: 16px 24px; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);';
    errorDiv.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <span style="font-size: 24px;">⚠️</span>
        <div>
          <strong>应用初始化失败</strong><br>
          ${errorInfo.message}
        </div>
      </div>
    `;
    document.body.appendChild(errorDiv);
    
    // 提供重试选项
    if (ErrorHandler.isRecoverable(errorInfo)) {
      const retryBtn = document.createElement('button');
      retryBtn.textContent = '重试';
      retryBtn.style.cssText = 'margin-top: 12px; padding: 8px 16px; background: var(--color-card-bg); color: #d32f2f; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;';
      retryBtn.onclick = () => {
        window.location.reload();
      };
      errorDiv.appendChild(retryBtn);
    }
  }
}

// 导出控制器实例供调试使用
window.appController = appController;
window.weatherController = weatherController;
window.predictionController = predictionController;
window.storageService = storageService;
window.configService = configService;
window.geocodingService = geocodingService;
window.globalErrorBoundary = globalErrorBoundary;
window.ErrorHandler = ErrorHandler;
