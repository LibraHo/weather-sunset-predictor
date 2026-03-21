/**
 * DualPeriodScorePanel 单元测试（任务 64.8）
 *
 * 测试范围：
 * 1. ChinaSpotsOverlay.getMaxScore() — 散点层最高分计算
 * 2. ChinaRasterOverlay.getMaxScore() — 栅格层最高分计算
 * 3. ChinaSpotsOverlayManager.getMaxScore(period) — 管理器透传
 * 4. ChinaRasterOverlayManager.getMaxScore(period) — 管理器透传
 * 5. WeatherController._renderDualPeriodScorePanel() — DOM 渲染行为
 */

import { jest } from '@jest/globals';

// ─── 1. ChinaSpotsOverlay.getMaxScore ────────────────────────────────────────

describe('ChinaSpotsOverlay.getMaxScore', () => {
  let ChinaSpotsOverlay;

  beforeAll(async () => {
    // stub DOM/canvas APIs
    global.document = {
      createElement: jest.fn(() => ({
        style: { cssText: '' },
        className: '',
        getContext: jest.fn(() => ({
          clearRect: jest.fn(),
          createRadialGradient: jest.fn(() => ({ addColorStop: jest.fn() })),
          beginPath: jest.fn(),
          arc: jest.fn(),
          fill: jest.fn(),
          fillRect: jest.fn(),
        })),
      })),
    };
    global.window = { L: { latLng: jest.fn((lat, lon) => ({ lat, lon })) } };

    const mod = await import('../../../src/services/ChinaSpotsOverlay.js');
    ChinaSpotsOverlay = mod.default;
  });

  test('无点位时返回 null', () => {
    const o = new ChinaSpotsOverlay();
    expect(o.getMaxScore()).toBeNull();
  });

  test('单点返回该点分值', () => {
    const o = new ChinaSpotsOverlay();
    o._spots = [{ lat: 30, lon: 116, score: 78 }];
    expect(o.getMaxScore()).toBe(78);
  });

  test('多点返回最大值', () => {
    const o = new ChinaSpotsOverlay();
    o._spots = [
      { lat: 30, lon: 116, score: 65 },
      { lat: 35, lon: 110, score: 92 },
      { lat: 25, lon: 120, score: 45 },
    ];
    expect(o.getMaxScore()).toBe(92);
  });

  test('全负分值返回最大（边界保护）', () => {
    const o = new ChinaSpotsOverlay();
    o._spots = [{ lat: 30, lon: 116, score: -5 }, { lat: 31, lon: 117, score: -1 }];
    expect(o.getMaxScore()).toBe(-1);
  });

  test('getSpotCount 与 getMaxScore 同步', () => {
    const o = new ChinaSpotsOverlay();
    o._spots = [{ lat: 30, lon: 116, score: 80 }, { lat: 31, lon: 115, score: 70 }];
    expect(o.getSpotCount()).toBe(2);
    expect(o.getMaxScore()).toBe(80);
  });
});

// ─── 2. ChinaRasterOverlay.getMaxScore ───────────────────────────────────────

describe('ChinaRasterOverlay.getMaxScore', () => {
  let ChinaRasterOverlay;
  const NO_DATA = -1;

  beforeAll(async () => {
    global.document = {
      createElement: jest.fn(() => ({
        style: { cssText: '', display: '', filter: '' },
        className: '',
        getContext: jest.fn(() => ({
          clearRect: jest.fn(),
          drawImage: jest.fn(),
          createImageData: jest.fn((w, h) => ({ data: new Uint8ClampedArray(w * h * 4) })),
          putImageData: jest.fn(),
        })),
        appendChild: jest.fn(),
        remove: jest.fn(),
      })),
    };
    global.window = { L: {} };
    global.requestAnimationFrame = jest.fn();

    const mod = await import('../../../src/services/ChinaRasterOverlay.js');
    ChinaRasterOverlay = mod.default;
  });

  test('无栅格数据时返回 null', () => {
    const o = new ChinaRasterOverlay();
    expect(o.getMaxScore()).toBeNull();
  });

  test('所有值低于阈值时返回 null', () => {
    const o = new ChinaRasterOverlay();
    o._rasterData = { values: [10, 20, 5], noData: NO_DATA };
    expect(o.getMaxScore()).toBeNull();
  });

  test('noData 值被忽略', () => {
    const o = new ChinaRasterOverlay();
    o._rasterData = { values: [NO_DATA, 50, 70], noData: NO_DATA };
    expect(o.getMaxScore()).toBe(70);
  });

  test('正常栅格返回有效格元最大值', () => {
    const o = new ChinaRasterOverlay();
    o._rasterData = { values: [35, 65, 88, 45, NO_DATA, 72], noData: NO_DATA };
    expect(o.getMaxScore()).toBe(88);
  });

  test('空 values 数组返回 null', () => {
    const o = new ChinaRasterOverlay();
    o._rasterData = { values: [], noData: NO_DATA };
    expect(o.getMaxScore()).toBeNull();
  });

  test('getSpotCount 始终返回 0（接口对齐）', () => {
    const o = new ChinaRasterOverlay();
    o._rasterData = { values: [50, 80, 90], noData: NO_DATA };
    expect(o.getSpotCount()).toBe(0);
  });
});

// ─── 3. ChinaSpotsOverlayManager.getMaxScore ─────────────────────────────────

describe('ChinaSpotsOverlayManager.getMaxScore', () => {
  let ChinaSpotsOverlayManager;

  beforeAll(async () => {
    // minimal stubs
    global.document = {
      createElement: jest.fn(() => ({
        style: { cssText: '' },
        className: '',
        dataset: {},
        textContent: '',
        addEventListener: jest.fn(),
        appendChild: jest.fn(),
        insertBefore: jest.fn(),
        firstChild: null,
        getContext: jest.fn(() => ({ clearRect: jest.fn() })),
      })),
    };
    global.window = { L: {} };

    const mod = await import('../../../src/services/ChinaSpotsOverlayManager.js');
    ChinaSpotsOverlayManager = mod.default;
  });

  test('未初始化时返回 null', () => {
    const mgr = new ChinaSpotsOverlayManager();
    expect(mgr.getMaxScore('sunset')).toBeNull();
    expect(mgr.getMaxScore('sunrise')).toBeNull();
  });

  test('overlay 无 getMaxScore 方法时安全返回 null', () => {
    const mgr = new ChinaSpotsOverlayManager();
    mgr._sunsetOverlay  = { getMaxScore: undefined };
    mgr._sunriseOverlay = { getMaxScore: undefined };
    // getOverlay 按 period 返回对应 overlay
    expect(mgr.getMaxScore('sunset')).toBeNull();
  });

  test('透传 overlay.getMaxScore() 结果', () => {
    const mgr = new ChinaSpotsOverlayManager();
    mgr._sunsetOverlay  = { getMaxScore: () => 87 };
    mgr._sunriseOverlay = { getMaxScore: () => 62 };
    expect(mgr.getMaxScore('sunset')).toBe(87);
    expect(mgr.getMaxScore('sunrise')).toBe(62);
  });
});

// ─── 4. WeatherController._renderDualPeriodScorePanel DOM 行为 ───────────────

describe('WeatherController._renderDualPeriodScorePanel', () => {
  let WeatherController;

  // 最小 DOM/window stub
  beforeAll(async () => {
    const panelEl = {
      innerHTML: '',
      style: { display: '' },
      classList: { remove: jest.fn(), add: jest.fn() },
      querySelectorAll: jest.fn(() => []),
    };

    global.document = {
      createElement: jest.fn(() => ({
        style: { cssText: '', display: '', filter: '' },
        className: '',
        dataset: {},
        addEventListener: jest.fn(),
        appendChild: jest.fn(),
        insertBefore: jest.fn(),
        firstChild: null,
        getContext: jest.fn(() => ({ clearRect: jest.fn() })),
      })),
      getElementById: jest.fn(id => {
        if (id === 'china-spots-dual-score') return panelEl;
        return null;
      }),
    };
    global.window = { L: {} };
    global.localStorage = {
      getItem: jest.fn(() => null),
      setItem: jest.fn(),
    };

    const mod = await import('../../../src/controllers/WeatherController.js');
    WeatherController = mod.default;
  });

  test('管理器不存在时安全返回不报错', () => {
    const ctrl = new WeatherController({});
    ctrl.chinaSpotsOverlayManager = null;
    expect(() => ctrl._renderDualPeriodScorePanel()).not.toThrow();
  });

  test('panel 元素不存在时安全返回不报错', () => {
    const ctrl = new WeatherController({});
    ctrl.chinaSpotsOverlayManager = {
      getOverlay: jest.fn(() => null),
      getActivePeriod: jest.fn(() => 'sunset'),
    };
    // getElementById 对 china-spots-dual-score 返回 null
    const origGet = global.document.getElementById;
    global.document.getElementById = jest.fn(() => null);
    expect(() => ctrl._renderDualPeriodScorePanel()).not.toThrow();
    global.document.getElementById = origGet;
  });

  test('管理器有数据时 panel innerHTML 被填充', () => {
    const panelEl = {
      innerHTML: '',
      style: { display: '' },
      classList: { remove: jest.fn() },
      querySelectorAll: jest.fn(() => []),
    };
    global.document.getElementById = jest.fn(id =>
      id === 'china-spots-dual-score' ? panelEl : null
    );

    const ctrl = new WeatherController({});
    ctrl.chinaSpotsOverlayManager = {
      getOverlay: jest.fn(period => ({
        getSpotCount: () => (period === 'sunset' ? 12 : 4),
        getMaxScore: () => (period === 'sunset' ? 85 : 60),
      })),
      getActivePeriod: jest.fn(() => 'sunset'),
    };

    ctrl._renderDualPeriodScorePanel();

    expect(panelEl.innerHTML).toContain('🌅');
    expect(panelEl.innerHTML).toContain('🌄');
    expect(panelEl.innerHTML).toContain('85');
    expect(panelEl.innerHTML).toContain('60');
    expect(panelEl.style.display).toBe('grid');
  });
});
