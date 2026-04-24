/**
 * IdwInterpolator 单元测试
 */

import { IdwInterpolator, haversineKm } from '../../../server/utils/IdwInterpolator.js';

describe('haversineKm', () => {
  test('同点距离为 0', () => {
    expect(haversineKm(39.9, 116.4, 39.9, 116.4)).toBeCloseTo(0, 3);
  });

  test('北京到上海距离约 1068km', () => {
    const dist = haversineKm(39.9, 116.4, 31.2, 121.5);
    expect(dist).toBeGreaterThan(1000);
    expect(dist).toBeLessThan(1150);
  });
});

describe('IdwInterpolator.interpolate', () => {
  const idw = new IdwInterpolator({ power: 2, maxRadiusKm: 500, minNeighbors: 1 });

  test('命中采样点时直接返回原值', () => {
    const points = [{ lat: 39.9, lon: 116.4, score: 75 }];
    const result = idw.interpolate(39.9, 116.4, points);
    expect(result).toBe(75);
  });

  test('邻居不足时返回 noData(-1)', () => {
    const strictIdw = new IdwInterpolator({ power: 2, maxRadiusKm: 10, minNeighbors: 3 });
    const points = [{ lat: 39.9, lon: 116.4, score: 75 }];
    const result = strictIdw.interpolate(39.9, 116.4, points);
    // 只有一个邻居，minNeighbors=3，期望 noData（命中点才直接返回）
    // 此处用稍微偏移的坐标来避开命中
    const result2 = strictIdw.interpolate(39.95, 116.45, points);
    expect(result2).toBe(-1);
  });

  test('超出 maxRadius 的点不参与计算', () => {
    const farIdw = new IdwInterpolator({ power: 2, maxRadiusKm: 50, minNeighbors: 1 });
    const closePoint = { lat: 39.9, lon: 116.4, score: 80 };
    const farPoint  = { lat: 31.2, lon: 121.5, score: 20 }; // >1000km
    // 只有 closePoint 在范围内，结果应接近 80
    const result = farIdw.interpolate(39.91, 116.41, [closePoint, farPoint]);
    expect(result).toBeGreaterThan(70);
  });

  test('两点等距时取平均值', () => {
    const p1 = { lat: 39.0, lon: 116.0, score: 60 };
    const p2 = { lat: 41.0, lon: 116.0, score: 80 };
    // 目标点在两点连线中点
    const result = idw.interpolate(40.0, 116.0, [p1, p2]);
    expect(result).toBeGreaterThan(65);
    expect(result).toBeLessThan(75);
  });
});

describe('IdwInterpolator.interpolateGrid', () => {
  const idw = new IdwInterpolator({ power: 2, maxRadiusKm: 500, minNeighbors: 1 });

  const samplePoints = [
    { lat: 39.9, lon: 116.4, score: 75 },
    { lat: 31.2, lon: 121.5, score: 60 },
    { lat: 23.1, lon: 113.3, score: 50 }
  ];

  const gridDef = {
    west: 72, east: 135, south: 18, north: 53, resolution: 5
  };

  test('输出正确的 width 和 height', () => {
    const { width, height } = idw.interpolateGrid(samplePoints, gridDef);
    expect(width).toBe(Math.round((135 - 72) / 5)); // 12.6 → 13
    expect(height).toBe(Math.round((53 - 18) / 5)); // 7
  });

  test('values 数组长度等于 width * height', () => {
    const { width, height, values } = idw.interpolateGrid(samplePoints, gridDef);
    expect(values.length).toBe(width * height);
  });

  test('values 中有效值在 0~100 范围内', () => {
    const { values } = idw.interpolateGrid(samplePoints, gridDef);
    const valid = values.filter(v => v !== -1);
    expect(valid.length).toBeGreaterThan(0);
    valid.forEach(v => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    });
  });
});
