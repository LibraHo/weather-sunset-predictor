/**
 * Main application entry point
 * 
 * 初始化应用程序，创建必要的服务和控制器实例
 */

import StorageService from './services/StorageService.js';
import ConfigService from './services/ConfigService.js';
import GeocodingServiceFactory from './services/GeocodingServiceFactory.js';
import MockGeocodingService from './services/MockGeocodingService.js';
import WeatherController from './controllers/WeatherController.js';
import PredictionController from './controllers/PredictionController.js';
import AppController from './controllers/AppController.js';
import GlobalErrorBoundary from './utils/GlobalErrorBoundary.js';
import ErrorHandler from './utils/ErrorHandler.js';
import { API_CONFIG } from '../config.api.js';
import initializeHomeTabs from './utils/HomeTabs.js';

console.log('Weather Sunset Predictor - Application Starting...');

// 从脚本URL读取后端端口配置（仅本地开发环境启用）
// 例如：<script src="src/app.js?port=3001"> 会将后端代理URL配置为 http://localhost:3001
try {
  const scriptUrl = new URL(import.meta.url);
  const backendPort = scriptUrl.searchParams.get('port');
  const isLocalDevHost = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);

  if (backendPort && /^\d+$/.test(backendPort)) {
    if (isLocalDevHost) {
      const newProxyUrl = `http://localhost:${backendPort}`;
      API_CONFIG.proxy.url = newProxyUrl;
      // 同步到 localStorage，确保 loadConfig() 返回正确的值
      localStorage.setItem('api_proxy_url', newProxyUrl);
      console.log(`[App] 后端代理地址已从URL参数更新为: ${newProxyUrl}`);
    } else {
      console.warn('[App] 检测到生产域名环境，已忽略 port 参数，避免将后端代理错误指向 localhost');
    }
  }
} catch (e) {
  console.warn('[App] 无法从脚本URL读取端口配置:', e.message);
}

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

// 使用 GeocodingServiceFactory 创建地理编码服务（需求 24）
// E2E 测试模式下使用 Mock 服务
const isLocalDevHost = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
const savedProxyURL = localStorage.getItem('api_proxy_url');
// 生产域名下忽略 localStorage 里可能残留的 localhost 代理，避免“天气不可用”
const proxyURL = isLocalDevHost
  ? (savedProxyURL || API_CONFIG.proxy.url || 'http://localhost:3000')
  : (API_CONFIG.proxy.url || '/api');
let geocodingService = isE2ETestMode
  ? new MockGeocodingService()
  : GeocodingServiceFactory.create(proxyURL);

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

// 需求 24：监听地理编码设置变更，热重建服务实例
if (!isE2ETestMode) {
  window.addEventListener('geocodingSettingChanged', () => {
    const nextSavedProxyURL = localStorage.getItem('api_proxy_url');
    const newProxyURL = isLocalDevHost
      ? (nextSavedProxyURL || API_CONFIG.proxy.url || 'http://localhost:3000')
      : (API_CONFIG.proxy.url || '/api');
    geocodingService = GeocodingServiceFactory.create(newProxyURL);
    appController.geocodingService = geocodingService;
    window.geocodingService = geocodingService;
    console.log('[App] 地理编码服务已重建:', geocodingService.constructor.name);
  });
}

// 当 DOM 加载完成后初始化应用
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
  });
} else {
  // DOM 已经加载完成
  initializeApp();
}

function setupLogoBackHome() {
  const appLogo = document.querySelector('.app-logo');
  if (!appLogo) return;

  const goHome = () => {
    document.querySelector('.home-view-option[data-view="forecast"]')?.click();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  appLogo.style.cursor = 'pointer';
  appLogo.setAttribute('role', 'button');
  appLogo.setAttribute('tabindex', '0');
  appLogo.setAttribute('aria-label', '回到首页');

  appLogo.addEventListener('click', goHome);
  appLogo.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      goHome();
    }
  });
}

/**
 * 初始化应用程序
 */
async function initializeApp() {
  try {
    console.log('Initializing application...');
    initializeHomeTabs(document, () => onMapPanelVisible());
    setupLogoBackHome();

    // 朝/晚霞 tab 早期绑定（init 前就可点击）
    document.getElementById('map-tab-sunrise')?.addEventListener('click', () => {
      window.weatherController?.chinaSpotsOverlayManager?.switchPeriod('sunrise');
    });
    document.getElementById('map-tab-sunset')?.addEventListener('click', () => {
      window.weatherController?.chinaSpotsOverlayManager?.switchPeriod('sunset');
    });

    // 分享地图全屏按钮
    const galleryFullscreenBtn = document.getElementById('gallery-fullscreen-btn');
    if (galleryFullscreenBtn) {
      galleryFullscreenBtn.addEventListener('click', () => {
        window.open('/gallery', '_blank');
      });
    }

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

// 访客计数器
async function updateVisitorCount() {
  try {
    const proxyUrl = API_CONFIG.proxy.url;
    const response = await fetch(`${proxyUrl}/api/visitor/count`, { method: 'POST' });
    if (response.ok) {
      const data = await response.json();
      const el = document.getElementById('visitor-count');
      if (el) {
        el.textContent = data.count.toLocaleString();
      }
    }
  } catch (error) {
    console.warn('[App] 访客计数器更新失败:', error.message);
  }
}

updateVisitorCount();

// 导出控制器实例供调试使用
window.appController = appController;
window.weatherController = weatherController;
window.predictionController = predictionController;
window.storageService = storageService;
window.configService = configService;
window.geocodingService = geocodingService;
window.globalErrorBoundary = globalErrorBoundary;
window.ErrorHandler = ErrorHandler;

/**
 * 地图 panel 激活回调：触发 Leaflet invalidateSize 修复 hidden 切换后的尺寸问题
 */
function onMapPanelVisible() {
  // 先等浏览器完成布局（classList 移除 hidden 后尺寸可能尚未刷新）
  requestAnimationFrame(() => {
    setTimeout(() => {
      // 如果地图有待初始化，现在执行初始化
      if (window.weatherController && window.weatherController._chinaSpotsMapPendingInit) {
        console.log('[onMapPanelVisible] 地图待初始化，现在执行...');
        window.weatherController._initChinaSpotsMap().then(() => {
          console.log('[onMapPanelVisible] 地图初始化完成');
        }).catch(err => {
          console.error('[onMapPanelVisible] 地图初始化失败:', err);
        });
        return;
      }

      const map = window.weatherController ? window.weatherController._chinaSpotsMapInstance : null;
      if (!map || typeof map.invalidateSize !== 'function') return;

      // 确保地图已正确初始化（有有效的中心点）
      try {
        const center = map.getCenter();
        if (!center || typeof center.lat !== 'number' || typeof center.lng !== 'number' ||
            isNaN(center.lat) || isNaN(center.lng)) {
          console.warn('[onMapPanelVisible] 地图中心点无效，跳过 invalidateSize');
          return;
        }
      } catch (e) {
        console.warn('[onMapPanelVisible] 获取地图中心点失败:', e.message);
        return;
      }

      // 延迟执行以确保容器已渲染
      setTimeout(() => {
        try {
          map.invalidateSize({ animate: false });
        } catch (e) {
          console.warn('[onMapPanelVisible] invalidateSize 失败:', e.message);
        }
      }, 100);
    }, 50);
  });
}
