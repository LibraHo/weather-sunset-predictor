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

    const input = page.locator('#location-input');
    await input.fill('test');
    await page.locator('#search-btn').click();

    await expect(page.locator('#weather-section')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#weather-context-inline')).toBeVisible({ timeout: 15000 });
    await expect(input).toHaveValue('test');
    await expect(page.locator('#forecast-empty-state')).toBeHidden();
    await expect(page.locator('#result-context-bar')).toHaveCount(0);
  });
});
