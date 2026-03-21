/**
 * ChinaRasterOverlay 单元测试（Phase 16 / 任务 64 firecloud 栅格渲染）
 */

import {
  scoreToRGBA,
  resolutionForZoom,
  RASTER_MIN_SCORE,
  RASTER_FULL_SCORE,
  FIRECLOUD_PALETTE,
} from '../../../src/services/ChinaRasterOverlay.js';

// ─── scoreToRGBA ─────────────────────────────────────────────────────────────

describe('scoreToRGBA', () => {
  test('低于 RASTER_MIN_SCORE 时返回透明', () => {
    const color = scoreToRGBA(RASTER_MIN_SCORE - 1);
    expect(color.a).toBe(0);
  });

  test('noData 值返回透明', () => {
    const color = scoreToRGBA(-1, -1);
    expect(color.a).toBe(0);
  });

  test('最低可见分值（RASTER_MIN_SCORE）alpha 接近 0（淡入起点）', () => {
    const color = scoreToRGBA(RASTER_MIN_SCORE);
    expect(color.a).toBeLessThanOrEqual(0.2);
    expect(color.r).toBeGreaterThan(200); // 金黄色系
  });

  test('高分值（90）返回深橙红，alpha > 0.7', () => {
    const color = scoreToRGBA(90);
    expect(color.a).toBeGreaterThan(0.7);
    expect(color.r).toBeGreaterThan(230);
    expect(color.g).toBeLessThan(130);
  });

  test('满分（RASTER_FULL_SCORE）alpha 接近上限', () => {
    const color = scoreToRGBA(RASTER_FULL_SCORE);
    expect(color.a).toBeGreaterThan(0.8);
  });

  test('中间分值（60）rgb 均在有效范围内', () => {
    const color = scoreToRGBA(60);
    expect(color.r).toBeGreaterThanOrEqual(0);
    expect(color.r).toBeLessThanOrEqual(255);
    expect(color.g).toBeGreaterThanOrEqual(0);
    expect(color.g).toBeLessThanOrEqual(255);
    expect(color.b).toBeGreaterThanOrEqual(0);
    expect(color.b).toBeLessThanOrEqual(255);
    expect(color.a).toBeGreaterThanOrEqual(0);
    expect(color.a).toBeLessThanOrEqual(1);
  });

  test('颜色单调性：分值越高 alpha 越大（大体趋势）', () => {
    const scores = [RASTER_MIN_SCORE, 50, 60, 70, 80, 90, RASTER_FULL_SCORE];
    const alphas = scores.map(s => scoreToRGBA(s).a);
    for (let i = 1; i < alphas.length; i++) {
      expect(alphas[i]).toBeGreaterThanOrEqual(alphas[i - 1]);
    }
  });

  test('超出 RASTER_FULL_SCORE 时 clamp 到上限色', () => {
    const atMax = scoreToRGBA(RASTER_FULL_SCORE);
    const over  = scoreToRGBA(RASTER_FULL_SCORE + 20);
    expect(over.r).toBe(atMax.r);
    expect(over.g).toBe(atMax.g);
    expect(over.b).toBe(atMax.b);
    expect(over.a).toBeCloseTo(atMax.a, 2);
  });
});

// ─── resolutionForZoom ───────────────────────────────────────────────────────

describe('resolutionForZoom', () => {
  test('低缩放（zoom 4）使用 0.5° 分辨率', () => {
    expect(resolutionForZoom(4)).toBe(0.5);
  });

  test('中等缩放（zoom 6）使用 0.3° 分辨率', () => {
    expect(resolutionForZoom(6)).toBe(0.3);
  });

  test('高缩放（zoom 7+）使用 0.25° 分辨率', () => {
    expect(resolutionForZoom(7)).toBe(0.25);
    expect(resolutionForZoom(9)).toBe(0.25);
  });

  test('分辨率应在合法范围内（0.1~2）', () => {
    [3, 4, 5, 6, 7, 8, 10].forEach(z => {
      const res = resolutionForZoom(z);
      expect(res).toBeGreaterThanOrEqual(0.1);
      expect(res).toBeLessThanOrEqual(2);
    });
  });
});

// ─── 色板完整性 ───────────────────────────────────────────────────────────────

describe('FIRECLOUD_PALETTE', () => {
  test('色板非空，至少 3 个节点', () => {
    expect(FIRECLOUD_PALETTE.length).toBeGreaterThanOrEqual(3);
  });

  test('色板 t 值从 0 到 1', () => {
    const ts = FIRECLOUD_PALETTE.map(p => p.t);
    expect(Math.min(...ts)).toBe(0);
    expect(Math.max(...ts)).toBe(1);
  });

  test('色板 t 值单调递增', () => {
    for (let i = 1; i < FIRECLOUD_PALETTE.length; i++) {
      expect(FIRECLOUD_PALETTE[i].t).toBeGreaterThan(FIRECLOUD_PALETTE[i - 1].t);
    }
  });

  test('所有节点 rgb 值在 [0,255]，a 在 [0,1]', () => {
    FIRECLOUD_PALETTE.forEach(p => {
      expect(p.r).toBeGreaterThanOrEqual(0);
      expect(p.r).toBeLessThanOrEqual(255);
      expect(p.g).toBeGreaterThanOrEqual(0);
      expect(p.g).toBeLessThanOrEqual(255);
      expect(p.b).toBeGreaterThanOrEqual(0);
      expect(p.b).toBeLessThanOrEqual(255);
      expect(p.a).toBeGreaterThanOrEqual(0);
      expect(p.a).toBeLessThanOrEqual(1);
    });
  });
});

// ─── 导出常量边界 ──────────────────────────────────────────────────────────────

describe('常量', () => {
  test('RASTER_MIN_SCORE < RASTER_FULL_SCORE', () => {
    expect(RASTER_MIN_SCORE).toBeLessThan(RASTER_FULL_SCORE);
  });

  test('RASTER_MIN_SCORE 在合理区间（20~50）', () => {
    expect(RASTER_MIN_SCORE).toBeGreaterThanOrEqual(20);
    expect(RASTER_MIN_SCORE).toBeLessThanOrEqual(50);
  });

  test('RASTER_FULL_SCORE 在合理区间（85~100）', () => {
    expect(RASTER_FULL_SCORE).toBeGreaterThanOrEqual(85);
    expect(RASTER_FULL_SCORE).toBeLessThanOrEqual(100);
  });
});
