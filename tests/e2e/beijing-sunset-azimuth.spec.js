import { test, expect } from '@playwright/test';
import { setTestEnvironment, SELECTORS } from './test-helpers.js';

test.describe('北京日出日落方向显示', () => {
  test.beforeEach(async ({ page }) => {
    await setTestEnvironment(page);
  });

  test('应成功加载北京并同时显示朝霞/晚霞方位角方向', async ({ page }) => {
    test.setTimeout(90000);

    await page.locator(SELECTORS.LOCATION_INPUT).fill('北京');
    await page.locator(SELECTORS.LOCATION_INPUT).press('Enter');

    await expect(page.locator('#weather-location')).not.toHaveText('--', { timeout: 30000 });
    await expect(page.locator('#current-temp-main')).not.toHaveText('--', { timeout: 30000 });

    const sunriseCard = page
      .locator('.prediction-card')
      .filter({ has: page.locator('h3', { hasText: /(Sunrise|朝霞)/ }) })
      .first();

    const sunsetCard = page
      .locator('.prediction-card')
      .filter({ has: page.locator('h3', { hasText: /(Sunset|晚霞)/ }) })
      .first();

    await expect(sunriseCard).toBeVisible({ timeout: 45000 });
    await expect(sunsetCard).toBeVisible({ timeout: 45000 });

    const sunriseAzimuthRow = sunriseCard.locator('.compact-extra-azimuth').first();
    const sunsetAzimuthRow = sunsetCard.locator('.compact-extra-azimuth').first();

    await expect(sunriseAzimuthRow).toBeVisible({ timeout: 45000 });
    await expect(sunsetAzimuthRow).toBeVisible({ timeout: 45000 });

    const sunriseAzimuthText = (await sunriseAzimuthRow.textContent()) || '';
    const sunsetAzimuthText = (await sunsetAzimuthRow.textContent()) || '';

    expect(sunriseAzimuthText).toMatch(/(日出方向|Sunrise Direction)\s*:/);
    expect(sunsetAzimuthText).toMatch(/(日落方向|Sunset Direction)\s*:/);

    const sunriseDirectionText = await sunriseAzimuthRow.locator('.azimuth-line-value').textContent();
    const sunsetDirectionText = await sunsetAzimuthRow.locator('.azimuth-line-value').textContent();

    expect((sunriseDirectionText || '').trim().length).toBeGreaterThan(0);
    expect((sunsetDirectionText || '').trim().length).toBeGreaterThan(0);

    await expect(sunriseAzimuthRow.locator('.azimuth-direction-icon')).toBeVisible();
    await expect(sunsetAzimuthRow.locator('.azimuth-direction-icon')).toBeVisible();

    await sunsetCard.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/beijing-sunrise-sunset-azimuth-success.png', fullPage: true });
  });
});
