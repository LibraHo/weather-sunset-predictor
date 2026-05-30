/**
 * ChinaRasterOverlayManager 单元测试（任务 64.12）
 *
 * 用 module mock 替换 ChinaRasterOverlay，专测管理器逻辑。
 */

import { jest } from '@jest/globals';
import ChinaRasterOverlayManager, { SUPPORTED_PERIODS } from '../../../src/services/ChinaRasterOverlayManager.js';

// ─── 辅助：构造 mock 叠加层实例 ───────────────────────────────────────────────

function makeMockOverlay() {
  return {
    init:          jest.fn(),
    show:          jest.fn(),
    hide:          jest.fn(),
    toggle:        jest.fn(),
    clear:         jest.fn(),
    destroy:       jest.fn(),
    setPeriod:     jest.fn(),
    getPeriod:     jest.fn(() => 'sunset'),
    getUpdatedAt:  jest.fn(() => '2026-03-21T07:00:00Z'),
    getSpotCount:  jest.fn(() => 12),
    isVisible:     jest.fn(() => false),
    loadAndRender: jest.fn(async () => {}),
  };
}

// ─── 辅助：构造 mock Leaflet map ──────────────────────────────────────────────

function makeMockMap() {
  return {
    getContainer: jest.fn(() => ({
      appendChild: jest.fn(),
      style: { position: '' },
    })),
    on:   jest.fn(),
    off:  jest.fn(),
    getZoom:      jest.fn(() => 5),
    getSize:      jest.fn(() => ({ x: 800, y: 500 })),
    latLngToContainerPoint: jest.fn(() => ({ x: 100, y: 80 })),
    getBounds: jest.fn(() => ({
      getSouth: () => 18,
      getNorth: () => 53,
      getWest:  () => 72,
      getEast:  () => 135,
    })),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ChinaRasterOverlayManager', () => {
  let manager;
  let mockMap;
  let mockContainer;

  beforeEach(() => {
    mockMap = makeMockMap();

    mockContainer = {
      firstChild: null,
      insertBefore: jest.fn(),
      appendChild: jest.fn(),
    };

    manager = new ChinaRasterOverlayManager();

    // 手动注入 mock 叠加层，绕过 import 依赖
    manager._sunriseOverlay = makeMockOverlay();
    manager._sunsetOverlay  = makeMockOverlay();
    manager._map = mockMap;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── SUPPORTED_PERIODS ─────────────────────────────────────────────────────

  describe('SUPPORTED_PERIODS', () => {
    test('包含 sunrise 和 sunset', () => {
      expect(SUPPORTED_PERIODS).toContain('sunrise');
      expect(SUPPORTED_PERIODS).toContain('sunset');
      expect(SUPPORTED_PERIODS).toHaveLength(3);
    });
  });

  // ─── init() ────────────────────────────────────────────────────────────────

  describe('init()', () => {
    test('缺少地图实例时不崩溃', () => {
      const mgr = new ChinaRasterOverlayManager();
      expect(() => mgr.init(null)).not.toThrow();
    });

    test('默认激活时段为 sunset', () => {
      expect(manager.getActivePeriod()).toBe('sunset');
    });
  });

  // ─── switchPeriod() ────────────────────────────────────────────────────────

  describe('switchPeriod()', () => {
    test('切换到 sunrise 时隐藏 sunset 并显示 sunrise', () => {
      manager.switchPeriod('sunrise');
      expect(manager.getActivePeriod()).toBe('sunrise');
      expect(manager._sunsetOverlay.hide).toHaveBeenCalled();
      expect(manager._sunriseOverlay.show).toHaveBeenCalled();
    });

    test('切换到相同时段不触发额外 show/hide', () => {
      // Already sunset
      manager.switchPeriod('sunset');
      expect(manager._sunsetOverlay.hide).not.toHaveBeenCalled();
    });

    test('切换到未加载图层时补拉并再次通知状态更新', async () => {
      const onPeriodChange = jest.fn();
      manager.onPeriodChange(onPeriodChange);
      manager._sunriseOverlay.getSpotCount.mockReturnValueOnce(0).mockReturnValue(9);

      manager.switchPeriod('sunrise');
      await Promise.resolve();
      await Promise.resolve();

      expect(manager._sunriseOverlay.loadAndRender).toHaveBeenCalledWith('sunrise');
      expect(onPeriodChange).toHaveBeenCalledWith('sunrise');
      expect(onPeriodChange).toHaveBeenCalledTimes(2);
    });

    test('不支持的时段不崩溃，时段不变', () => {
      expect(() => manager.switchPeriod('invalid')).not.toThrow();
      expect(manager.getActivePeriod()).toBe('sunset');
    });
  });

  // ─── loadAndRender() ───────────────────────────────────────────────────────

  describe('loadAndRender()', () => {
    test('调用 sunset 叠加层的 setPeriod + loadAndRender', async () => {
      await manager.loadAndRender('sunset');
      expect(manager._sunsetOverlay.setPeriod).toHaveBeenCalledWith('sunset');
      expect(manager._sunsetOverlay.loadAndRender).toHaveBeenCalledWith('sunset');
    });

    test('调用 sunrise 叠加层的 setPeriod + loadAndRender', async () => {
      await manager.loadAndRender('sunrise');
      expect(manager._sunriseOverlay.setPeriod).toHaveBeenCalledWith('sunrise');
      expect(manager._sunriseOverlay.loadAndRender).toHaveBeenCalledWith('sunrise');
    });

    test('不支持的时段 resolve undefined', async () => {
      await expect(manager.loadAndRender('invalid')).resolves.toBeUndefined();
    });
  });

  // ─── loadAllPeriods() ─────────────────────────────────────────────────────

  describe('loadAllPeriods()', () => {
    test('并行加载两个时段', async () => {
      await manager.loadAllPeriods();
      expect(manager._sunriseOverlay.loadAndRender).toHaveBeenCalled();
      expect(manager._sunsetOverlay.loadAndRender).toHaveBeenCalled();
    });

    test('加载完成后激活 sunset，隐藏 sunrise', async () => {
      await manager.loadAllPeriods();
      expect(manager._sunsetOverlay.show).toHaveBeenCalled();
      expect(manager._sunriseOverlay.hide).toHaveBeenCalled();
    });
  });

  // ─── getOverlay() ─────────────────────────────────────────────────────────

  describe('getOverlay()', () => {
    test('返回 sunrise 叠加层', () => {
      expect(manager.getOverlay('sunrise')).toBe(manager._sunriseOverlay);
    });

    test('返回 sunset 叠加层', () => {
      expect(manager.getOverlay('sunset')).toBe(manager._sunsetOverlay);
    });
  });

  // ─── getUpdatedAt() ───────────────────────────────────────────────────────

  describe('getUpdatedAt()', () => {
    test('委托给叠加层的 getUpdatedAt()', () => {
      const ts = manager.getUpdatedAt('sunset');
      expect(manager._sunsetOverlay.getUpdatedAt).toHaveBeenCalled();
      expect(ts).toBe('2026-03-21T07:00:00Z');
    });
  });

  // ─── getSpotCount() ───────────────────────────────────────────────────────

  describe('getSpotCount()', () => {
    test('返回当前栅格层可见格元数量', () => {
      manager._sunsetOverlay.getSpotCount.mockReturnValue(8);
      expect(manager.getSpotCount()).toBe(8);
    });
  });

  // ─── show/hide/toggle/clear ───────────────────────────────────────────────

  describe('show()', () => {
    test('显示当前激活叠加层（sunset）', () => {
      manager.show();
      expect(manager._sunsetOverlay.show).toHaveBeenCalled();
    });
  });

  describe('hide()', () => {
    test('隐藏所有叠加层', () => {
      manager.hide();
      expect(manager._sunriseOverlay.hide).toHaveBeenCalled();
      expect(manager._sunsetOverlay.hide).toHaveBeenCalled();
    });
  });

  describe('toggle()', () => {
    test('切换当前激活叠加层', () => {
      manager.toggle();
      expect(manager._sunsetOverlay.toggle).toHaveBeenCalled();
    });
  });

  describe('clear()', () => {
    test('调用两个叠加层的 clear()', () => {
      manager.clear();
      expect(manager._sunriseOverlay.clear).toHaveBeenCalled();
      expect(manager._sunsetOverlay.clear).toHaveBeenCalled();
    });
  });

  // ─── destroy() ────────────────────────────────────────────────────────────

  describe('destroy()', () => {
    test('调用两个叠加层的 destroy()', () => {
      const sunriseRef = manager._sunriseOverlay;
      const sunsetRef  = manager._sunsetOverlay;
      manager.destroy();
      expect(sunriseRef.destroy).toHaveBeenCalled();
      expect(sunsetRef.destroy).toHaveBeenCalled();
    });

    test('destroy() 后 map 引用置空', () => {
      manager.destroy();
      expect(manager._map).toBeNull();
    });
  });
});
