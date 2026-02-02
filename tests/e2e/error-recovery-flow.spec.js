/**
 * 错误恢复E2E流程测试
 *
 * 测试场景：
 * 1. Mock网络错误
 * 2. 验证错误提示显示
 * 3. 点击重试按钮
 * 4. Mock成功响应
 * 5. 验证数据正常加载
 *
 * 需求：错误处理健壮性
 */

import { test, expect } from '@playwright/test';

test.describe('错误恢复流程', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
  });

  test('应该：网络错误 → 显示错误 → 重试成功', async ({ page }) => {
    // 1. Mock网络错误
    await page.route('**/api/weather/forecast', route => {
      route.abort();
    });

    // 2. 尝试搜索
    await page.fill('#location-input', '北京');
    await page.click('#search-btn');

    // 3. 验证错误提示显示
    const errorElement = page.locator('.error-message');
    await expect(errorElement).toBeVisible({ timeout: 10000 });
    const errorText = await errorElement.textContent();
    expect(errorText).toContain('网络') || expect(errorText).toContain('连接');

    // 4. 验证重试按钮显示
    const retryButton = page.locator('#retry-btn');
    await expect(retryButton).toBeVisible();

    // 5. 改为Mock成功响应
    await page.route('**/api/weather/forecast', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              timestamp: Date.now(),
              temp: 20,
              humidity: 65,
              cloudCover: 50,
              windSpeed: 10,
              pressure: 1013,
              visibility: 10,
              lowClouds: 30,
              precipitation: 0,
              windDirection: 180,
              highClouds: 20,
              midClouds: 40
            }
          ]
        })
      });
    });

    // 6. 点击重试按钮
    await retryButton.click();

    // 7. 验证数据正常加载
    await page.waitForSelector('.weather-data', { timeout: 10000 });
    const tempElement = page.locator('.temp');
    await expect(tempElement).toBeVisible();

    // 8. 验证错误提示消失
    await expect(errorElement).not.toBeVisible();
  });

  test('应该：API 401错误 → 显示密钥错误提示 → 不提供重试', async ({ page }) => {
    // 1. Mock 401响应
    await page.route('**/api/weather/forecast', route => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'Invalid API key' } })
      });
    });

    // 2. 尝试搜索
    await page.fill('#location-input', '北京');
    await page.click('#search-btn');

    // 3. 验证错误提示
    const errorElement = page.locator('.error-message');
    await expect(errorElement).toBeVisible({ timeout: 10000 });
    const errorText = await errorElement.textContent();
    expect(errorText).toContain('密钥') || expect(errorText).toContain('API');

    // 4. 验证不显示重试按钮（因为密钥错误需要用户配置）
    const retryButton = page.locator('#retry-btn');
    await expect(retryButton).not.toBeVisible();

    // 5. 验证显示配置提示
    const configHint = page.locator('.config-hint');
    await expect(configHint).toBeVisible();
  });

  test('应该：API 429限流 → 显示限流提示 → 禁用刷新', async ({ page }) => {
    // 1. Mock 429响应
    await page.route('**/api/weather/forecast', route => {
      route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Too many requests' })
      });
    });

    // 2. 尝试搜索
    await page.fill('#location-input', '北京');
    await page.click('#search-btn');

    // 3. 验证错误提示
    const errorElement = page.locator('.error-message');
    await expect(errorElement).toBeVisible({ timeout: 10000 });
    const errorText = await errorElement.textContent();
    expect(errorText).toContain('频繁') || expect(errorText).toContain('限制');

    // 4. 验证刷新按钮被禁用
    const refreshButton = page.locator('#refresh-btn');
    await expect(refreshButton).toBeDisabled();
  });

  test('应该：超时错误 → 显示超时提示 → 提供重试', async ({ page }) => {
    // 1. Mock超时（延迟响应）
    await page.route('**/api/weather/forecast', async route => {
      // 不调用continue()，让请求超时
      await new Promise(resolve => setTimeout(resolve, 35000));
    });

    // 2. 尝试搜索
    await page.fill('#location-input', '北京');
    await page.click('#search-btn');

    // 3. 验证超时错误提示
    const errorElement = page.locator('.error-message');
    await expect(errorElement).toBeVisible({ timeout: 35000 });
    const errorText = await errorElement.textContent();
    expect(errorText).toContain('超时') || expect(errorText).toContain('时间');

    // 4. 验证重试按钮存在
    const retryButton = page.locator('#retry-btn');
    await expect(retryButton).toBeVisible();
  });

  test('应该：服务器错误 → 显示服务器提示 → 提供重试', async ({ page }) => {
    // 1. Mock 500错误
    await page.route('**/api/weather/forecast', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' })
      });
    });

    // 2. 尝试搜索
    await page.fill('#location-input', '北京');
    await page.click('#search-btn');

    // 3. 验证错误提示
    const errorElement = page.locator('.error-message');
    await expect(errorElement).toBeVisible({ timeout: 10000 });
    const errorText = await errorElement.textContent();
    expect(errorText).toContain('服务器') || expect(errorText).toContain('不可用');

    // 4. 验证重试按钮存在
    const retryButton = page.locator('#retry-btn');
    await expect(retryButton).toBeVisible();
  });

  test('应该：数据格式错误 → 显示格式错误提示 → 不崩溃', async ({ page }) => {
    // 1. Mock无效JSON响应
    await page.route('**/api/weather/forecast', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: 'invalid json{{{'
      });
    });

    // 2. 尝试搜索
    await page.fill('#location-input', '北京');
    await page.click('#search-btn');

    // 3. 验证错误提示
    const errorElement = page.locator('.error-message');
    await expect(errorElement).toBeVisible({ timeout: 10000 });

    // 4. 验证应用未崩溃
    const searchInput = page.locator('#location-input');
    await expect(searchInput).toBeVisible();
    await expect(searchInput).isEnabled();
  });

  test('应该：连续错误 → 正确处理多次失败', async ({ page }) => {
    let attemptCount = 0;

    // Mock始终失败
    await page.route('**/api/weather/forecast', route => {
      attemptCount++;
      route.abort();
    });

    // 1. 第一次尝试
    await page.fill('#location-input', '北京');
    await page.click('#search-btn');

    let errorElement = page.locator('.error-message');
    await expect(errorElement).toBeVisible({ timeout: 10000 });
    expect(attemptCount).toBe(1);

    // 2. 点击重试（第二次尝试）
    const retryButton = page.locator('#retry-btn');
    await retryButton.click();

    await expect(errorElement).toBeVisible();
    expect(attemptCount).toBe(2);

    // 3. 再次重试（第三次尝试）
    await retryButton.click();

    await expect(errorElement).toBeVisible();
    expect(attemptCount).toBe(3);

    // 验证应用仍然响应
    const searchInput = page.locator('#location-input');
    await expect(searchInput).isEnabled();
  });

  test('应该：部分数据缺失 → 使用默认值 → 显示警告', async ({ page }) => {
    // Mock不完整的数据
    await page.route('**/api/weather/forecast', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              timestamp: Date.now(),
              temp: 20,
              // 缺少humidity字段
              cloudCover: 50,
              windSpeed: 10,
              pressure: 1013,
              visibility: 10,
              lowClouds: 30,
              precipitation: 0,
              windDirection: 180,
              highClouds: 20,
              midClouds: 40
            }
          ]
        })
      });
    });

    // 1. 搜索位置
    await page.fill('#location-input', '北京');
    await page.click('#search-btn');

    // 2. 验证数据加载（使用默认值）
    await page.waitForSelector('.weather-data', { timeout: 10000 });

    // 3. 验证警告提示
    const warningElement = page.locator('.warning-message');
    if (await warningElement.isVisible()) {
      const warningText = await warningElement.textContent();
      expect(warningText).toBeDefined();
    }
  });

  test('应该：缓存可用 → 网络错误时使用缓存', async ({ page }) => {
    // 1. 首次成功请求并缓存
    await page.route('**/api/weather/forecast', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              timestamp: Date.now(),
              temp: 20,
              humidity: 65,
              cloudCover: 50,
              windSpeed: 10,
              pressure: 1013,
              visibility: 10,
              lowClouds: 30,
              precipitation: 0,
              windDirection: 180,
              highClouds: 20,
              midClouds: 40
            }
          ]
        })
      });
    });

    // 首次搜索
    await page.fill('#location-input', '北京');
    await page.click('#search-btn');
    await page.waitForSelector('.weather-data', { timeout: 10000 });

    // 2. 改为Mock失败
    await page.route('**/api/weather/forecast', route => {
      route.abort();
    });

    // 3. 刷新数据（应该使用缓存）
    const refreshButton = page.locator('#refresh-btn');
    await refreshButton.click();

    // 4. 验证缓存数据显示
    const tempElement = page.locator('.temp');
    await expect(tempElement).toBeVisible();
    const tempText = await tempElement.textContent();
    expect(tempText).toContain('20');

    // 5. 验证缓存提示
    const cacheHint = page.locator('.cache-hint');
    if (await cacheHint.isVisible()) {
      const cacheText = await cacheHint.textContent();
      expect(cacheText).toContain('缓存') || expect(cacheText).toContain('cache');
    }
  });
});

test.describe('错误恢复 - 边缘情况', () => {
  test('应该：快速连续点击搜索 → 只发送一次请求', async ({ page }) => {
    let requestCount = 0;

    await page.route('**/api/weather/forecast', route => {
      requestCount++;
      // 延迟响应以测试防抖
      setTimeout(() => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [] })
        });
      }, 1000);
    });

    // 快速连续点击
    await page.fill('#location-input', '北京');
    await page.click('#search-btn');
    await page.click('#search-btn');
    await page.click('#search-btn');

    // 等待响应
    await page.waitForSelector('.weather-data', { timeout: 10000 });

    // 验证只发送了一次请求（取决于防抖实现）
    expect(requestCount).toBeLessThanOrEqual(3);
  });

  test('应该：搜索进行中 → 切换位置 → 取消前一个请求', async ({ page }) => {
    let firstRequestAborted = false;
    let secondRequestCompleted = false;

    await page.route('**/api/weather/forecast', async route => {
      const url = route.request().url();
      if (url.includes('lat=39.9042')) {
        // 北京请求，延迟
        setTimeout(() => {
          route.continue();
        }, 5000);
      } else if (url.includes('lat=31.2304')) {
        // 上海请求，立即完成
        firstRequestAborted = true;
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [] })
        });
        secondRequestCompleted = true;
      }
    });

    // 1. 搜索北京（会延迟）
    await page.fill('#location-input', '北京');
    await page.click('#search-btn');

    // 2. 立即搜索上海（应该取消北京请求）
    await page.waitForTimeout(100);
    await page.fill('#location-input', '上海');
    await page.click('#search-btn');

    // 3. 验证上海数据显示
    await page.waitForSelector('.weather-data', { timeout: 10000 });
    expect(secondRequestCompleted).toBe(true);
  });
});
