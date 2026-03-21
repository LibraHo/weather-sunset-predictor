/**
 * IDWInterpolator 单元测试
 */

describe('IDWInterpolator', () => {
  let IDWInterpolator;
  let interpolator;

  beforeAll(async () => {
    // 动态导入 CommonJS 模块
    const module = await import('../../../server/utils/IDWInterpolator.js');
    IDWInterpolator = module.default || module;
  });

  beforeEach(() => {
    interpolator = new IDWInterpolator({
      power: 2,
      maxRadiusKm: 1000, // 增大半径以覆盖中国大部分区域
      minNeighbors: 2    // 降低最少邻居数要求
    });
  });

  describe('haversineDistance', () => {
    it('应该正确计算两点之间的距离（公里）', () => {
      const distance = interpolator._haversineDistance(
        39.9042, 116.4074, // 北京
        31.2304, 121.4737  // 上海
      );
      expect(distance).toBeCloseTo(1068, -1); // 约 1068 公里
    });

    it('应该正确计算相同点的距离为 0', () => {
      const distance = interpolator._haversineDistance(
        39.9042, 116.4074,
        39.9042, 116.4074
      );
      expect(distance).toBeCloseTo(0, 1);
    });
  });

  describe('interpolateSingle', () => {
    it('应该对单点进行 IDW 插值', () => {
      const points = [
        { lat: 40.0, lon: 116.0, score: 80 },  // 北京附近
        { lat: 35.0, lon: 110.0, score: 60 },  // 西安附近
        { lat: 30.0, lon: 114.0, score: 70 }   // 武汉附近
      ];

      const { value, neighbors } = interpolator._interpolateSingle(
        36.0, 114.0, // 郑州（三者中间）
        points
      );

      expect(value).toBeGreaterThan(0);
      expect(value).toBeLessThanOrEqual(100);
      expect(neighbors).toBeGreaterThanOrEqual(2);
    });

    it('距离过近时应该直接返回参考点值', () => {
      const points = [
        { lat: 39.9, lon: 116.4, score: 85 }
      ];

      const { value, neighbors } = interpolator._interpolateSingle(
        39.9, 116.4, // 相同点
        points
      );

      expect(value).toBe(85);
      expect(neighbors).toBe(1);
    });

    it('邻居不足时应该返回 null', () => {
      const points = [
        { lat: 39.9, lon: 116.4, score: 80 }
      ];

      const { value, neighbors } = interpolator._interpolateSingle(
        0.0, 0.0, // 距离很远（南极附近）
        points
      );

      expect(value).toBeNull();
      expect(neighbors).toBe(0); // 没有邻居在半径内
    });
  });

  describe('interpolate', () => {
    it('应该将离散点插值为栅格矩阵', () => {
      const points = [
        { lat: 40.0, lon: 116.0, score: 80 },
        { lat: 30.0, lon: 121.0, score: 60 },
        { lat: 20.0, lon: 113.0, score: 70 }
      ];

      const bbox = {
        west: 110.0,
        south: 18.0,
        east: 125.0,
        north: 45.0
      };

      const result = interpolator.interpolate(points, bbox, 1.0);

      expect(result).toHaveProperty('width');
      expect(result).toHaveProperty('height');
      expect(result).toHaveProperty('values');
      expect(result).toHaveProperty('meta');

      expect(result.width).toBe(15); // (125 - 110) / 1.0
      expect(result.height).toBe(27); // (45 - 18) / 1.0
      expect(result.values).toHaveLength(405); // 15 * 27

      expect(result.meta).toMatchObject({
        algorithm: 'IDW',
        power: 2,
        sourcePoints: 3
      });
    });

    it('应该正确处理 noData 值', () => {
      const points = [
        { lat: 40.0, lon: 116.0, score: 80 }
      ];

      const bbox = {
        west: 110.0,
        south: 18.0,
        east: 125.0,
        north: 45.0
      };

      const result = interpolator.interpolate(points, bbox, 1.0);

      // 远离参考点的区域应该为 -1（无数据）
      const hasNoData = result.values.includes(-1);
      expect(hasNoData).toBe(true);
    });

    it('应该支持自定义 noDataValue', () => {
      const points = [
        { lat: 40.0, lon: 116.0, score: 80 }
      ];

      const bbox = {
        west: 110.0,
        south: 18.0,
        east: 125.0,
        north: 45.0
      };

      const result = interpolator.interpolate(points, bbox, 1.0, {
        noDataValue: -999
      });

      expect(result.values).toContain(-999);
      expect(result.values).not.toContain(-1);
    });

    it('应该正确过滤无效的评分点', () => {
      const points = [
        { lat: 40.0, lon: 116.0, score: 80 },
        { lat: 30.0, lon: 121.0, score: null },
        { lat: 20.0, lon: 113.0, score: NaN },
        { lat: 35.0, lon: 118.0, score: 70 }
      ];

      const bbox = {
        west: 110.0,
        south: 18.0,
        east: 125.0,
        north: 45.0
      };

      const result = interpolator.interpolate(points, bbox, 1.0);

      expect(result.meta.sourcePoints).toBe(2); // 只有 2 个有效点
    });

    it('应该正确限制插值值范围 [0, 100]', () => {
      const points = [
        { lat: 40.0, lon: 116.0, score: 150 }, // 超出范围
        { lat: 30.0, lon: 121.0, score: -50 },  // 超出范围
        { lat: 20.0, lon: 113.0, score: 70 }
      ];

      const bbox = {
        west: 110.0,
        south: 18.0,
        east: 125.0,
        north: 45.0
      };

      const result = interpolator.interpolate(points, bbox, 1.0);

      const validValues = result.values.filter(v => v !== -1);
      validValues.forEach(value => {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      });
    });
  });
});
