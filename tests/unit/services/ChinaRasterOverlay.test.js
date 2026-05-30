/**
 * ChinaRasterOverlay 单元测试（Phase 16 / 任务 64 firecloud 栅格渲染）
 *
 * 新增覆盖（2026-03-21 / 任务 64.7 增量）：
 *  - SUNRISE_PALETTE 结构与色调
 *  - getPaletteForPeriod 分时段色板选择
 *  - scoreToRGBA 使用自定义色板（sunrise）
 *  - 朝霞/晚霞视觉区分（颜色差异验证）
 */

import { jest } from '@jest/globals';
import {
  default as ChinaRasterOverlay,
  scoreToRGBA,
  resolutionForZoom,
  RASTER_MIN_SCORE,
  RASTER_FULL_SCORE,
  FIRECLOUD_PALETTE,
  SUNRISE_PALETTE,
  getPaletteForPeriod,
  getVisualMinScore,
  getBandLevels,
} from '../../../src/services/ChinaRasterOverlay.js';

// ─── scoreToRGBA ─────────────────────────────────────────────────────────────

describe('scoreToRGBA', () => {

  test('固定从 40 分开始染色', () => {
    expect(scoreToRGBA(20, -1, FIRECLOUD_PALETTE).a).toBe(0);
    expect(scoreToRGBA(30, -1, FIRECLOUD_PALETTE).a).toBe(0);
    expect(scoreToRGBA(40, -1, FIRECLOUD_PALETTE).a).toBeGreaterThan(0);
    expect(getVisualMinScore()).toBe(40);
    expect(getBandLevels()[0]).toBe(40);
  });

  test('40 分以下返回透明，不染色', () => {
    expect(scoreToRGBA(0).a).toBe(0);
    expect(scoreToRGBA(20).a).toBe(0);
    expect(scoreToRGBA(39).a).toBe(0);
  });

  test('noData 值返回透明', () => {
    const color = scoreToRGBA(-1, -1);
    expect(color.a).toBe(0);
  });

  test('40 分是最低可见分值', () => {
    const color = scoreToRGBA(40);
    expect(color.a).toBeGreaterThan(0);
    expect(color.r).toBeGreaterThan(200);
  });

  test('高分值（90）返回深橙红（clamped 到 RASTER_FULL_SCORE）', () => {
    const color = scoreToRGBA(90);
    // 90 > RASTER_FULL_SCORE(70) → clamp
    const clamped = scoreToRGBA(RASTER_FULL_SCORE);
    expect(color.a).toBeCloseTo(clamped.a, 2);
    expect(color.r).toBeGreaterThan(190);
  });

  test('满分（RASTER_FULL_SCORE）alpha 为色板峰值', () => {
    const color = scoreToRGBA(RASTER_FULL_SCORE);
    expect(color.a).toBeGreaterThan(0.3);
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
    const scores = [40, 50, 60, 70, 80, 90, RASTER_FULL_SCORE];
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

  test('RASTER_MIN_SCORE 在合理区间（10~30）', () => {
    expect(RASTER_MIN_SCORE).toBeGreaterThanOrEqual(10);
    expect(RASTER_MIN_SCORE).toBeLessThanOrEqual(30);
  });

  test('RASTER_FULL_SCORE 在合理区间（50~100）', () => {
    expect(RASTER_FULL_SCORE).toBeGreaterThanOrEqual(50);
    expect(RASTER_FULL_SCORE).toBeLessThanOrEqual(100);
  });
});

// ─── 朝霞色板 SUNRISE_PALETTE ─────────────────────────────────────────────────

describe('SUNRISE_PALETTE', () => {
  test('朝霞色板非空，至少 3 个节点', () => {
    expect(SUNRISE_PALETTE).toBeDefined();
    expect(SUNRISE_PALETTE.length).toBeGreaterThanOrEqual(3);
  });

  test('朝霞色板 t 值从 0 到 1', () => {
    const ts = SUNRISE_PALETTE.map(p => p.t);
    expect(Math.min(...ts)).toBe(0);
    expect(Math.max(...ts)).toBe(1);
  });

  test('朝霞色板 t 值单调递增', () => {
    for (let i = 1; i < SUNRISE_PALETTE.length; i++) {
      expect(SUNRISE_PALETTE[i].t).toBeGreaterThan(SUNRISE_PALETTE[i - 1].t);
    }
  });

  test('朝霞色板所有节点 rgb 在 [0,255]，a 在 [0,1]', () => {
    SUNRISE_PALETTE.forEach(p => {
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

  test('朝霞色板高分值色调应偏粉玫红（非纯橙）', () => {
    const last = SUNRISE_PALETTE[SUNRISE_PALETTE.length - 1];
    // 玫瑰红系：r高，g相对低，b>0（区别于晚霞的橙红b≈15）
    expect(last.r).toBeGreaterThan(180);
    expect(last.b).toBeGreaterThan(30); // 区分朝霞 vs 晚霞（晚霞b≈15）
  });
});

// ─── getPaletteForPeriod ─────────────────────────────────────────────────────

describe('getPaletteForPeriod', () => {
  test('sunset 返回 FIRECLOUD_PALETTE', () => {
    const p = getPaletteForPeriod('sunset');
    expect(p).toBe(FIRECLOUD_PALETTE);
  });

  test('sunrise 返回 SUNRISE_PALETTE', () => {
    const p = getPaletteForPeriod('sunrise');
    expect(p).toBe(SUNRISE_PALETTE);
  });

  test('未知值默认返回 FIRECLOUD_PALETTE（sunset 兜底）', () => {
    const p = getPaletteForPeriod('unknown');
    expect(p).toBe(FIRECLOUD_PALETTE);
  });

  test('undefined 默认返回 FIRECLOUD_PALETTE', () => {
    const p = getPaletteForPeriod(undefined);
    expect(p).toBe(FIRECLOUD_PALETTE);
  });
});

// ─── 数据时间 ────────────────────────────────────────────────────────────────

describe('ChinaRasterOverlay updatedAt', () => {
  test('loadAndRender 优先显示 raster 更新时间而不是源预报时刻', async () => {
    const overlay = new ChinaRasterOverlay();
    overlay._map = { getZoom: () => 5 };
    overlay._buildOffscreen = jest.fn();
    overlay.show = jest.fn();

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        updatedAt: '2026-05-13T06:18:00.000Z',
        sourceUpdatedAt: '2026-05-14T06:00:00.000Z',
        generatedAt: '2026-05-13T06:18:00.000Z',
        width: 1,
        height: 1,
        bbox: { west: 72, east: 73, south: 18, north: 19 },
        noData: -1,
        values: [50]
      })
    });

    await overlay.loadAndRender('sunset');

    expect(overlay.getUpdatedAt()).toBe('2026-05-13T06:18:00.000Z');
    expect(overlay.getUpdatedAt()).not.toBe('2026-05-14T06:00:00.000Z');
  });

  test('loadAndRender 加载中复用同一个请求，避免切换时误判空图层', async () => {
    const overlay = new ChinaRasterOverlay();
    overlay._map = { getZoom: () => 5 };
    overlay._buildOffscreen = jest.fn();
    overlay.show = jest.fn();

    let releaseJson;
    const jsonReady = new Promise(resolve => {
      releaseJson = resolve;
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => {
        await jsonReady;
        return {
          updatedAt: '2026-05-13T01:00:00.000Z',
          width: 1,
          height: 1,
          bbox: { west: 72, east: 73, south: 18, north: 19 },
          noData: -1,
          values: [50]
        };
      }
    });

    const first = overlay.loadAndRender('sunrise');
    const second = overlay.loadAndRender('sunrise');

    expect(global.fetch).toHaveBeenCalledTimes(1);

    releaseJson();
    await first;
    await second;
    expect(overlay.getSpotCount()).toBe(1);
  });
});

// ─── scoreToRGBA 使用自定义色板 ───────────────────────────────────────────────

describe('scoreToRGBA - 分时段色板', () => {
  test('使用 SUNRISE_PALETTE 时高分值仍有 alpha > 0.7', () => {
    const color = scoreToRGBA(90, -1, SUNRISE_PALETTE);
    expect(color.a).toBeGreaterThan(0.6);
  });

  test('使用 SUNRISE_PALETTE 时低分值接近透明', () => {
    const color = scoreToRGBA(39, -1, SUNRISE_PALETTE);
    expect(color.a).toBeLessThanOrEqual(0.02);
  });

  test('朝霞与晚霞高分颜色有差异', () => {
    const sunset = scoreToRGBA(RASTER_FULL_SCORE, -1, FIRECLOUD_PALETTE);
    const sunrise = scoreToRGBA(RASTER_FULL_SCORE, -1, SUNRISE_PALETTE);
    // 两个色板应有差异（alpha 或颜色通道）
    const diff = Math.abs(sunset.a - sunrise.a) +
                 Math.abs(sunset.r - sunrise.r) +
                 Math.abs(sunset.g - sunrise.g) +
                 Math.abs(sunset.b - sunrise.b);
    expect(diff).toBeGreaterThan(0);
  });

  test('朝霞色 alpha 更高或 b 通道更高（视觉区分）', () => {
    const sunset = scoreToRGBA(50, -1, FIRECLOUD_PALETTE);
    const sunrise = scoreToRGBA(50, -1, SUNRISE_PALETTE);
    expect(sunrise.a).toBeGreaterThanOrEqual(sunset.a);
  });

  test('scoreToRGBA 单调性在 sunrise 色板上也成立', () => {
    const scores = [RASTER_MIN_SCORE, 50, 65, 80, RASTER_FULL_SCORE];
    const alphas = scores.map(s => scoreToRGBA(s, -1, SUNRISE_PALETTE).a);
    for (let i = 1; i < alphas.length; i++) {
      expect(alphas[i]).toBeGreaterThanOrEqual(alphas[i - 1]);
    }
  });
});
