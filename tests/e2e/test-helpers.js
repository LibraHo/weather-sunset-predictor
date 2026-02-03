/**
 * E2E 测试辅助函数
 */

/**
 * 设置应用为测试环境
 * 在页面加载前注入配置，确保使用 Mock API 和中文语言
 * @param {Page} page - Playwright 页面对象
 */
export async function setTestEnvironment(page) {
  // 在加载页面之前设置 localStorage
  await page.goto('/', {
    waitUntil: 'domcontentloaded',
  });

  await page.evaluate(() => {
    // 设置中文语言
    localStorage.setItem('language', 'zh-CN');
    // 设置 API 模式为 mock
    localStorage.setItem('api_mode', 'direct');
    // 设置 Mock API 标志
    localStorage.setItem('use_mock_api', 'true');
    // 设置 API key (即使使用 mock 也可以设置一个假的)
    localStorage.setItem('api_key', 'mock-test-key');
    // 触发存储事件
    window.dispatchEvent(new Event('storage'));
  });

  // 重新加载页面以应用配置
  await page.reload({
    waitUntil: 'networkidle',
  });

  // 关闭 API Key Modal（如果存在）
  const modal = page.locator('#api-key-modal');
  if (await modal.isVisible({ timeout: 2000 }).catch(() => false)) {
    await page.evaluate(() => {
      const modal = document.getElementById('api-key-modal');
      if (modal) {
        modal.classList.add('hidden');
      }
    });
  }
}

/**
 * 设置应用为中文语言（保留向后兼容）
 * @param {Page} page - Playwright 页面对象
 */
export async function setChineseLanguage(page) {
  await setTestEnvironment(page);
}

/**
 * 选择器常量 - 与 HTML 中的 ID 保持一致
 */
export const SELECTORS = {
  LOCATION_INPUT: '#location-input',
  CURRENT_LOCATION_BTN: '#current-location-btn',
  REFRESH_BTN: '#refresh-btn',
  SEARCH_BTN: '#search-btn',
  SETTINGS_BTN: '#settings-btn',
};

/**
 * 搜索位置的辅助函数
 * @param {Page} page - Playwright 页面对象
 * @param {string} location - 位置名称
 */
export async function searchLocation(page, location) {
  const searchInput = page.locator(SELECTORS.LOCATION_INPUT);
  await searchInput.fill(location);
  await searchInput.press('Enter');
  // 等待搜索完成 - 使用更准确的选择器
  await page.waitForFunction(() => {
    // 等待位置信息更新（location-name 或 specific-weather 内容）
    const locationName = document.querySelector('.location-name');
    const tempValue = document.querySelector('.temp-value');
    const scoreNumber = document.querySelector('.score-number');
    // 检查是否有可见的错误消息（非隐藏的）
    const visibleError = document.querySelector('.error-message:not(.hidden)');
    return locationName || tempValue || scoreNumber || visibleError;
  }, { timeout: 15000 });
}
