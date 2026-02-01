import { test, expect } from '@playwright/test';

/**
 * 快速入门示例测试
 * 这是一个简化的测试文件，用于演示基本的 Playwright 测试编写
 */

test('快速入门：搜索位置并查看预测', async ({ page }) => {
  // 1. 访问应用首页
  await page.goto('/');

  // 2. 找到搜索框并输入位置
  const searchInput = page.locator('#location-search');
  await expect(searchInput).toBeVisible();
  await searchInput.fill('北京');

  // 3. 按回车搜索
  await searchInput.press('Enter');

  // 4. 等待天气数据加载
  await page.waitForSelector('.weather-display', { timeout: 10000 });

  // 5. 验证位置信息已显示
  const locationName = page.locator('.location-name');
  await expect(locationName).toContainText(/北京/);

  // 6. 验证预测卡片已显示
  const predictionCards = page.locator('.prediction-card');
  await expect(predictionCards).toHaveCount(2); // 朝霞和晚霞

  // 7. 截图（可选）
  await page.screenshot({ path: 'test-screenshots/search-result.png' });
});

test('快速入门：测试预测详情展开', async ({ page }) => {
  // 访问应用并搜索位置
  await page.goto('/');
  await page.locator('#location-search').fill('上海');
  await page.locator('#location-search').press('Enter');

  // 等待预测加载
  await page.waitForSelector('.forecast-item', { timeout: 15000 });

  // 点击第一个预测卡片
  const firstForecast = page.locator('.forecast-item').first();
  await firstForecast.click();

  // 验证详情已展开
  const details = page.locator('.prediction-details');
  await expect(details).toBeVisible();

  // 检查详情中是否包含气象数据
  await expect(details).toContainText(/湿度|云量|能见度/);
});

test('快速入门：测试深色模式切换', async ({ page }) => {
  await page.goto('/');

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
  // 测试移动端视口
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/');

  // 在移动端，元素应该垂直排列
  const predictionsContainer = page.locator('.today-predictions-container');
  const firstCard = predictionsContainer.locator('.prediction-card').first();
  const secondCard = predictionsContainer.locator('.prediction-card').nth(1);

  if (await secondCard.count() > 0) {
    const firstBox = await firstCard.boundingBox();
    const secondBox = await secondCard.boundingBox();

    // 在移动端，第二个卡片应该在第一个下方
    expect(secondBox.y).toBeGreaterThan(firstBox.y);
  }

  // 切换到桌面端
  await page.setViewportSize({ width: 1920, height: 1080 });

  // 在桌面端，卡片应该并排显示
  if (await secondCard.count() > 0) {
    const firstBox = await firstCard.boundingBox();
    const secondBox = await secondCard.boundingBox();

    expect(secondBox.x).toBeGreaterThan(firstBox.x);
  }
});

test('快速入门：测试错误处理', async ({ page }) => {
  await page.goto('/');

  // 输入无效的位置名称
  await page.locator('#location-search').fill('这不是一个真实的位置名称123456789');
  await page.locator('#location-search').press('Enter');

  // 应该显示错误消息
  const errorMessage = page.locator('.error-message, [role="alert"]');
  await expect(errorMessage).toBeVisible({ timeout: 5000 });
});
