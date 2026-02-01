# E2E 测试文档

## 概述

本目录包含天气晚霞预测器的端到端（E2E）测试，使用 Playwright 框架。

## 安装依赖

```bash
npm install
npx playwright install
```

## 运行测试

### 命令行模式

```bash
# 运行所有 E2E 测试（无头模式）
npm run test:e2e

# 运行测试并显示浏览器窗口
npm run test:e2e:headed

# 使用 Playwright UI 模式运行（推荐）
npm run test:e2e:ui

# 调试模式
npm run test:e2e:debug
```

### 查看测试报告

```bash
npm run test:e2e:report
```

## 测试结构

```
tests/e2e/
├── application.spec.js     # 主应用功能测试
├── README.md              # 本文档
└── (更多测试文件...)
```

## 测试覆盖范围

### 1. 应用基础功能
- ✅ 页面加载
- ✅ UI 元素显示
- ✅ 导航功能

### 2. 位置搜索
- ✅ 搜索位置
- ✅ 无效位置处理

### 3. 预测功能
- ✅ 朝霞/晚霞预测显示
- ✅ 预测评分
- ✅ 预测详情展开

### 4. 天气信息
- ✅ 温度、湿度等参数显示

### 5. 设置功能
- ✅ 设置面板
- ✅ 主题切换

### 6. 响应式设计
- ✅ 移动端布局
- ✅ 桌面端布局

### 7. 可访问性
- ✅ ARIA 标签
- ✅ 键盘导航

### 8. 性能
- ✅ 页面加载时间
- ✅ 搜索响应时间

## 编写新测试

### 基本模板

```javascript
import { test, expect } from '@playwright/test';

test.describe('功能模块名称', () => {
  test.beforeEach(async ({ page }) => {
    // 每个测试前的准备工作
    await page.goto('/');
  });

  test('测试用例描述', async ({ page }) => {
    // 测试步骤
    await page.goto('/');

    // 断言
    await expect(page.locator('.element')).toBeVisible();
  });
});
```

### 最佳实践

1. **使用语义化的测试描述**
   ```javascript
   test('应该显示位置搜索输入框', async ({ page }) => {
     // ✓ 好的描述
   });

   test('测试搜索框', async ({ page }) => {
     // ✗ 不够具体的描述
   });
   ```

2. **使用 data-testid 属性定位元素**
   ```javascript
   // HTML
   <button data-testid="search-button">搜索</button>

   // 测试
   await page.click('[data-testid="search-button"]');
   ```

3. **等待异步操作**
   ```javascript
   // 等待元素出现
   await page.waitForSelector('.result');

   // 等待网络请求完成
   await page.waitForLoadState('networkidle');

   // 等待特定条件
   await page.waitForFunction(() => {
     return window.dataLoaded === true;
   });
   ```

4. **使用 Page Object Model（可选）**
   ```javascript
   // pages/SearchPage.js
   class SearchPage {
     constructor(page) {
       this.page = page;
       this.searchInput = page.locator('#location-search');
     }

     async search(query) {
       await this.searchInput.fill(query);
       await this.searchInput.press('Enter');
     }
   }

   // 测试文件
   test('搜索位置', async ({ page }) => {
     const searchPage = new SearchPage(page);
     await searchPage.search('北京');
   });
   ```

## 调试技巧

### 1. 使用 VS Code 调试器

安装 Playwright 扩展后，可以在测试文件中设置断点并按 F5 调试。

### 2. 使用 Playwright Inspector

```bash
npx playwright test --debug
```

### 3. 暂停执行

```javascript
test('调试测试', async ({ page }) => {
  await page.goto('/');
  await page.pause(); // 打开 Playwright Inspector
});
```

### 4. 截图和录制

```javascript
test('失败时截图', async ({ page }) => {
  await page.goto('/');
  await page.screenshot({ path: 'screenshot.png' });
});
```

## CI/CD 集成

### GitHub Actions 示例

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30
```

## 常见问题

### Q: 测试失败，找不到元素
A: 检查元素选择器是否正确，使用 `await page.waitForSelector()` 等待元素加载。

### Q: 测试在 CI 中失败但本地通过
A: 可能是网络速度或环境差异，增加超时时间或使用 `waitForLoadState()`。

### Q: 如何测试需要登录的功能？
A: 使用 `storageState` 保存登录状态：
```javascript
test.use({ storageState: 'auth.json' });
```

## 相关资源

- [Playwright 官方文档](https://playwright.dev)
- [Playwright 最佳实践](https://playwright.dev/docs/best-practices)
- [选择器最佳实践](https://playwright.dev/docs/selectors)
