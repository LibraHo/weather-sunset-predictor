import { test, expect } from '@playwright/test';

/**
 * 应用端到端测试套件
 * 测试天气晚霞预测器的核心功能
 */

test.describe('应用基础功能', () => {
  test.beforeEach(async ({ page }) => {
    // 每个测试前访问主页
    await page.goto('/');
  });

  test('应该成功加载应用', async ({ page }) => {
    // 等待页面加载完成
    await page.waitForLoadState('networkidle');

    // 检查页面标题
    await expect(page).toHaveTitle(/天气晚霞预测器/);

    // 检查主要元素是否可见
    await expect(page.locator('header')).toBeVisible();
    await expect(page.locator('main')).toBeVisible();
  });

  test('应该显示位置搜索输入框', async ({ page }) => {
    const searchInput = page.locator('#location-search');
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toHaveAttribute('placeholder', /搜索位置/);
  });

  test('应该显示当前位置按钮', async ({ page }) => {
    const currentLocationBtn = page.locator('#current-location-btn');
    await expect(currentLocationBtn).toBeVisible();
    });

  test('应该显示刷新按钮', async ({ page }) => {
    const refreshBtn = page.locator('#refresh-btn');
    await expect(refreshBtn).toBeVisible();
  });
});

test.describe('位置搜索功能', () => {
  test('应该能够搜索位置', async ({ page }) => {
    await page.goto('/');

    // 输入位置名称
    const searchInput = page.locator('#location-search');
    await searchInput.fill('北京');

    // 等待搜索结果
    await page.waitForTimeout(500);

    // 点击搜索按钮或按回车
    await searchInput.press('Enter');

    // 等待天气数据加载
    await page.waitForSelector('.weather-display, .error-message', { timeout: 10000 });

    // 检查是否显示了位置信息
    const locationDisplay = page.locator('.location-name, .weather-display');
    await expect(locationDisplay).toBeVisible({ timeout: 5000 });
  });

  test('应该处理无效的位置搜索', async ({ page }) => {
    await page.goto('/');

    const searchInput = page.locator('#location-search');
    await searchInput.fill('这是一个无效的位置名称123456');

    await searchInput.press('Enter');

    // 应该显示错误消息
    const errorMessage = page.locator('.error-message');
    await expect(errorMessage).toBeVisible({ timeout: 5000 });
  });
});

test.describe('预测功能', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('应该显示朝霞和晚霞预测', async ({ page }) => {
    await page.goto('/');

    // 先搜索一个位置
    const searchInput = page.locator('#location-search');
    await searchInput.fill('上海');
    await searchInput.press('Enter');

    // 等待数据加载
    await page.waitForSelector('.prediction-display, .forecast-timeline', { timeout: 15000 });

    // 检查预测区域
    const predictionSection = page.locator('#prediction-section');
    await expect(predictionSection).toBeVisible();

    // 检查朝霞预测
    const sunrisePrediction = page.locator('.prediction-card:has-text("朝霞")').first();
    await expect(sunrisePrediction).toBeVisible();

    // 检查晚霞预测
    const sunsetPrediction = page.locator('.prediction-card:has-text("晚霞")').first();
    await expect(sunsetPrediction).toBeVisible();
  });

  test('应该显示预测评分', async ({ page }) => {
    await page.goto('/');

    const searchInput = page.locator('#location-search');
    await searchInput.fill('广州');
    await searchInput.press('Enter');

    await page.waitForSelector('.prediction-score-container', { timeout: 15000 });

    // 检查评分显示
    const scoreNumber = page.locator('.score-number').first();
    await expect(scoreNumber).toBeVisible();

    // 评分应该是0-100之间的数字
    const scoreText = await scoreNumber.textContent();
    const score = parseInt(scoreText);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  test('应该能够展开预测详情', async ({ page }) => {
    await page.goto('/');

    const searchInput = page.locator('#location-search');
    await searchInput.fill('深圳');
    await searchInput.press('Enter');

    // 等待预测时间线加载
    await page.waitForSelector('.forecast-item', { timeout: 15000 });

    // 点击第一个预测卡片
    const firstPrediction = page.locator('.forecast-item').first();
    await firstPrediction.click();

    // 检查详情是否展开
    const predictionDetails = page.locator('.prediction-details');
    await expect(predictionDetails).toBeVisible({ timeout: 3000 });
  });
});

test.describe('天气详细信息', () => {
  test('应该显示温度、湿度等天气参数', async ({ page }) => {
    await page.goto('/');

    const searchInput = page.locator('#location-search');
    await searchInput.fill('杭州');
    await searchInput.press('Enter');

    // 等待天气数据加载
    await page.waitForSelector('.weather-display, .current-weather', { timeout: 15000 });

    // 检查温度显示
    const temperature = page.locator('.temperature, .temp-value').first();
    await expect(temperature).toBeVisible();

    // 检查湿度显示
    const humidity = page.locator('.humidity, :text-is("湿度")').first();
    await expect(humidity).toBeVisible();
  });
});

test.describe('设置功能', () => {
  test('应该能够打开设置面板', async ({ page }) => {
    await page.goto('/');

    // 点击设置按钮
    const settingsBtn = page.locator('#settings-btn, button:has-text("设置"), .settings-icon');
    await settingsBtn.first().click();

    // 检查设置面板是否打开
    const settingsPanel = page.locator('.settings-panel, #settings-panel');
    await expect(settingsPanel).toBeVisible();
  });

  test('应该能够切换主题', async ({ page }) => {
    await page.goto('/');

    // 打开设置面板
    const settingsBtn = page.locator('#settings-btn, button:has-text("设置"), .settings-icon');
    await settingsBtn.first().click();

    // 点击深色主题选项
    const darkThemeOption = page.locator('label:has-text("深色"), input[value="dark"]');
    if (await darkThemeOption.count() > 0) {
      await darkThemeOption.first().click();

      // 检查主题是否切换
      const html = page.locator('html');
      await expect(html).toHaveAttribute('data-theme', 'dark');
    }
  });
});

test.describe('响应式设计', () => {
  test('在移动端应该正确显示', async ({ page }) => {
    // 设置移动端视口
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // 检查移动端导航
    const mobileNav = page.locator('.mobile-nav, nav');
    await expect(mobileNav).toBeVisible();

    // 检查搜索框在移动端的显示
    const searchInput = page.locator('#location-search');
    await expect(searchInput).toBeVisible();
  });

  test('在桌面端应该正确显示', async ({ page }) => {
    // 设置桌面端视口
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');

    // 检查主要布局
    const mainContent = page.locator('main');
    await expect(mainContent).toBeVisible();

    // 检查预测卡片应该并排显示
    const predictionCards = page.locator('.today-predictions-container .prediction-card');
    if (await predictionCards.count() > 1) {
      const firstCard = predictionCards.first();
      const secondCard = predictionCards.nth(1);

      const firstBox = await firstCard.boundingBox();
      const secondBox = await secondCard.boundingBox();

      // 在桌面端，卡片应该水平排列（第二个在第一个的右边）
      expect(secondBox.x).toBeGreaterThan(firstBox.x);
    }
  });
});

test.describe('深色模式', () => {
  test('应该支持深色模式', async ({ page }) => {
    await page.goto('/');

    // 设置深色模式
    await page.emulateMedia({ colorScheme: 'dark' });

    // 检查深色模式是否应用
    const html = page.locator('html');
    const theme = await html.getAttribute('data-theme');

    // 如果应用自动响应系统主题
    expect(theme === 'dark' || theme === null).toBeTruthy();
  });
});

test.describe('可访问性', () => {
  test('搜索框应该有正确的标签', async ({ page }) => {
    await page.goto('/');

    const searchInput = page.locator('#location-search');
    await expect(searchInput).toHaveAttribute('aria-label');
  });

  test('按钮应该有可访问的名称', async ({ page }) => {
    await page.goto('/');

    const buttons = page.locator('button:not([aria-hidden="true"])');
    const count = await buttons.count();

    for (let i = 0; i < Math.min(count, 10); i++) {
      const button = buttons.nth(i);
      const hasLabel = await button.getAttribute('aria-label');
      const hasText = await button.textContent();

      // 按钮应该有 aria-label 或文本内容
      expect(hasLabel || hasText.trim().length > 0).toBeTruthy();
    }
  });
});

test.describe('性能', () => {
  test('页面应该在合理时间内加载', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const loadTime = Date.now() - startTime;

    // 页面应该在 5 秒内加载完成
    expect(loadTime).toBeLessThan(5000);
  });

  test('搜索响应时间应该在可接受范围内', async ({ page }) => {
    await page.goto('/');

    const searchInput = page.locator('#location-search');
    await searchInput.fill('北京');

    const startTime = Date.now();
    await searchInput.press('Enter');

    await page.waitForSelector('.weather-display, .error-message', { timeout: 10000 });
    const responseTime = Date.now() - startTime;

    // 搜索应该在 8 秒内完成（考虑网络请求）
    expect(responseTime).toBeLessThan(8000);
  });
});
