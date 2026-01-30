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

console.log('Weather Sunset Predictor - Application Starting...');

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

// 使用真实的地理编码服务（支持所有城市）
// 如果需要离线测试，请将下面一行改为：
// const geocodingService = new MockGeocodingService();
const geocodingService = new GeocodingService();

// 优先从配置文件读取API密钥，然后从localStorage读取
const config = await configService.loadConfig();
let savedAPIKey = storageService.getAPIKey();

// 优先级：配置文件 > localStorage
if (config && config.apiKey) {
  console.log('[App] 使用配置文件中的API密钥');
  savedAPIKey = config.apiKey;
}

// 配置：是否使用模拟API（用于离线测试）
// 优先从配置文件读取，如果没有配置则使用默认值false
const USE_MOCK_API = config && typeof config.useMockAPI !== 'undefined'
  ? config.useMockAPI
  : false;

console.log('[App] API密钥状态:', savedAPIKey ? '已配置' : '未配置');
console.log('[App] Mock API:', USE_MOCK_API ? '启用' : '禁用');

// 读取API模式设置（后端代理或直连）
const apiMode = localStorage.getItem('api_mode') || 'proxy';
const useProxy = apiMode === 'proxy';
console.log('[App] API模式:', useProxy ? '后端代理' : '直连');

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
