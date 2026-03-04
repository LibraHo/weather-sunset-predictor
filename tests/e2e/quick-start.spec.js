import { test, expect } from '@playwright/test';
import { setTestEnvironment, SELECTORS, searchLocation } from './test-helpers.js';

/**
 * 快速入门示例测试
 * 这是一个简化的测试文件，用于演示基本的 Playwright 测试编写
 */

test('快速入门：搜索位置并查看预测', async ({ page }) => {
  // 1. 设置测试环境并访问应用
  await setTestEnvironment(page);

  // 2. 找到搜索框并输入位置
  const searchInput = page.locator(SELECTORS.LOCATION_INPUT);
  await expect(searchInput).toBeVisible();
  await searchInput.fill('北京');

  // 3. 按回车搜索
  await searchInput.press('Enter');

  // 4. 等待天气数据加载
  await page.waitForFunction(() => {
    const weatherLocation = document.querySelector('.weather-location');
    const scoreNumber = document.querySelector('.score-number');
    return weatherLocation || scoreNumber;
  }, { timeout: 10000 });

  // 5. 验证位置信息已显示
  const locationName = page.locator('.weather-location');
  await expect(locationName).toContainText(/北京|Beijing/);

  // 6. 验证预测卡片已显示
  const predictionCards = page.locator('.prediction-card');
  const count = await predictionCards.count();
  expect(count).toBeGreaterThanOrEqual(2); // 至少有朝霞和晚霞

  // 7. 截图（可选）
  await page.screenshot({ path: 'test-screenshots/search-result.png' });
});

test('快速入门：测试预测详情展开', async ({ page }) => {
  // 设置测试环境
  await setTestEnvironment(page);

  // 搜索位置
  await searchLocation(page, '上海');

  // 等待预测加载
  await page.waitForSelector('.forecast-item, .prediction-card', { timeout: 15000 });

  // 点击第一个预测卡片
  const firstForecast = page.locator('.forecast-item, .prediction-card').first();
  await firstForecast.click();

  // 验证详情已展开（详情可能在不同位置）
  await page.waitForTimeout(500);

  // 检查页面是否显示了详细信息
  const hasDetails = await page.evaluate(() => {
    const details = document.querySelector('.prediction-details');
    if (details && details.offsetParent !== null) {
      return true;
    }
    // 或者检查是否有气象数据显示
    const humidity = document.querySelector('#current-humidity');
    const cloudCover = document.querySelector('#current-cloud-cover');
    return (humidity && humidity.textContent !== '--') || (cloudCover && cloudCover.textContent !== '--');
  });

  expect(hasDetails).toBeTruthy();
});

test('快速入门：测试深色模式切换', async ({ page }) => {
  await setTestEnvironment(page);

  // 打开设置面板
  const settingsBtn = page.locator('#settings-btn, [aria-label*="设置"], .settings-icon');
  if (await settingsBtn.count() > 0) {
    await settingsBtn.first().click();

    // 等待设置面板打开
    await page.waitForSelector('.settings-panel, #settings-panel');

    // 选择深色模式
    const darkThemeRadio = page.locator('input[value="dark"], label:has-text("深色")').first();
    if (await darkThemeRadio.count() > 0) {
      await darkThemeRadio.click();

      // 验证 HTML 元素的主题属性
      const html = page.locator('html');
      await expect(html).toHaveAttribute('data-theme', 'dark');
    }
  }
});

test('快速入门：测试响应式布局', async ({ page }) => {
  await setTestEnvironment(page);

  // 测试移动端视口
  await page.setViewportSize({ width: 375, height: 667 });

  // 在移动端，主要内容应该可见
  const mainContent = page.locator('main');
  await expect(mainContent).toBeVisible();

  // 切换到桌面端
  await page.setViewportSize({ width: 1920, height: 1080 });

  // 在桌面端，主要内容也应该可见
  await expect(mainContent).toBeVisible();
});

test('快速入门：测试错误处理', async ({ page }) => {
  await setTestEnvironment(page);

  // 输入无效的位置名称
  await page.locator(SELECTORS.LOCATION_INPUT).fill('这不是一个真实的位置名称123456789');
  await page.locator(SELECTORS.LOCATION_INPUT).press('Enter');

  // 应该显示错误消息 - 等待可见的错误消息
  await page.waitForFunction(() => {
    const errorMessages = document.querySelectorAll('.error-message');
    for (const msg of errorMessages) {
      if (!msg.classList.contains('hidden') && msg.offsetParent !== null) {
        return true;
      }
    }
    return false;
  }, { timeout: 5000 });
});
