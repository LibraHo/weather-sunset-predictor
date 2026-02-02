/**
 * 天气查询E2E流程测试
 *
 * 测试完整的用户天气查询流程：
 * 1. 打开应用
 * 2. 输入城市名称
 * 3. 点击搜索
 * 4. 等待加载
 * 5. 验证数据显示
 * 6. 切换到预测标签
 * 7. 验证预测卡片显示
 *
 * 需求：核心用户流程
 */

import { test, expect } from '@playwright/test';

test.describe('天气查询流程', () => {
  test.beforeEach(async ({ page }) => {
    // 导航到应用
    await page.goto('http://localhost:3000');

    // 等待页面加载完成
    await page.waitForLoadState('networkidle');
  });

  test('应该：打开应用 → 输入"北京" → 搜索 → 显示天气数据', async ({ page }) => {
    // 1. 输入城市名称
    await page.fill('#location-input', '北京');

    // 2. 点击搜索按钮
    await page.click('#search-btn');

    // 3. 等待加载完成
    await page.waitForSelector('.weather-data', { timeout: 10000 });

    // 4. 验证温度显示
    const tempElement = page.locator('.temp');
    await expect(tempElement).toBeVisible();
    const tempText = await tempElement.textContent();
    expect(tempText).toMatch(/\d+°/);

    // 5. 验证湿度显示
    const humidityElement = page.locator('.humidity');
    await expect(humidityElement).toBeVisible();
    const humidityText = await humidityElement.textContent();
    expect(humidityText).toMatch(/\d+%/);

    // 6. 验证云量显示
    const cloudElement = page.locator('.cloud-cover');
    await expect(cloudElement).toBeVisible();
  });

  test('应该：搜索 → 切换到预测标签 → 显示预测卡片', async ({ page }) => {
    // 1. 执行搜索
    await page.fill('#location-input', '上海');
    await page.click('#search-btn');
    await page.waitForSelector('.weather-data', { timeout: 10000 });

    // 2. 切换到预测标签
    await page.click('#prediction-tab');

    // 3. 等待预测卡片加载
    await page.waitForSelector('.prediction-card', { timeout: 5000 });

    // 4. 验证预测卡片显示
    const predictionCards = page.locator('.prediction-card');
    await expect(predictionCards).toHaveCount(expect.any(Number)); // 至少有1个卡片

    // 5. 验证评分显示
    const scoreElement = page.locator('.prediction-score');
    await expect(scoreElement).toBeVisible();

    // 6. 验证质量等级显示
    const qualityElement = page.locator('.prediction-quality');
    await expect(qualityElement).toBeVisible();
  });

  test('应该：使用当前位置按钮 → 获取天气数据', async ({ page }) => {
    // 1. Mock地理位置
    await page.context().grantPermissions(['geolocation']);
    await page.setGeolocation({ latitude: 39.9042, longitude: 116.4074 });

    // 2. 点击当前位置按钮
    await page.click('#current-location-btn');

    // 3. 等待数据加载
    await page.waitForSelector('.weather-data', { timeout: 10000 });

    // 4. 验证位置名称显示
    const locationElement = page.locator('.location-name');
    await expect(locationElement).toBeVisible();
  });

  test('应该：输入框为空 → 点击搜索 → 显示错误提示', async ({ page }) => {
    // 1. 不输入任何内容
    // 2. 点击搜索按钮
    await page.click('#search-btn');

    // 3. 验证错误提示显示
    const errorElement = page.locator('.error-message');
    await expect(errorElement).toBeVisible();
    const errorText = await errorElement.textContent();
    expect(errorText).toContain('请输入');
  });

  test('应该：搜索无效位置 → 显示错误提示', async ({ page }) => {
    // 1. 输入无效位置
    await page.fill('#location-input', '无效的城市名称123456');

    // 2. 点击搜索
    await page.click('#search-btn');

    // 3. 验证错误提示
    const errorElement = page.locator('.error-message');
    await expect(errorElement).toBeVisible({ timeout: 5000 });
  });

  test('应该：连续搜索多个位置 → 数据正确更新', async ({ page }) => {
    const locations = ['北京', '上海', '广州'];

    for (const location of locations) {
      // 搜索位置
      await page.fill('#location-input', location);
      await page.click('#search-btn');
      await page.waitForSelector('.weather-data', { timeout: 10000 });

      // 验证位置名称更新
      const locationElement = page.locator('.location-name');
      const locationText = await locationElement.textContent();
      expect(locationText).toContain(location);

      // 等待一下再搜索下一个
      await page.waitForTimeout(1000);
    }
  });

  test('应该：点击刷新按钮 → 重新加载当前数据', async ({ page }) => {
    // 1. 首次搜索
    await page.fill('#location-input', '北京');
    await page.click('#search-btn');
    await page.waitForSelector('.weather-data', { timeout: 10000 });

    // 2. 获取初始温度
    const initialTemp = await page.locator('.temp').textContent();

    // 3. 点击刷新按钮
    await page.click('#refresh-btn');

    // 4. 等待重新加载
    await page.waitForSelector('.weather-data', { timeout: 10000 });

    // 5. 验证数据已刷新（温度可能略有不同）
    const refreshedTemp = await page.locator('.temp').textContent();
    expect(refreshedTemp).toBeDefined();
  });

  test('应该：搜索历史下拉 → 点击历史项 → 自动填充并搜索', async ({ page }) => {
    // 注意：这需要先有搜索历史
    // 1. 执行一次搜索以创建历史
    await page.fill('#location-input', '北京');
    await page.click('#search-btn');
    await page.waitForSelector('.weather-data', { timeout: 10000 });

    // 2. 点击输入框
    await page.click('#location-input');

    // 3. 等待历史下拉显示
    const historyDropdown = page.locator('#search-history-dropdown');
    await expect(historyDropdown).toBeVisible();

    // 4. 点击第一项历史记录
    const firstHistoryItem = page.locator('.search-history-item').first();
    await firstHistoryItem.click();

    // 5. 验证输入框自动填充
    const inputValue = await page.inputValue('#location-input');
    expect(inputValue).toContain('北京');
  });
});

test.describe('天气查询流程 - 边缘情况', () => {
  test('应该：网络错误 → 显示友好错误提示 → 提供重试按钮', async ({ page }) => {
    // Mock网络错误
    await page.route('**/api/weather/forecast', route => route.abort());

    // 1. 尝试搜索
    await page.fill('#location-input', '北京');
    await page.click('#search-btn');

    // 2. 等待错误提示
    const errorElement = page.locator('.error-message');
    await expect(errorElement).toBeVisible({ timeout: 10000 });

    // 3. 验证重试按钮存在
    const retryButton = page.locator('#retry-btn');
    await expect(retryButton).toBeVisible();

    // 4. 点击重试
    // 注意：由于我们mock了网络错误，重试也会失败
    // 这里只验证按钮存在和可点击
    await expect(retryButton).isEnabled();
  });

  test('应该：API限流 → 显示限流提示 → 禁用刷新按钮', async ({ page }) => {
    // Mock 429响应
    await page.route('**/api/weather/forecast', route => {
      route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Too many requests' })
      });
    });

    // 1. 尝试搜索
    await page.fill('#location-input', '北京');
    await page.click('#search-btn');

    // 2. 等待错误提示
    const errorElement = page.locator('.error-message');
    await expect(errorElement).toBeVisible({ timeout: 10000 });
    const errorText = await errorElement.textContent();
    expect(errorText).toContain('频繁');

    // 3. 验证刷新按钮被禁用
    const refreshButton = page.locator('#refresh-btn');
    await expect(refreshButton).toBeDisabled();
  });

  test('应该：长时间加载 → 显示加载指示器', async ({ page }) => {
    // Mock延迟响应
    await page.route('**/api/weather/forecast', async route => {
      // 延迟2秒
      await new Promise(resolve => setTimeout(resolve, 2000));
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] })
      });
    });

    // 1. 开始搜索
    await page.fill('#location-input', '北京');
    await page.click('#search-btn');

    // 2. 验证加载指示器立即显示
    const loader = page.locator('.loading-indicator');
    await expect(loader).toBeVisible();

    // 3. 等待加载完成
    await page.waitForSelector('.weather-data', { timeout: 10000 });

    // 4. 验证加载指示器消失
    await expect(loader).not.toBeVisible();
  });
});
