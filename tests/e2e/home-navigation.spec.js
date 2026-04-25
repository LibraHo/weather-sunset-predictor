import { test, expect } from '@playwright/test';
import { setTestEnvironment } from './test-helpers.js';

/**
 * E2E Tests: Home Page Tab Navigation & Methodology Panel (需求26)
 * Covers task 39.5 — navigation between Forecast and Methodology views.
 */

test.describe('主页分页导航 (Phase 10 需求26)', () => {
  test.beforeEach(async ({ page }) => {
    await setTestEnvironment(page);
  });

  // ──────────────────────────────────────────────
  // 初始状态
  // ──────────────────────────────────────────────

  test('默认显示预测功能页，方法论页隐藏', async ({ page }) => {
    const forecastPanel = page.locator('#tab-panel-forecast');
    const methodologyPanel = page.locator('#tab-panel-methodology');

    await expect(forecastPanel).toBeVisible();
    await expect(methodologyPanel).toBeHidden();
  });

  test('页面菜单按钮(☰)存在且可见', async ({ page }) => {
    const menuBtn = page.locator('#home-view-menu-btn');
    await expect(menuBtn).toBeVisible();
  });

  // ──────────────────────────────────────────────
  // 下拉菜单交互
  // ──────────────────────────────────────────────

  test('点击菜单按钮展开下拉菜单', async ({ page }) => {
    const menuBtn = page.locator('#home-view-menu-btn');
    const dropdown = page.locator('#home-view-menu-dropdown');

    // initially hidden
    await expect(dropdown).toBeHidden();

    await menuBtn.click();
    await expect(dropdown).toBeVisible();
    await expect(menuBtn).toHaveAttribute('aria-expanded', 'true');
  });

  test('再次点击菜单按钮收起下拉菜单', async ({ page }) => {
    const menuBtn = page.locator('#home-view-menu-btn');
    const dropdown = page.locator('#home-view-menu-dropdown');

    await menuBtn.click(); // open
    await expect(dropdown).toBeVisible();

    await menuBtn.click(); // close
    await expect(dropdown).toBeHidden();
    await expect(menuBtn).toHaveAttribute('aria-expanded', 'false');
  });

  test('点击外部区域收起下拉菜单', async ({ page }) => {
    const menuBtn = page.locator('#home-view-menu-btn');
    const dropdown = page.locator('#home-view-menu-dropdown');

    await menuBtn.click(); // open
    await expect(dropdown).toBeVisible();

    // click somewhere outside the menu
    await page.locator('main').first().click({ position: { x: 10, y: 10 } });
    await expect(dropdown).toBeHidden();
  });

  // ──────────────────────────────────────────────
  // 视图切换
  // ──────────────────────────────────────────────

  test('从菜单切换到火烧云计算方法页', async ({ page }) => {
    const menuBtn = page.locator('#home-view-menu-btn');
    const forecastPanel = page.locator('#tab-panel-forecast');
    const methodologyPanel = page.locator('#tab-panel-methodology');

    await menuBtn.click();
    await page.locator('.home-view-option[data-view="methodology"]').click();

    await expect(methodologyPanel).toBeVisible();
    await expect(forecastPanel).toBeHidden();
  });

  test('从方法论页切回预测功能页', async ({ page }) => {
    const menuBtn = page.locator('#home-view-menu-btn');
    const forecastPanel = page.locator('#tab-panel-forecast');
    const methodologyPanel = page.locator('#tab-panel-methodology');

    // switch to methodology
    await menuBtn.click();
    await page.locator('.home-view-option[data-view="methodology"]').click();
    await expect(methodologyPanel).toBeVisible();

    // switch back to forecast
    await menuBtn.click();
    await page.locator('.home-view-option[data-view="forecast"]').click();

    await expect(forecastPanel).toBeVisible();
    await expect(methodologyPanel).toBeHidden();
  });

  test('切换后下拉菜单自动收起', async ({ page }) => {
    const menuBtn = page.locator('#home-view-menu-btn');
    const dropdown = page.locator('#home-view-menu-dropdown');

    await menuBtn.click();
    await page.locator('.home-view-option[data-view="methodology"]').click();

    // dropdown should be closed after selection
    await expect(dropdown).toBeHidden();
  });

  // ──────────────────────────────────────────────
  // 方法论页内容验证
  // ──────────────────────────────────────────────

  test('方法论页包含四个评分因子', async ({ page }) => {
    await page.locator('#home-view-menu-btn').click();
    await page.locator('.home-view-option[data-view="methodology"]').click();

    const methodologyPanel = page.locator('#tab-panel-methodology');
    await expect(methodologyPanel).toBeVisible();

    const items = methodologyPanel.locator('.methodology-item');
    await expect(items).toHaveCount(4);
  });

  test('方法论页包含评分解读区域', async ({ page }) => {
    await page.locator('#home-view-menu-btn').click();
    await page.locator('.home-view-option[data-view="methodology"]').click();

    const scoreGuide = page.locator('.methodology-score-guide');
    await expect(scoreGuide).toBeVisible();
  });

  test('首页有 API 接入入口并可跳转', async ({ page }) => {
    const apiLink = page.locator('a:has-text("API接入")').first();
    await expect(apiLink).toBeVisible();
    await apiLink.click();
    await expect(page).toHaveURL(/\/api-apply\.html$/);
    await expect(page.getByText('API 接入')).toBeVisible();
    await expect(page.getByText('禁止商用')).toBeVisible();

    const codeText = await page.locator('.code-box').first().textContent();
    expect(codeText).not.toContain('xiake_');
  });


  // ──────────────────────────────────────────────\n  // 响应式测试\n  // ──────────────────────────────────────────────

  test('移动端视口下导航菜单正常工作', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    const menuBtn = page.locator('#home-view-menu-btn');
    await expect(menuBtn).toBeVisible();

    await menuBtn.click();
    await expect(page.locator('#home-view-menu-dropdown')).toBeVisible();

    await page.locator('.home-view-option[data-view="methodology"]').click();
    await expect(page.locator('#tab-panel-methodology')).toBeVisible();
  });

  // ──────────────────────────────────────────────
  // ESC 键关闭菜单
  // ──────────────────────────────────────────────

  test('按 ESC 键关闭已打开的菜单', async ({ page }) => {
    const menuBtn = page.locator('#home-view-menu-btn');
    const dropdown = page.locator('#home-view-menu-dropdown');

    await menuBtn.click();
    await expect(dropdown).toBeVisible();

    await menuBtn.press('Escape');
    await expect(dropdown).toBeHidden();
  });
});
