/**
 * Jest Configuration for Weather Sunset Predictor
 * 
 * This configuration sets up Jest for testing with:
 * - ES6 modules support
 * - JSDOM environment for browser APIs
 * - Coverage reporting
 * - Property-based testing with fast-check
 */

export default {
  // Use jsdom environment to simulate browser APIs
  testEnvironment: 'jsdom',
  
  // Transform ES6 modules using babel-jest
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
  
  // Module file extensions
  moduleFileExtensions: ['js', 'json'],

  // Module name mapping for absolute imports
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@models/(.*)$': '<rootDir>/src/models/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@controllers/(.*)$': '<rootDir>/src/controllers/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '^@locales/(.*)$': '<rootDir>/src/locales/$1',
    '^leaflet$': '<rootDir>/tests/__mocks__/leaflet.js'
  },

  // Test match patterns
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.property.test.js'
  ],
  
  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/app.js',                              // 应用入口，难以有意义地单测
    '!src/locales/**',                          // 纯翻译数据，无业务逻辑（需求 23.6）
    '!src/services/Mock*.js',                   // 离线开发测试替身（需求 23.6）
    '!src/services/ChartService.js',             // 纯 Chart.js 适配层，jsdom 无法运行真实 Canvas
    '!src/services/ChartServiceV2.js',           // 同上，Canvas 依赖项需在真实浏览器中运行（E2E 覆盖）
    '!src/services/WindyMapService.js',          // Leaflet 地图服务，jsdom 不支持 Leaflet DOM 渲染（E2E 覆盖）
    '!src/services/OpenMeteoAPIService.js',       // WindyAPIService 的空继承兼容入口，无独立逻辑
    '!src/controllers/ChartRenderController.js',  // 纯图表渲染编排，依赖 Canvas context（E2E 覆盖）
    '!src/controllers/AppController.js',         // ~1700 行 UI 总编排，DOM 事件/动画密集（E2E 覆盖）
    '!src/controllers/PredictionController.js',  // ~1600 行预测结果渲染，依赖真实 DOM（E2E 覆盖）
    '!src/controllers/UIStateController.js',     // UI 状态切换，依赖真实 DOM（E2E 覆盖）
    '!src/controllers/WeatherController.js',     // DOM+Leaflet 密集（地图/图表/覆盖层），jsdom 无法运行（E2E 覆盖）
    '!src/controllers/FavoriteController.js',    // Modal DOM 操作密集，jsdom 渲染有限（E2E 覆盖）
    '!src/i18n.js',                              // 语言检测依赖 navigator/Intl，浏览器 API 难以完整 mock（E2E 覆盖）
    '!**/node_modules/**',
    '!**/tests/**'
  ],

  // Coverage thresholds
  // WeatherController / FavoriteController are DOM-heavy; their integration
  // behaviour is validated by Playwright E2E tests instead.
  // Chart-related files are excluded from collection above.
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 85,  // 86% 实测可达；DOM 密集型 controller/i18n 已从收集中排除，由 E2E 覆盖
      lines: 80,
      statements: 80
    }
  },
  
  // Setup files to run before tests
  setupFilesAfterEnv: ['<rootDir>/tests/__mocks__/canvas.js'],
  
  // Verbose output
  verbose: true,
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Restore mocks between tests
  restoreMocks: true,
  
  // Reset mocks between tests
  resetMocks: true
};
