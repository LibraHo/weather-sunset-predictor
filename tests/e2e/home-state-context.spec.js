import { test, expect } from '@playwright/test';
import { setTestEnvironment } from './test-helpers.js';

test.describe('home empty state and inline weather context', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('default_location');
      localStorage.removeItem('last_location');
      localStorage.removeItem('search_history');
      localStorage.removeItem('favorite_locations');
    });
    await setTestEnvironment(page);
  });

  test('keeps search text and renders event context inside the weather card', async ({ page }) => {
    await expect(page.locator('#forecast-empty-state')).toBeVisible();
    await expect(page.locator('#refresh-btn')).toBeHidden();
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.screenshot({ path: 'test-results/home-state-empty-desktop.png', fullPage: false });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: 'test-results/home-state-empty-mobile.png', fullPage: false });
    await page.setViewportSize({ width: 1366, height: 900 });

    const input = page.locator('#location-input');
    await input.fill('北京');
    await page.locator('#search-btn').click();

    await expect(page.locator('#weather-section')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#weather-context-inline')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#weather-location')).toHaveText('北京');
    await expect(page.locator('#weather-context-date-time')).toContainText(/\d{1,2}月\d{1,2}日/);
    await expect(page.locator('#weather-context-inline')).toContainText('更新于');
    await expect(page.locator('#weather-context-inline')).not.toContainText(/朝霞|晚霞/);
    await expect(input).toHaveValue('北京');
    await expect(page.locator('#forecast-empty-state')).toBeHidden();
    await expect(page.locator('#result-context-bar')).toHaveCount(0);
    await expect(page.locator('.toast')).toHaveCount(0, { timeout: 8000 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: 'test-results/home-state-result-desktop.png', fullPage: false });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => window.scrollTo(0, 0));
    const centerOffsets = await page.evaluate(() => {
      const panel = document.querySelector('.weather-visual-panel').getBoundingClientRect();
      const location = document.querySelector('#weather-location').getBoundingClientRect();
      const context = document.querySelector('#weather-context-inline').getBoundingClientRect();
      const center = (rect) => rect.left + rect.width / 2;
      return {
        location: Math.abs(center(location) - center(panel)),
        context: Math.abs(center(context) - center(panel)),
      };
    });
    expect(centerOffsets.location).toBeLessThanOrEqual(1);
    expect(centerOffsets.context).toBeLessThanOrEqual(1);
    await page.screenshot({ path: 'test-results/home-state-result-mobile.png', fullPage: false });
  });
});
