/**
 * GridScoreService 单元测试
 *
 * 测试范围：
 * - 网格生成
 * - 缓存逻辑（内存 + 磁盘持久化）
 * - 过滤与评分
 * - 并发控制
 * - 频控保护
 */

import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import os from 'os';

// 使用动态 import 加载模块
let GridScoreService;
let DEFAULT_MAX_AGE_MS;
let mockCacheFile;

beforeAll(async () => {
  // 设置 mock 缓存文件路径
  mockCacheFile = path.join(os.tmpdir(), `test-grid-cache-${Date.now()}.json`);

  // 加载服务模块
  const gridServiceModule = await import('../../../server/services/GridScoreService.js');
  GridScoreService = gridServiceModule.GridScoreService;
  // 模块不导出 DEFAULT_MAX_AGE_MS，从配置推断为 12h
  DEFAULT_MAX_AGE_MS = 12 * 60 * 60 * 1000;
});

afterAll(() => {
  // 清理测试缓存文件
  if (fs.existsSync(mockCacheFile)) {
    try {
      fs.unlinkSync(mockCacheFile);
    } catch (err) {
      // 忽略清理错误
    }
  }
});

describe('GridScoreService', () => {
  let service;

  beforeEach(() => {
    // 创建新服务实例
    service = new GridScoreService();
  });

  describe('网格生成', () => {
    test('generateGrid 应生成中国区域网格坐标', () => {
      const grid = service.generateGrid();

      expect(Array.isArray(grid)).toBe(true);
      expect(grid.length).toBeGreaterThan(0);

      // 检查第一个点是否在边界内（中国区域）
      const firstPoint = grid[0];
      expect(firstPoint.lat).toBeGreaterThanOrEqual(18);
      expect(firstPoint.lat).toBeLessThanOrEqual(53);
      expect(firstPoint.lon).toBeGreaterThanOrEqual(73);
      expect(firstPoint.lon).toBeLessThanOrEqual(135);

      // 检查最后一个点也在合理边界内（多区域扩展后最大 lon=146）
      const lastPoint = grid[grid.length - 1];
      expect(lastPoint.lat).toBeGreaterThanOrEqual(18);
      expect(lastPoint.lat).toBeLessThanOrEqual(53);
      expect(lastPoint.lon).toBeGreaterThanOrEqual(73);
      expect(lastPoint.lon).toBeLessThanOrEqual(146);
    });

    test('generateGrid 应使用 1 度间隔（步长来自配置）', () => {
      const grid = service.generateGrid();

      // 检查经度间隔
      const latGroup = grid.filter(p => Math.abs(p.lat - 20.0) < 0.01);
      if (latGroup.length > 1) {
        for (let i = 1; i < latGroup.length; i++) {
          const diff = latGroup[i].lon - latGroup[i - 1].lon;
          expect(diff).toBe(1);
        }
      }

      // 检查纬度间隔
      const lonGroup = grid.filter(p => Math.abs(p.lon - 75.0) < 0.01);
      if (lonGroup.length > 1) {
        for (let i = 1; i < lonGroup.length; i++) {
          const diff = lonGroup[i].lat - lonGroup[i - 1].lat;
          expect(diff).toBe(1);
        }
      }
    });

    test('generateGrid 应生成预期数量的网格点', () => {
      const grid = service.generateGrid();

      // 配置已扩展为多区域（中国+日本+韩国），步长 1.0
      // 不再硬编码 104，而是验证数量 >0 且所有点在边界内
      expect(grid.length).toBeGreaterThan(0);

      // 验证所有点都在各区域边界内
      grid.forEach(p => {
        const inChina = p.lon >= 73 && p.lon <= 135 && p.lat >= 18 && p.lat <= 53;
        const inJapan = p.lon >= 129 && p.lon <= 146 && p.lat >= 31 && p.lat <= 46;
        const inKorea = p.lon >= 124 && p.lon <= 132 && p.lat >= 33 && p.lat <= 39.5;
        expect(inChina || inJapan || inKorea).toBe(true);
      });
    });

    test('generateGrid 不应把印度等未支持国家纳入火烧云网格', () => {
      const grid = service.generateGrid();

      expect(grid.some(p => p.lat === 28 && p.lon === 77)).toBe(false); // New Delhi area
      expect(grid.some(p => p.lat === 19 && p.lon === 73)).toBe(false); // Mumbai area
      expect(grid.some(p => p.lat === 28 && p.lon === 85)).toBe(false); // Nepal area
      expect(grid.some(p => p.lat === 40 && p.lon === 116)).toBe(true); // North China remains
    });
  });

  describe('缓存逻辑', () => {
    test('getCache 应返回 null 当缓存不存在时', () => {
      // 清空缓存
      service._cache = { sunrise: null, sunset: null };

      const cache = service.getCache('sunset');
      expect(cache).toBeNull();
    });

    test('getCache 应正确标记过期缓存', () => {
      // 手动设置一个过期的缓存时间（超过默认最大年龄 12h）
      service._cache['sunset'] = {
        updatedAt: new Date(Date.now() - (13 * 60 * 60 * 1000)).toISOString(),
        gridPoints: []
      };

      const cache = service.getCache('sunset');
      expect(cache.stale).toBe(true);
    });

    test('getCache 应标记非过期缓存为 fresh', () => {
      // 手动设置一个新鲜的缓存时间（在默认最大年龄 12h 内）
      service._cache['sunset'] = {
        updatedAt: new Date(Date.now() - (60 * 60 * 1000)).toISOString(),
        gridPoints: []
      };

      const cache = service.getCache('sunset');
      expect(cache.stale).toBe(false);
    });

    test('getCache 应正确处理 sunrise 和 sunset 分时段缓存', () => {
      service._cache = {
        sunrise: {
          updatedAt: new Date().toISOString(),
          gridPoints: [{ lat: 20.0, lon: 75.0, score: 80 }]
        },
        sunset: {
          updatedAt: new Date().toISOString(),
          gridPoints: [{ lat: 25.0, lon: 110.0, score: 70 }]
        }
      };

      const sunriseCache = service.getCache('sunrise');
      const sunsetCache = service.getCache('sunset');

      expect(sunriseCache).not.toBeNull();
      expect(sunriseCache.period).toBe('sunrise');
      expect(sunsetCache).not.toBeNull();
      expect(sunsetCache.period).toBe('sunset');
    });

    test('getJobStatus 空闲时也返回缓存更新时间和点数', () => {
      const updatedAt = new Date().toISOString();
      service._cache['sunrise'] = {
        updatedAt,
        gridPoints: [
          { lat: 40, lon: 116, score: 70 },
          { lat: 41, lon: 117, score: 62 },
        ]
      };

      const status = service.getJobStatus('sunrise');

      expect(status.running).toBe(false);
      expect(status.cacheUpdatedAt).toBe(updatedAt);
      expect(status.cacheCount).toBe(2);
      expect(status.cacheStale).toBe(false);
    });
  });

  describe('period 标准化', () => {
    test('normalizePeriod 应标准化 period 参数', () => {
      expect(service.normalizePeriod('SUNRISE')).toBe('sunrise');
      expect(service.normalizePeriod('Sunset')).toBe('sunset');
      expect(service.normalizePeriod('invalid')).toBe('sunset'); // 默认值
      expect(service.normalizePeriod(null)).toBe('sunset'); // 默认值
      expect(service.normalizePeriod(undefined)).toBe('sunset'); // 默认值
    });
  });

  describe('频控保护', () => {
    beforeEach(() => {
      // Mock _doRefresh 为一个快速函数
      service._doRefresh = jest.fn(async (period) => {
        // 快速完成
      });
    });

    test('manualRefresh 应在冷却期内拒绝请求', async () => {
      // 第一次刷新
      const result1 = await service.manualRefresh('sunset');
      expect(result1.ok).toBe(true);

      // 立即再次刷新（应该在冷却期内）
      const result2 = await service.manualRefresh('sunset');
      expect(result2.ok).toBe(false);
      expect(result2.message).toMatch(/频控保护/);
      expect(result2.message).toMatch(/\d+ 分钟后再试/);
    });

    test('manualRefresh 应在冷却期外接受请求', async () => {
      // Mock 时间：第一次刷新
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);

      const result1 = await service.manualRefresh('sunset');
      expect(result1.ok).toBe(true);

      // Mock 时间：冷却期过后（61分钟后）
      jest.spyOn(Date, 'now').mockReturnValue(now + 61 * 60 * 1000 + 1000);

      const result2 = await service.manualRefresh('sunset');
      expect(result2.ok).toBe(true);
    });

    test('refreshIfStale 不受手动刷新频控限制', async () => {
      // 手动刷新后立即触发自动刷新
      await service.manualRefresh('sunset');
      const result = await service.refreshIfStale(0, 'sunset');

      // 应该返回（不受频控限制）
      expect(result).toBeUndefined();
    });
  });

  describe('refreshIfStale 逻辑', () => {
    beforeEach(() => {
      // Mock _doRefresh 为一个快速函数
      service._doRefresh = jest.fn(async (period) => {
        // 快速完成
      });
    });

    test('refreshIfStale 应在缓存新鲜时不刷新', async () => {
      service._cache['sunset'] = {
        updatedAt: new Date().toISOString(),
        gridPoints: []
      };

      const refreshSpy = jest.spyOn(service, '_doRefresh');

      await service.refreshIfStale(60 * 60 * 1000, 'sunset');

      expect(refreshSpy).not.toHaveBeenCalled();
    });

    test('refreshIfStale 应在缓存过期时刷新', async () => {
      // 设置过期缓存（超过 maxAgeMs 且不是今天，避免 today-skip 逻辑）
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      service._cache['sunset'] = {
        updatedAt: yesterday.toISOString(),
        gridPoints: []
      };

      const refreshSpy = jest.spyOn(service, '_doRefresh');

      await service.refreshIfStale(60 * 60 * 1000, 'sunset');

      expect(refreshSpy).toHaveBeenCalledTimes(1);
    });

    test('refreshIfStale 应在没有缓存时刷新', async () => {
      service._cache['sunset'] = null;

      const refreshSpy = jest.spyOn(service, '_doRefresh');

      await service.refreshIfStale(60 * 60 * 1000, 'sunset');

      expect(refreshSpy).toHaveBeenCalledTimes(1);
    });

    test('refreshIfStale force=true 应刷新当天已有缓存', async () => {
      service._cache['sunset'] = {
        updatedAt: new Date().toISOString(),
        gridPoints: []
      };

      const refreshSpy = jest.spyOn(service, '_doRefresh');

      await service.refreshIfStale(0, 'sunset', { force: true });

      expect(refreshSpy).toHaveBeenCalledTimes(1);
      expect(refreshSpy).toHaveBeenCalledWith('sunset');
    });
  });

  describe('并发控制', () => {
    beforeEach(() => {
      // Mock _doRefresh 为一个快速函数
      service._doRefresh = jest.fn(async (period) => {
        // 快速完成
      });
    });

    test('_doRefresh 应设置和清除 _refreshingByPeriod 标志', async () => {
      // 设置缓存为过期,这样 refreshIfStale 会触发 _doRefresh
      service._cache['sunset'] = {
        updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        gridPoints: []
      };

      // 在 mock 前,先检查标志的初始状态
      expect(service._refreshingByPeriod['sunset']).toBe(false);

      // 启动刷新
      const refreshPromise = service.refreshIfStale(0, 'sunset');

      // 刷新完成后,标志应该被清除
      await refreshPromise;

      expect(service._refreshingByPeriod['sunset']).toBe(false);
    });

    test('手动刷新应设置 lastManualRefresh 时间戳', async () => {
      const beforeRefresh = service._lastManualRefresh['sunset'] || 0;

      await service.manualRefresh('sunset');

      const afterRefresh = service._lastManualRefresh['sunset'];
      expect(afterRefresh).toBeGreaterThan(beforeRefresh);
    });
  });

  describe('refresh completion listeners', () => {
    test('_doRefresh notifies listeners after grid cache is saved', async () => {
      service.generateGrid = jest.fn(() => [{ lat: 40, lon: 116 }]);
      service.fetchAndScore = jest.fn(async () => [{ lat: 40, lon: 116, score: 72 }]);
      service._saveToDisk = jest.fn();
      const listener = jest.fn();

      service.onRefreshComplete(listener);
      await service._doRefresh('sunset');

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith({
        period: 'sunset',
        cache: service._cache.sunset
      });
    });
  });
});
