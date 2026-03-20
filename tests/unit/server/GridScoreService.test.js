/**
 * Phase16 任务64.6：GridScoreService 单元测试
 */
import { jest } from '@jest/globals';
import { GridScoreService, CHINA_BOUNDS } from '../../../server/services/GridScoreService.js';

describe('GridScoreService', () => {

  describe('generateGrid()', () => {
    it('应生成中国区域网格点', () => {
      const svc = new GridScoreService();
      const points = svc.generateGrid();
      expect(points.length).toBeGreaterThan(0);
      // 每个点都在中国区域内
      for (const p of points) {
        expect(p.lat).toBeGreaterThanOrEqual(CHINA_BOUNDS.latMin);
        expect(p.lat).toBeLessThanOrEqual(CHINA_BOUNDS.latMax);
        expect(p.lon).toBeGreaterThanOrEqual(CHINA_BOUNDS.lonMin);
        expect(p.lon).toBeLessThanOrEqual(CHINA_BOUNDS.lonMax);
      }
    });

    it('网格间距应为 5°', () => {
      const svc = new GridScoreService();
      const points = svc.generateGrid();
      const lats = [...new Set(points.map(p => p.lat))].sort((a, b) => a - b);
      const lons = [...new Set(points.map(p => p.lon))].sort((a, b) => a - b);
      // 检查间距
      for (let i = 1; i < lats.length; i++) {
        expect(lats[i] - lats[i - 1]).toBeCloseTo(CHINA_BOUNDS.step, 5);
      }
      for (let i = 1; i < lons.length; i++) {
        expect(lons[i] - lons[i - 1]).toBeCloseTo(CHINA_BOUNDS.step, 5);
      }
    });

    it('总点数应在 80-130 之间', () => {
      const svc = new GridScoreService();
      const points = svc.generateGrid();
      expect(points.length).toBeGreaterThanOrEqual(80);
      expect(points.length).toBeLessThanOrEqual(130);
    });
  });

  describe('getCache()', () => {
    it('无缓存时返回 null', () => {
      const svc = new GridScoreService();
      svc._cache = { sunrise: null, sunset: null };
      expect(svc.getCache('sunset')).toBeNull();
    });

    it('缓存新鲜时 stale=false', () => {
      const svc = new GridScoreService();
      svc._cache = {
        sunrise: null,
        sunset: { updatedAt: new Date().toISOString(), gridPoints: [] }
      };
      expect(svc.getCache('sunset').stale).toBe(false);
    });

    it('缓存超时时 stale=true', () => {
      const svc = new GridScoreService();
      const oldTime = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      svc._cache = {
        sunrise: null,
        sunset: { updatedAt: oldTime, gridPoints: [] }
      };
      expect(svc.getCache('sunset').stale).toBe(true);
    });

    it('应支持按 period 读取独立缓存', () => {
      const svc = new GridScoreService();
      svc._cache = {
        sunrise: { updatedAt: new Date().toISOString(), gridPoints: [{ lat: 1, lon: 2, score: 66 }] },
        sunset: { updatedAt: new Date().toISOString(), gridPoints: [{ lat: 3, lon: 4, score: 88 }] }
      };

      expect(svc.getCache('sunrise').gridPoints[0].score).toBe(66);
      expect(svc.getCache('sunset').gridPoints[0].score).toBe(88);
    });
  });

  describe('manualRefresh() 频控', () => {
    it('60 分钟内重复调用应被拒绝', async () => {
      const svc = new GridScoreService();
      svc._lastManualRefresh.sunset = Date.now(); // 刚刚刷新过
      svc._cache = {
        sunrise: null,
        sunset: { updatedAt: new Date().toISOString(), gridPoints: [] }
      };
      const result = await svc.manualRefresh('sunset');
      expect(result.ok).toBe(false);
      expect(result.message).toContain('频控');
    });
  });

  describe('refreshIfStale()', () => {
    it('缓存新鲜时不触发刷新', async () => {
      const svc = new GridScoreService();
      svc._cache = {
        sunrise: null,
        sunset: { updatedAt: new Date().toISOString(), gridPoints: [{ lat: 30, lon: 120, score: 60 }] }
      };
      const spy = jest.spyOn(svc, '_doRefresh');
      await svc.refreshIfStale(undefined, 'sunset');
      expect(spy).not.toHaveBeenCalled();
    });
  });
});
