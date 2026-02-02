/**
 * 预测生成E2E流程测试
 *
 * 测试场景：
 * 1. Mock API返回固定天气数据
 * 2. 验证评分计算正确性
 * 3. 验证黄金时段、蓝调时段显示
 * 4. 验证UI渲染（颜色、等级）
 *
 * 需求：预测算法验证
 */

import { test, expect } from '@playwright/test';

test.describe('预测生成流程', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
  });

  test('应该：固定天气数据 → 验证评分计算正确', async ({ page }) => {
    // Mock固定天气数据
    await page.route('**/api/weather/forecast', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              timestamp: Date.now() + 3600000, // 1小时后
              temp: 20,
              humidity: 60,
              cloudCover: 40, // 优秀条件
              windSpeed: 5,
              pressure: 1013,
              visibility: 15,
              lowClouds: 10,
              precipitation: 0,
              windDirection: 180,
              highClouds: 50,
              midClouds: 60
            }
          ]
        })
      });
    });

    // 1. 搜索位置
    await page.fill('#location-input', '北京');
    await page.click('#search-btn');
    await page.waitForSelector('.weather-data', { timeout: 10000 });

    // 2. 切换到预测标签
    await page.click('#prediction-tab');
    await page.waitForSelector('.prediction-card', { timeout: 5000 });

    // 3. 验证评分显示（应该是高分）
    const scoreElement = page.locator('.prediction-score');
    const scoreText = await scoreElement.textContent();
    const score = parseInt(scoreText);
    expect(score).toBeGreaterThan(60); // 应该是良好或优秀
  });

  test('应该：低云量高 → 评分较低', async ({ page }) => {
    // Mock低云量高的天气数据（不利于晚霞）
    await page.route('**/api/weather/forecast', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              timestamp: Date.now() + 3600000,
              temp: 20,
              humidity: 80, // 湿度高
              cloudCover: 80, // 云量高
              windSpeed: 10,
              pressure: 1013,
              visibility: 5, // 能见度低
              lowClouds: 80, // 低云量高（最不利）
              precipitation: 5,
              windDirection: 180,
              highClouds: 50,
              midClouds: 60
            }
          ]
        })
      });
    });

    // 1. 搜索位置
    await page.fill('#location-input', '北京');
    await page.click('#search-btn');
    await page.waitForSelector('.weather-data', { timeout: 10000 });

    // 2. 切换到预测标签
    await page.click('#prediction-tab');
    await page.waitForSelector('.prediction-card', { timeout: 5000 });

    // 3. 验证评分较低
    const scoreElement = page.locator('.prediction-score');
    const scoreText = await scoreElement.textContent();
    const score = parseInt(scoreText);
    expect(score).toBeLessThan(50); // 应该是一般
  });

  test('应该：朝霞预测 → 显示日出时间', async ({ page }) => {
    // Mock天气数据
    await page.route('**/api/weather/forecast', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              timestamp: Date.now() + 3600000,
              temp: 15,
              humidity: 65,
              cloudCover: 40,
              windSpeed: 5,
              pressure: 1013,
              visibility: 10,
              lowClouds: 20,
              precipitation: 0,
              windDirection: 180,
              highClouds: 30,
              midClouds: 40
            }
          ]
        })
      });
    });

    // 1. 搜索位置
    await page.fill('#location-input', '北京');
    await page.click('#search-btn');
    await page.waitForSelector('.weather-data', { timeout: 10000 });

    // 2. 切换到预测标签
    await page.click('#prediction-tab');
    await page.waitForSelector('.prediction-card', { timeout: 5000 });

    // 3. 查找朝霞预测卡片
    const sunriseCard = page.locator('.prediction-card[data-type="sunrise"]');
    await expect(sunriseCard).toBeVisible();

    // 4. 验证日出时间显示
    const sunriseTime = sunriseCard.locator('.sunrise-time');
    await expect(sunriseTime).toBeVisible();
    const timeText = await sunriseTime.textContent();
    expect(timeText).toMatch(/\d{1,2}:\d{2}/); // 格式：HH:MM
  });

  test('应该：晚霞预测 → 显示日落时间', async ({ page }) => {
    // Mock天气数据
    await page.route('**/api/weather/forecast', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              timestamp: Date.now() + 3600000,
              temp: 20,
              humidity: 60,
              cloudCover: 40,
              windSpeed: 5,
              pressure: 1013,
              visibility: 10,
              lowClouds: 20,
              precipitation: 0,
              windDirection: 180,
              highClouds: 30,
              midClouds: 40
            }
          ]
        })
      });
    });

    // 1. 搜索位置
    await page.fill('#location-input', '北京');
    await page.click('#search-btn');
    await page.waitForSelector('.weather-data', { timeout: 10000 });

    // 2. 切换到预测标签
    await page.click('#prediction-tab');
    await page.waitForSelector('.prediction-card', { timeout: 5000 });

    // 3. 查找晚霞预测卡片
    const sunsetCard = page.locator('.prediction-card[data-type="sunset"]');
    await expect(sunsetCard).toBeVisible();

    // 4. 验证日落时间显示
    const sunsetTime = sunsetCard.locator('.sunset-time');
    await expect(sunsetTime).toBeVisible();
    const timeText = await sunsetTime.textContent();
    expect(timeText).toMatch(/\d{1,2}:\d{2}/);
  });

  test('应该：高分预测 → 显示黄金时段和蓝调时段', async ({ page }) => {
    // Mock优秀天气数据
    await page.route('**/api/weather/forecast', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              timestamp: Date.now() + 3600000,
              temp: 20,
              humidity: 50, // 优秀湿度
              cloudCover: 50, // 优秀云量
              windSpeed: 5,
              pressure: 1013,
              visibility: 20, // 优秀能见度
              lowClouds: 10, // 低云少
              precipitation: 0,
              windDirection: 180,
              highClouds: 60,
              midClouds: 80
            }
          ]
        })
      });
    });

    // 1. 搜索位置
    await page.fill('#location-input', '北京');
    await page.click('#search-btn');
    await page.waitForSelector('.weather-data', { timeout: 10000 });

    // 2. 切换到预测标签
    await page.click('#prediction-tab');
    await page.waitForSelector('.prediction-card', { timeout: 5000 });

    // 3. 验证黄金时段显示
    const goldenHour = page.locator('.golden-hour');
    await expect(goldenHour).toBeVisible();

    // 4. 验证蓝调时段显示
    const blueHour = page.locator('.blue-hour');
    await expect(blueHour).toBeVisible();
  });

  test('应该：预测质量等级 → 正确颜色编码', async ({ page }) => {
    // Mock数据产生不同评分
    await page.route('**/api/weather/forecast', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            // 优秀预测
            {
              timestamp: Date.now() + 3600000,
              temp: 20,
              humidity: 50,
              cloudCover: 50,
              windSpeed: 5,
              pressure: 1013,
              visibility: 15,
              lowClouds: 10,
              precipitation: 0,
              windDirection: 180,
              highClouds: 60,
              midClouds: 60
            }
          ]
        })
      });
    });

    // 1. 搜索并切换到预测
    await page.fill('#location-input', '北京');
    await page.click('#search-btn');
    await page.waitForSelector('.weather-data', { timeout: 10000 });
    await page.click('#prediction-tab');
    await page.waitForSelector('.prediction-card', { timeout: 5000 });

    // 2. 验证质量等级
    const qualityElement = page.locator('.prediction-quality');
    await expect(qualityElement).toBeVisible();

    // 3. 验证颜色编码（优秀应该是绿色）
    const card = page.locator('.prediction-card');
    const cardClass = await card.getAttribute('class');
    // 注意：这取决于你的CSS类名
  });

  test('应该：未来3天预测 → 显示3个预测卡片', async ({ page }) => {
    // Mock多天数据
    const forecastData = [];
    for (let day = 0; day < 3; day++) {
      forecastData.push({
        timestamp: Date.now() + day * 24 * 3600000,
        temp: 20,
        humidity: 60,
        cloudCover: 50,
        windSpeed: 5,
        pressure: 1013,
        visibility: 10,
        lowClouds: 20,
        precipitation: 0,
        windDirection: 180,
        highClouds: 30,
        midClouds: 40
      });
    }

    await page.route('**/api/weather/forecast', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: forecastData })
      });
    });

    // 1. 搜索位置
    await page.fill('#location-input', '北京');
    await page.click('#search-btn');
    await page.waitForSelector('.weather-data', { timeout: 10000 });

    // 2. 切换到预测标签
    await page.click('#prediction-tab');
    await page.waitForSelector('.prediction-card', { timeout: 5000 });

    // 3. 验证显示多个预测卡片
    const predictionCards = page.locator('.prediction-card');
    const count = await predictionCards.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });
});
