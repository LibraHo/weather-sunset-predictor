/**
 * Phase16 任务64.6：HeatmapLayer 单元测试
 */
import { scoreToColor, bilinearInterpolate } from '../../../src/services/HeatmapLayer.js';

describe('HeatmapLayer 工具函数', () => {
  describe('scoreToColor()', () => {
    it('≥80 应返回深橙红', () => {
      const color = scoreToColor(85);
      expect(color).not.toBeNull();
      expect(color[0]).toBe(255); // R
      expect(color[1]).toBe(69);  // G
      expect(color[2]).toBe(0);   // B
    });

    it('65-79 应返回橙色', () => {
      const color = scoreToColor(70);
      expect(color).not.toBeNull();
      expect(color[0]).toBe(255);
      expect(color[1]).toBe(140);
    });

    it('50-64 应返回金黄', () => {
      const color = scoreToColor(55);
      expect(color).not.toBeNull();
      expect(color[1]).toBe(209);
    });

    it('<50 应返回 null（不渲染）', () => {
      expect(scoreToColor(49)).toBeNull();
      expect(scoreToColor(30)).toBeNull();
      expect(scoreToColor(0)).toBeNull();
    });

    it('边界值 50 应渲染', () => {
      expect(scoreToColor(50)).not.toBeNull();
    });

    it('边界值 49 不应渲染', () => {
      expect(scoreToColor(49)).toBeNull();
    });
  });

  describe('bilinearInterpolate()', () => {
    const points = [
      { lat: 30, lon: 120, score: 60 },
      { lat: 30, lon: 125, score: 80 },
      { lat: 35, lon: 120, score: 40 },
      { lat: 35, lon: 125, score: 70 },
    ];

    it('精确命中网格点应返回该点评分', () => {
      expect(bilinearInterpolate(120, 30, points)).toBeCloseTo(60, 1);
      expect(bilinearInterpolate(125, 30, points)).toBeCloseTo(80, 1);
    });

    it('插值中心点应返回四个角点的平均值', () => {
      // 中心点 (122.5, 32.5)
      const avg = (60 + 80 + 40 + 70) / 4;
      const result = bilinearInterpolate(122.5, 32.5, points);
      expect(result).toBeCloseTo(avg, 1);
    });

    it('无网格点时返回 null', () => {
      expect(bilinearInterpolate(0, 0, [])).toBeNull();
    });

    it('部分角点缺失时回退到最近点', () => {
      const partial = [{ lat: 30, lon: 120, score: 60 }];
      const result = bilinearInterpolate(121, 31, partial);
      expect(result).toBe(60); // 最近点回退
    });
  });
});
