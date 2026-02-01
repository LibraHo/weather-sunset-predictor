import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright 测试配置
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests/e2e',
  /* 并行运行测试文件 */
  fullyParallel: true,
  /* 在 CI 环境下失败时不重试 */
  forbidOnly: !!process.env.CI,
  /* 在 CI 环境下重试失败的测试 */
  retries: process.env.CI ? 2 : 0,
  /* 在 CI 环境下使用并行工作线程 */
  workers: process.env.CI ? 1 : undefined,
  /* 测试报告配置 */
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list']
  ],
  /* 全局设置 */
  use: {
    /* 基础 URL */
    baseURL: 'http://localhost:8080',
    /* 收集失败测试的追踪信息 */
    trace: 'on-first-retry',
    /* 截图配置 */
    screenshot: 'only-on-failure',
    /* 视频录制配置 */
    video: 'retain-on-failure',
  },

  /* 配置不同的浏览器项目 */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    /* 移动端测试 */
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  /* 启动开发服务器（如果需要） */
  webServer: {
    command: 'npx http-server . -p 8080 -c-1',
    url: 'http://localhost:8080',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
