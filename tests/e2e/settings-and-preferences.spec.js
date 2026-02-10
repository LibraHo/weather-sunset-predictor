import { test, expect } from '@playwright/test';
import { setTestEnvironment } from './test-helpers.js';

test.describe('任务30：设置与持久化 E2E', () => {
  test.beforeEach(async ({ page }) => {
    await setTestEnvironment(page);
  });

  test('30.1 主题切换后刷新仍保持主题', async ({ page }) => {
    await page.click('#settings-btn');
    await expect(page.locator('#settings-panel')).toBeVisible();

    await page.selectOption('#theme-select', 'dark');

    await expect.poll(async () => {
      return await page.evaluate(() => document.body.classList.contains('theme-dark'));
    }).toBe(true);

    await page.reload({ waitUntil: 'networkidle' });

    await expect.poll(async () => {
      return await page.evaluate(() => ({
        isDark: document.body.classList.contains('theme-dark'),
        stored: localStorage.getItem('app_theme')
      }));
    }).toEqual({ isDark: true, stored: 'dark' });
  });

  test('30.2 设置面板可持久化语言与单位设置', async ({ page }) => {
    await page.click('#settings-btn');
    await expect(page.locator('#settings-panel')).toBeVisible();

    await page.selectOption('#language-select', 'en-US');
    await page.selectOption('#temp-unit-select', 'fahrenheit');
    await page.selectOption('#wind-unit-select', 'ms');

    await page.reload({ waitUntil: 'networkidle' });

    await page.click('#settings-btn');

    await expect(page.locator('#language-select')).toHaveValue('en-US');
    await expect(page.locator('#temp-unit-select')).toHaveValue('fahrenheit');
    await expect(page.locator('#wind-unit-select')).toHaveValue('ms');

    const stored = await page.evaluate(() => ({
      lang: localStorage.getItem('weather-sunset-predictor-language'),
      tempUnit: localStorage.getItem('temp_unit'),
      windUnit: localStorage.getItem('wind_unit')
    }));

    expect(stored).toEqual({
      lang: 'en-US',
      tempUnit: 'fahrenheit',
      windUnit: 'ms'
    });
  });

  test('30.3 搜索历史和收藏位置在刷新后仍可见', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('favorite_locations', JSON.stringify([
        { name: '测试城市A', lat: 39.9042, lon: 116.4074, addedAt: Date.now() }
      ]));

      localStorage.setItem('search_history', JSON.stringify([
        { name: '测试城市A', lat: 39.9042, lon: 116.4074, timestamp: Date.now() },
        { name: '测试城市B', lat: 31.2304, lon: 121.4737, timestamp: Date.now() - 1000 }
      ]));
    });

    await page.reload({ waitUntil: 'networkidle' });

    await expect(page.locator('#favorite-list')).toContainText('测试城市A');

    await page.click('#location-input');
    await expect(page.locator('#search-history-dropdown')).not.toHaveClass(/hidden/);
    await expect(page.locator('#search-history-dropdown')).toContainText('测试城市A');
    await expect(page.locator('#search-history-dropdown')).toContainText('测试城市B');
  });
});
