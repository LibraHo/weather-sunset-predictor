/**
 * SurroundingService 单元测试
 * 需求：22 (前后端分离 - Phase 2)
 */

describe('SurroundingService', () => {
  let SurroundingService;
  let CacheService;
  let surroundingService;

  beforeAll(async () => {
    // 动态导入模块
    SurroundingService = (await import('../../../server/services/SurroundingService.js')).default;
    CacheService = (await import('../../../server/services/CacheService.js')).default;
  });

  beforeEach(() => {
    // 创建服务实例（不传入cacheService以避免网络调用）
    surroundingService = new SurroundingService();
  });

  afterEach(() => {
    // 清理
    if (surroundingService && surroundingService.cacheService) {
      surroundingService.cacheService.destroy();
    }
  });

  describe('calculateSurroundingPoints', () => {
    test('应该计算8个方位的坐标点（默认半径100km）', () => {
      const points = surroundingService.calculateSurroundingPoints(40.0, 116.0);

      expect(points).toHaveLength(8);
      expect(points[0]).toHaveProperty('direction');
      expect(points[0]).toHaveProperty('name');
      expect(points[0]).toHaveProperty('angle');
      expect(points[0]).toHaveProperty('lat');
      expect(points[0]).toHaveProperty('lon');
      expect(points[0]).toHaveProperty('distance');
      expect(points[0].distance).toBe(100);
    });

    test('应该支持自定义半径（50/100/150km）', () => {
      const points50 = surroundingService.calculateSurroundingPoints(40.0, 116.0, 50);
      const points150 = surroundingService.calculateSurroundingPoints(40.0, 116.0, 150);

      expect(points50[0].distance).toBe(50);
      expect(points150[0].distance).toBe(150);
    });

    test('8个方位应该包含所有预期方向', () => {
      const points = surroundingService.calculateSurroundingPoints(40.0, 116.0);
      const directions = points.map(p => p.direction);

      expect(directions).toContain('N');
      expect(directions).toContain('NE');
      expect(directions).toContain('E');
      expect(directions).toContain('SE');
      expect(directions).toContain('S');
      expect(directions).toContain('SW');
      expect(directions).toContain('W');
      expect(directions).toContain('NW');
    });

    test('方位角度应该正确', () => {
      const points = surroundingService.calculateSurroundingPoints(40.0, 116.0);

      const nPoint = points.find(p => p.direction === 'N');
      const ePoint = points.find(p => p.direction === 'E');
      const sPoint = points.find(p => p.direction === 'S');
      const wPoint = points.find(p => p.direction === 'W');

      expect(nPoint.angle).toBe(0);
      expect(ePoint.angle).toBe(90);
      expect(sPoint.angle).toBe(180);
      expect(wPoint.angle).toBe(270);
    });

    test('计算结果应该符合地理公式', () => {
      const points = surroundingService.calculateSurroundingPoints(40.0, 116.0, 100);
      const nPoint = points.find(p => p.direction === 'N');
      const ePoint = points.find(p => p.direction === 'E');

      // 向北移动，纬度应该增加
      expect(nPoint.lat).toBeGreaterThan(40.0);
      expect(nPoint.lon).toBeCloseTo(116.0, 1);

      // 向东移动，经度应该增加
      expect(ePoint.lon).toBeGreaterThan(116.0);
      expect(ePoint.lat).toBeCloseTo(40.0, 1);
    });

    test('方位名称应该是中文', () => {
      const points = surroundingService.calculateSurroundingPoints(40.0, 116.0);

      const nPoint = points.find(p => p.direction === 'N');
      const nePoint = points.find(p => p.direction === 'NE');

      expect(nPoint.name).toBe('北');
      expect(nePoint.name).toBe('东北');
    });
  });

  describe('getSurroundingPredictions - 参数验证', () => {
    test('应该拒绝无效的纬度参数', async () => {
      const params = {
        lat: 100, // 无效纬度
        lon: 116.0,
        radius: 100
      };

      await expect(
        surroundingService.getSurroundingPredictions(params)
      ).rejects.toThrow('纬度必须在-90到90之间');
    });

    test('应该拒绝无效的经度参数', async () => {
      const params = {
        lat: 40.0,
        lon: 200, // 无效经度
        radius: 100
      };

      await expect(
        surroundingService.getSurroundingPredictions(params)
      ).rejects.toThrow('经度必须在-180到180之间');
    });

    test('非标准半径应被宽松接受并继续执行', async () => {
      const params = {
        lat: 40.0,
        lon: 116.0,
        radius: 75 // 非标准半径
      };

      // 不抛错，返回结果；该路径会执行两批周边点预测，保留宽松超时避免全量测试环境偶发超过 Jest 默认 5s。
      const result = await surroundingService.getSurroundingPredictions(params);
      expect(result).toHaveProperty('points');
      expect(result.points).toHaveLength(8);
      expect(result.radius).toBe(75);
    }, 10000);

    test('应该拒绝无效的预测类型', async () => {
      const params = {
        lat: 40.0,
        lon: 116.0,
        type: 'invalid' // 无效类型
      };

      await expect(
        surroundingService.getSurroundingPredictions(params)
      ).rejects.toThrow('预测类型必须是 sunrise 或 sunset');
    });

    test('应该处理无效的日期参数', async () => {
      const params = {
        lat: 40.0,
        lon: 116.0,
        date: 'invalid-date'
      };

      await expect(
        surroundingService.getSurroundingPredictions(params)
      ).rejects.toThrow('无效的日期对象');
    });
  });

  describe('缓存键生成', () => {
    test('_getCacheKey 应该生成正确的键格式', () => {
      const date = new Date('2024-06-21T12:00:00Z');
      const key = surroundingService._getCacheKey(40.0, 116.0, 100, 'sunset', date);

      // 业务已升级为 v2 缓存键格式
      expect(key).toMatch(/^surrounding_v2_40\.00_116\.00_100_sunset_\d{4}-\d{2}-\d{2}$/);
    });

    test('相同参数应该生成相同的缓存键', () => {
      const date = new Date('2024-06-21');
      const key1 = surroundingService._getCacheKey(40.0, 116.0, 100, 'sunset', date);
      const key2 = surroundingService._getCacheKey(40.0, 116.0, 100, 'sunset', date);

      expect(key1).toBe(key2);
    });

    test('不同参数应该生成不同的缓存键', () => {
      const date = new Date('2024-06-21');
      const key1 = surroundingService._getCacheKey(40.0, 116.0, 100, 'sunset', date);
      const key2 = surroundingService._getCacheKey(40.0, 116.0, 150, 'sunset', date);

      expect(key1).not.toBe(key2);
    });

    test('不同类型应该生成不同的缓存键', () => {
      const date = new Date('2024-06-21');
      const key1 = surroundingService._getCacheKey(40.0, 116.0, 100, 'sunset', date);
      const key2 = surroundingService._getCacheKey(40.0, 116.0, 100, 'sunrise', date);

      expect(key1).not.toBe(key2);
    });

    test('不同日期应该生成不同的缓存键', () => {
      const date1 = new Date('2024-06-21');
      const date2 = new Date('2024-06-22');

      const key1 = surroundingService._getCacheKey(40.0, 116.0, 100, 'sunset', date1);
      const key2 = surroundingService._getCacheKey(40.0, 116.0, 100, 'sunset', date2);

      expect(key1).not.toBe(key2);
    });
  });

  describe('边界情况', () => {
    test('应该处理极端纬度（南极/北极）', () => {
      const pointsNorth = surroundingService.calculateSurroundingPoints(89, 0, 100);
      const pointsSouth = surroundingService.calculateSurroundingPoints(-89, 0, 100);

      expect(pointsNorth).toHaveLength(8);
      expect(pointsSouth).toHaveLength(8);
    });

    test('应该处理极端经度（日期变更线）', () => {
      const points = surroundingService.calculateSurroundingPoints(0, 179, 100);

      expect(points).toHaveLength(8);
      // 验证经度不会超出范围
      points.forEach(p => {
        expect(p.lon).toBeGreaterThanOrEqual(-180);
        expect(p.lon).toBeLessThanOrEqual(180);
      });
    });

    test('应该处理最小半径（50km）', () => {
      const points = surroundingService.calculateSurroundingPoints(40.0, 116.0, 50);

      expect(points).toHaveLength(8);
      points.forEach(p => {
        expect(p.distance).toBe(50);
      });
    });

    test('应该处理最大半径（150km）', () => {
      const points = surroundingService.calculateSurroundingPoints(40.0, 116.0, 150);

      expect(points).toHaveLength(8);
      points.forEach(p => {
        expect(p.distance).toBe(150);
      });
    });

    test('应该处理赤道位置', () => {
      const points = surroundingService.calculateSurroundingPoints(0, 0, 100);

      expect(points).toHaveLength(8);
    });

    test('应该处理本初子午线位置', () => {
      const points = surroundingService.calculateSurroundingPoints(40.0, 0, 100);

      expect(points).toHaveLength(8);
    });
  });

  describe('服务初始化', () => {
    test('应该正确初始化方位常量', () => {
      expect(surroundingService.DIRECTIONS).toHaveProperty('N');
      expect(surroundingService.DIRECTIONS).toHaveProperty('NE');
      expect(surroundingService.DIRECTIONS).toHaveProperty('E');
      expect(surroundingService.DIRECTIONS).toHaveProperty('SE');
      expect(surroundingService.DIRECTIONS).toHaveProperty('S');
      expect(surroundingService.DIRECTIONS).toHaveProperty('SW');
      expect(surroundingService.DIRECTIONS).toHaveProperty('W');
      expect(surroundingService.DIRECTIONS).toHaveProperty('NW');
    });

    test('应该支持传入缓存服务', () => {
      const cacheService = new CacheService({ defaultTTL: 3600 });
      const serviceWithCache = new SurroundingService({ cacheService });

      expect(serviceWithCache.cacheService).toBe(cacheService);

      cacheService.destroy();
    });

    test('不传入缓存服务时应该为null', () => {
      const serviceWithoutCache = new SurroundingService();

      expect(serviceWithoutCache.cacheService).toBeNull();
    });
  });
});
