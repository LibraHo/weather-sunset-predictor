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
    '!src/app.js',           // 应用入口，难以有意义地单测
    '!src/locales/**',       // 纯翻译数据，无业务逻辑（需求 23.6）
    '!src/services/Mock*.js', // 离线开发测试替身（需求 23.6）
    '!**/node_modules/**',
    '!**/tests/**'
  ],
  
  // Coverage thresholds (as per design document)
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 90,
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
