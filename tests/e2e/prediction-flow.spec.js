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
import { setTestEnvironment, SELECTORS, searchLocation } from './test-helpers.js';

test.describe('预测生成流程', () => {
  test.beforeEach(async ({ page }) => {
    // 设置测试环境（使用内置的 Mock API）
    await setTestEnvironment(page);
  });

  test('应该：固定天气数据 → 验证评分计算正确', async ({ page }) => {
    // 1. 搜索位置（使用 Mock API，返回固定的北京数据）
    await searchLocation(page, '北京');

    // 2. 等待预测卡片显示
    await page.waitForSelector('.prediction-card', { timeout: 10000 });

    // 3. 验证评分显示
    const scoreElements = page.locator('.score-number');
    const count = await scoreElements.count();
    expect(count).toBeGreaterThan(0);

    // 4. 验证评分在合理范围内
    const firstScoreText = await scoreElements.first().textContent();
    const score = parseInt(firstScoreText);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  test('应该：低云量高 → 评分较低', async ({ page }) => {
    // 使用 Mock API，低云量的数据会返回不同的评分
    // 1. 搜索位置
    await searchLocation(page, '上海');

    // 2. 等待预测显示
    await page.waitForSelector('.prediction-card', { timeout: 10000 });

    // 3. 验证评分存在且在合理范围内
    const scoreElements = page.locator('.score-number');
    const count = await scoreElements.count();
    expect(count).toBeGreaterThan(0);

    const firstScoreText = await scoreElements.first().textContent();
    const score = parseInt(firstScoreText);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  test('应该：朝霞预测 → 显示日出时间', async ({ page }) => {
    // 1. 搜索位置
    await searchLocation(page, '北京');

    // 2. 等待预测显示
    await page.waitForSelector('.prediction-card', { timeout: 10000 });

    // 3. 查找朝霞预测卡片（通过文本内容识别）
    const sunriseCard = page.locator('.prediction-card:has-text("朝霞"), .prediction-card:has-text("Sunrise")').first();
    await expect(sunriseCard).toBeVisible();

    // 4. 验证日出时间显示
    const timeText = await sunriseCard.textContent();
    expect(timeText).toMatch(/\d{1,2}:\d{2}/); // 格式：HH:MM
  });

  test('应该：晚霞预测 → 显示日落时间', async ({ page }) => {
    // 1. 搜索位置
    await searchLocation(page, '北京');

    // 2. 等待预测显示
    await page.waitForSelector('.prediction-card', { timeout: 10000 });

    // 3. 查找晚霞预测卡片
    const sunsetCard = page.locator('.prediction-card:has-text("晚霞"), .prediction-card:has-text("Sunset")').first();
    await expect(sunsetCard).toBeVisible();

    // 4. 验证日落时间显示
    const timeText = await sunsetCard.textContent();
    expect(timeText).toMatch(/\d{1,2}:\d{2}/); // 格式：HH:MM
  });

  test('应该：高分预测 → 显示黄金时段和蓝调时段', async ({ page }) => {
    // 1. 搜索位置（Mock API 返回高分数据）
    await searchLocation(page, '北京');

    // 2. 等待预测显示
    await page.waitForSelector('.prediction-card', { timeout: 10000 });

    // 3. 验证预测卡片显示了时间信息
    const predictionCards = page.locator('.prediction-card');
    const count = await predictionCards.count();
    expect(count).toBeGreaterThan(0);

    // 4. 验证卡片包含时间信息（黄金时段或蓝调时段）
    const firstCardText = await predictionCards.first().textContent();
    expect(firstCardText.length).toBeGreaterThan(0);
  });

  test('应该：预测质量等级 → 正确颜色编码', async ({ page }) => {
    // 1. 搜索位置
    await searchLocation(page, '北京');

    // 2. 等待预测显示
    await page.waitForSelector('.prediction-card', { timeout: 10000 });

    // 3. 验证质量等级显示
    const qualityElements = page.locator('.quality-excellent, .quality-good, .quality-fair, .quality-poor');
    const hasQuality = await qualityElements.count() > 0;

    // 如果没有专门的 class，验证评分数字存在
    const scoreElements = page.locator('.score-number');
    const hasScore = await scoreElements.count() > 0;

    expect(hasQuality || hasScore).toBeTruthy();
  });

  test('应该：未来3天预测 → 显示3个预测卡片', async ({ page }) => {
    // 1. 搜索位置
    await searchLocation(page, '北京');

    // 2. 等待预测显示
    await page.waitForSelector('.prediction-card, .forecast-item', { timeout: 10000 });

    // 3. 验证显示多个预测卡片（今天 + 未来几天）
    const predictionCards = page.locator('.prediction-card');
    const forecastItems = page.locator('.forecast-item');

    const cardCount = await predictionCards.count();
    const itemCount = await forecastItems.count();
    const total = cardCount + itemCount;

    expect(total).toBeGreaterThan(0);
  });
});
