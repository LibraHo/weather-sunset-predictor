import { test, expect } from '@playwright/test';
import { setTestEnvironment, searchLocation } from './test-helpers.js';

test.describe('24小时温度图 - 北京跨天可读性', () => {
  test.beforeEach(async ({ page }) => {
    await setTestEnvironment(page);
  });

  test('应能加载北京24小时图，并在跨天点显示“月/日 小时”避免误读凌晨温度跳变', async ({ page }) => {
    await searchLocation(page, '北京');

    await expect(page.locator('#weather-location')).not.toHaveText('--', { timeout: 15000 });
    await expect(page.locator('#current-temp-main')).not.toHaveText('--', { timeout: 15000 });

    const hourlyBtn = page.locator('#hourly-btn');
    await expect(hourlyBtn).toBeVisible({ timeout: 15000 });
    await hourlyBtn.click();

    const chartContainer = page.locator('#chart-container');
    await expect(chartContainer).toBeVisible({ timeout: 15000 });

    const axisLabels = page.locator('#chart-container svg text');
    await expect(axisLabels.first()).toBeVisible({ timeout: 15000 });

    const labelTexts = await axisLabels.allTextContents();
    const hasDateHourLabel = labelTexts.some((text) => /\d{1,2}\/\d{1,2}\s+\d{1,2}:00/.test(text));
    const hasHourOnlyLabel = labelTexts.some((text) => /^\d{1,2}:00$/.test(text.trim()));

    expect(hasDateHourLabel).toBe(true);
    expect(hasHourOnlyLabel).toBe(true);

    await page.screenshot({ path: 'test-results/beijing-hourly-cross-day.png', fullPage: true });
  });
});
