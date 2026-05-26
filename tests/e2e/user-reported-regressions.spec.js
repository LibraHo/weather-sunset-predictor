import { test, expect } from '@playwright/test';
import { setTestEnvironment, searchLocation } from './test-helpers.js';

test.describe('用户反馈回归保护', () => {
  test.beforeEach(async ({ page }) => {
    await setTestEnvironment(page);
  });

  test('桌面端菜单项（含分享地图）应用较大字体样式', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    await page.locator('#home-view-menu-btn').click();
    const shareOption = page.locator('.home-view-option[data-view="gallery"]');
    await expect(shareOption).toBeVisible();

    const fontSizePx = await shareOption.evaluate((el) => parseFloat(window.getComputedStyle(el).fontSize));
    expect(fontSizePx).toBeGreaterThanOrEqual(18);
  });

  test('搜索后实时天气容器应显示（避免 weather-data 持续隐藏）', async ({ page }) => {
    await searchLocation(page, '北京');

    const weatherData = page.locator('#weather-data');
    await expect(weatherData).toBeVisible();

    const display = await weatherData.evaluate((el) => window.getComputedStyle(el).display);
    expect(display).not.toBe('none');
  });

  test('首页顶栏、卡片和页脚在移动端与桌面端使用一致页边距', async ({ page }) => {
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 1280, height: 800 }
    ]) {
      await page.setViewportSize(viewport);
      await page.reload({ waitUntil: 'networkidle' });

      const alignment = await page.evaluate(() => {
        const header = document.querySelector('header');
        const footer = document.querySelector('footer');
        const cards = Array.from(document.querySelectorAll('main .card'))
          .filter((el) => !el.classList.contains('hidden') && window.getComputedStyle(el).display !== 'none');
        const left = (el) => Math.round(el.getBoundingClientRect().left);
        return {
          headerLeft: left(header),
          footerLeft: left(footer),
          cardLefts: cards.map(left)
        };
      });

      expect(alignment.cardLefts.length).toBeGreaterThan(0);
      for (const cardLeft of alignment.cardLefts) {
        expect(Math.abs(cardLeft - alignment.headerLeft)).toBeLessThanOrEqual(1);
      }
      expect(Math.abs(alignment.footerLeft - alignment.headerLeft)).toBeLessThanOrEqual(1);
    }
  });
});
