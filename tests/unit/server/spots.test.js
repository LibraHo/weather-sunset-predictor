/**
 * spots.test.js - 火烧云散点 API 路由单元测试
 *
 * 测试范围：
 * - normalizeSpotsPeriod 函数
 * - period 参数验证逻辑
 * - SUPPORTED_PERIODS 常量
 *
 * 注意：路由的完整集成测试需要完整的 Express 应用上下文，
 * 此文件专注于可独立测试的工具函数。
 *
 * 关联需求：37.3, 37.5, 37.8
 */

import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { normalizeSpotsPeriod, SUPPORTED_PERIODS } from '../../../server/routes/spots.js';

describe('Spots API Router - normalizeSpotsPeriod', () => {
  test('normalizeSpotsPeriod: 合法的 sunrise/sunset 应保留', () => {
    expect(normalizeSpotsPeriod('sunrise')).toBe('sunrise');
    expect(normalizeSpotsPeriod('sunset')).toBe('sunset');
    expect(normalizeSpotsPeriod('SUNRISE')).toBe('sunrise');
    expect(normalizeSpotsPeriod('SUNSET')).toBe('sunset');
  });

  test('normalizeSpotsPeriod: 非法值应返回 null', () => {
    expect(normalizeSpotsPeriod('invalid')).toBeNull();
    expect(normalizeSpotsPeriod('')).toBeNull();
    expect(normalizeSpotsPeriod(null)).toBeNull();
    expect(normalizeSpotsPeriod(undefined)).toBeNull();
    expect(normalizeSpotsPeriod('noon')).toBeNull();
  });

  test('normalizeSpotsPeriod: 空字符串或缺失参数应返回 null', () => {
    expect(normalizeSpotsPeriod('')).toBeNull();
    expect(normalizeSpotsPeriod(null)).toBeNull();
    expect(normalizeSpotsPeriod(undefined)).toBeNull();
  });

  test('SUPPORTED_PERIODS: 仅包含 sunrise 和 sunset', () => {
    expect(SUPPORTED_PERIODS).toEqual(['sunrise', 'sunset']);
    expect(SUPPORTED_PERIODS.length).toBe(2);
  });

  test('normalizeSpotsPeriod: 测试边界情况', () => {
    // 数字类型
    expect(normalizeSpotsPeriod(123)).toBeNull();
    // 对象类型
    expect(normalizeSpotsPeriod({})).toBeNull();
    // 数组类型
    expect(normalizeSpotsPeriod([])).toBeNull();
    // 布尔值
    expect(normalizeSpotsPeriod(true)).toBeNull();
  });
  test('public map GET routes stay cache-only and do not trigger grid refresh', () => {
    const repoRoot = process.cwd();
    const routeFiles = [
      path.join(repoRoot, 'server/routes/spots.js'),
      path.join(repoRoot, 'server/routes/heatmap.js')
    ];

    for (const file of routeFiles) {
      const source = fs.readFileSync(file, 'utf-8');
      const publicGetBlocks = source.match(/router\.get\('\/(?:china|grid|china\/raster|china\/raster-overlay\.png)'[\s\S]*?\n\}\);/g) || [];
      expect(publicGetBlocks.length).toBeGreaterThan(0);
      for (const block of publicGetBlocks) {
        expect(block).not.toContain('refreshIfStale');
      }
    }
  });
});
