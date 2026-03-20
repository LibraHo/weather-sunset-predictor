/**
 * Phase16 任务64.6：GridScoreService 单元测试
 */
import { jest } from '@jest/globals';
import { GridScoreService, CHINA_BOUNDS, SUPPORTED_PERIODS, DEFAULT_PERIOD } from '../../../server/services/GridScoreService.js';
import fs from 'fs';

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

    it('缓存超时应触发刷新', async () => {
      const svc = new GridScoreService();
      const oldTime = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      svc._cache = {
        sunrise: null,
        sunset: { updatedAt: oldTime, gridPoints: [{ lat: 30, lon: 120, score: 60 }] }
      };
      svc._doRefresh = jest.fn().mockResolvedValue();
      await svc.refreshIfStale(undefined, 'sunset');
      expect(svc._doRefresh).toHaveBeenCalledWith('sunset');
    });

    it('无缓存时应触发刷新', async () => {
      const svc = new GridScoreService();
      svc._cache = { sunrise: null, sunset: null };
      svc._doRefresh = jest.fn().mockResolvedValue();
      await svc.refreshIfStale(undefined, 'sunrise');
      expect(svc._doRefresh).toHaveBeenCalledWith('sunrise');
    });
  });

  describe('normalizePeriod()', () => {
    it('应支持小写输入', () => {
      const svc = new GridScoreService();
      expect(svc.normalizePeriod('sunrise')).toBe('sunrise');
      expect(svc.normalizePeriod('sunset')).toBe('sunset');
    });

    it('应支持大写输入并转为小写', () => {
      const svc = new GridScoreService();
      expect(svc.normalizePeriod('SUNRISE')).toBe('sunrise');
      expect(svc.normalizePeriod('SUNSET')).toBe('sunset');
    });

    it('应支持混合大小写输入', () => {
      const svc = new GridScoreService();
      expect(svc.normalizePeriod('SunRise')).toBe('sunrise');
      expect(svc.normalizePeriod('SunSet')).toBe('sunset');
    });

    it('应处理空字符串并返回默认值', () => {
      const svc = new GridScoreService();
      expect(svc.normalizePeriod('')).toBe(DEFAULT_PERIOD);
    });

    it('应处理 null 并返回默认值', () => {
      const svc = new GridScoreService();
      expect(svc.normalizePeriod(null)).toBe(DEFAULT_PERIOD);
    });

    it('应处理 undefined 并返回默认值', () => {
      const svc = new GridScoreService();
      expect(svc.normalizePeriod(undefined)).toBe(DEFAULT_PERIOD);
    });

    it('应处理无效字符串并返回默认值', () => {
      const svc = new GridScoreService();
      expect(svc.normalizePeriod('invalid')).toBe(DEFAULT_PERIOD);
      expect(svc.normalizePeriod('night')).toBe(DEFAULT_PERIOD);
    });
  });

  describe('manualRefresh() 成功场景', () => {
    it('应允许超过冷却时间后刷新', async () => {
      const svc = new GridScoreService();
      const oldTime = Date.now() - 61 * 60 * 1000; // 61 分钟前
      svc._lastManualRefresh.sunset = oldTime;
      svc._cache = {
        sunrise: null,
        sunset: { updatedAt: new Date().toISOString(), gridPoints: [] }
      };
      svc._doRefresh = jest.fn().mockResolvedValue();
      const result = await svc.manualRefresh('sunset');
      expect(result.ok).toBe(true);
      expect(result.message).toContain('sunset');
      expect(result.message).toContain('刷新成功');
      expect(svc._doRefresh).toHaveBeenCalledWith('sunset');
    });

    it('应允许首次刷新', async () => {
      const svc = new GridScoreService();
      svc._lastManualRefresh.sunset = 0; // 从未刷新过
      svc._cache = {
        sunrise: null,
        sunset: { updatedAt: new Date().toISOString(), gridPoints: [] }
      };
      svc._doRefresh = jest.fn().mockResolvedValue();
      const result = await svc.manualRefresh('sunrise');
      expect(result.ok).toBe(true);
      expect(svc._doRefresh).toHaveBeenCalledWith('sunrise');
    });
  });

  describe('_loadFromDisk() 错误处理', () => {
    it('应处理文件不存在的情况', () => {
      const existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(false);
      const readFileSyncSpy = jest.spyOn(fs, 'readFileSync');

      const svc = new GridScoreService();
      svc._loadFromDisk();

      expect(existsSyncSpy).toHaveBeenCalled();
      expect(readFileSyncSpy).not.toHaveBeenCalled();

      existsSyncSpy.mockRestore();
      readFileSyncSpy.mockRestore();
    });

    it('应处理 JSON 解析错误', () => {
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      const readFileSyncSpy = jest.spyOn(fs, 'readFileSync').mockReturnValue('invalid json');

      const svc = new GridScoreService();
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      svc._loadFromDisk();

      expect(consoleWarnSpy).toHaveBeenCalledWith('[GridScoreService] 磁盘缓存读取失败:', expect.any(String));

      fs.existsSync.mockRestore();
      readFileSyncSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });

    it('应兼容旧版单 period 缓存格式', () => {
      const mockData = {
        updatedAt: new Date().toISOString(),
        gridPoints: [{ lat: 30, lon: 120, score: 70 }]
      };
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(mockData));

      const svc = new GridScoreService();
      svc._loadFromDisk();

      expect(svc._cache.sunset).not.toBeNull();
      expect(svc._cache.sunrise).toBeNull();
      expect(svc._cache.sunset.gridPoints).toEqual(mockData.gridPoints);

      fs.existsSync.mockRestore();
      fs.readFileSync.mockRestore();
    });
  });

  describe('_saveToDisk() 错误处理', () => {
    it('应处理目录创建失败', () => {
      const mkdirSyncSpy = jest.spyOn(fs, 'mkdirSync').mockImplementation(() => {
        throw new Error('Permission denied');
      });
      const writeFileSyncSpy = jest.spyOn(fs, 'writeFileSync');
      const existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(false);

      const svc = new GridScoreService();
      svc._cache = {
        sunrise: null,
        sunset: { updatedAt: new Date().toISOString(), gridPoints: [] }
      };

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      svc._saveToDisk();

      expect(consoleWarnSpy).toHaveBeenCalledWith('[GridScoreService] 磁盘缓存写入失败:', expect.any(String));

      mkdirSyncSpy.mockRestore();
      writeFileSyncSpy.mockRestore();
      existsSyncSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });

    it('应处理文件写入失败', () => {
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      const writeFileSyncSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {
        throw new Error('Disk full');
      });

      const svc = new GridScoreService();
      svc._cache = {
        sunrise: null,
        sunset: { updatedAt: new Date().toISOString(), gridPoints: [] }
      };

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      svc._saveToDisk();

      expect(consoleWarnSpy).toHaveBeenCalledWith('[GridScoreService] 磁盘缓存写入失败:', expect.any(String));

      fs.existsSync.mockRestore();
      writeFileSyncSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });
  });

  describe('SUPPORTED_PERIODS 常量', () => {
    it('应包含 sunrise 和 sunset', () => {
      expect(SUPPORTED_PERIODS).toContain('sunrise');
      expect(SUPPORTED_PERIODS).toContain('sunset');
    });

    it('长度应为 2', () => {
      expect(SUPPORTED_PERIODS.length).toBe(2);
    });
  });

  describe('DEFAULT_PERIOD 常量', () => {
    it('应为 sunset', () => {
      expect(DEFAULT_PERIOD).toBe('sunset');
    });
  });

  describe('CHINA_BOUNDS 常量', () => {
    it('应包含有效的经纬度范围', () => {
      expect(CHINA_BOUNDS.lonMin).toBeLessThan(CHINA_BOUNDS.lonMax);
      expect(CHINA_BOUNDS.latMin).toBeLessThan(CHINA_BOUNDS.latMax);
      expect(CHINA_BOUNDS.step).toBeGreaterThan(0);
    });
  });
});
