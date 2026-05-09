import { test, expect } from '@playwright/test';

const SUPPORTED_LOCALES = ['zh-CN', 'zh-TW', 'en-US', 'ja-JP', 'ko-KR', 'es-ES', 'fr-FR', 'vi-VN', 'it-IT', 'ar-SA'];
const MOBILE = { width: 390, height: 844 };

async function setLocaleEnvironment(page, locale) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate((lang) => {
    localStorage.setItem('language', lang);
    localStorage.setItem('api_mode', 'proxy');
    localStorage.setItem('e2e_test_mode', 'true');
    localStorage.setItem('use_mock_api', 'true');
    localStorage.setItem('api_key', 'mock-test-key');
  }, locale);
  await page.reload({ waitUntil: 'networkidle' });
}

async function expectNoHorizontalOverflow(page, selector = 'body') {
  const overflow = await page.locator(selector).evaluate((el) => {
    const doc = el === document.body ? document.documentElement : el;
    return Math.ceil(doc.scrollWidth - doc.clientWidth);
  });
  expect(overflow).toBeLessThanOrEqual(2);
}

async function collectClippedText(page) {
  return page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll('button, a, label, h1, h2, h3, p, .home-view-option, .methodology-card, .api-apply-card, .setting-item'));
    return nodes
      .filter((el) => {
        const style = window.getComputedStyle(el);
        const clippedX = el.scrollWidth > el.clientWidth + 2 && ['hidden', 'clip'].includes(style.overflowX);
        const clippedY = el.scrollHeight > el.clientHeight + 2 && ['hidden', 'clip'].includes(style.overflowY);
        return (clippedX || clippedY) && (el.textContent || '').trim().length > 0;
      })
      .map((el) => ({
        tag: el.tagName,
        className: el.className,
        text: (el.textContent || '').trim().slice(0, 80),
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight
      }));
  });
}

test.describe('supported locale layout guard', () => {
  for (const locale of SUPPORTED_LOCALES) {
    test(`${locale} mobile menu/methodology/api pages do not overflow or clip text`, async ({ page }) => {
      await page.setViewportSize(MOBILE);
      await setLocaleEnvironment(page, locale);

      await expectNoHorizontalOverflow(page);
      await page.locator('#home-view-menu-btn').click();
      await expect(page.locator('#home-view-menu-dropdown')).toBeVisible();
      await expectNoHorizontalOverflow(page);

      const menuClipped = await collectClippedText(page);
      expect(menuClipped).toEqual([]);

      await page.locator('.home-view-option[data-view="methodology"]').click();
      await expect(page.locator('#tab-panel-methodology')).toBeVisible();
      await expectNoHorizontalOverflow(page);
      const methodologyClipped = await collectClippedText(page);
      expect(methodologyClipped).toEqual([]);

      await page.goto(`/api-apply.html?lang=${locale}`, { waitUntil: 'networkidle' });
      await page.evaluate((lang) => localStorage.setItem('language', lang), locale);
      await page.reload({ waitUntil: 'networkidle' });
      await expectNoHorizontalOverflow(page);
      const apiClipped = await collectClippedText(page);
      expect(apiClipped).toEqual([]);
    });
  }
});
