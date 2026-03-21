/**
 * 任务 64.13 - ChinaRenderModeFlag 单元测试
 *
 * 验证 createChinaOverlayManager() feature flag 工厂函数
 * 在不同 localStorage 值下返回正确的 Manager 类型。
 */
import { jest } from '@jest/globals';

// ─── Mock Leaflet + canvas (JSDOM 环境不支持) ────────────────────────────────
jest.mock('../../../src/services/ChinaRasterOverlay.js', () => {
  return {
    default: class MockChinaRasterOverlay {
      init() {}
      hide() {}
      show() {}
      loadAndRender() { return Promise.resolve(); }
      getSpotCount() { return 0; }
      getUpdatedAt() { return null; }
      destroy() {}
      toggle() {}
      clear() {}
    }
  };
});

jest.mock('../../../src/services/ChinaSpotsOverlay.js', () => {
  return {
    default: class MockChinaSpotsOverlay {
      init() {}
      hide() {}
      show() {}
      loadAndRender() { return Promise.resolve(); }
      getSpotCount() { return 5; }
      getUpdatedAt() { return null; }
      destroy() {}
      toggle() {}
      clear() {}
    }
  };
});

// ─── JSDOM localStorage stub ──────────────────────────────────────────────────
let _store = {};
global.localStorage = {
  getItem: (k) => _store[k] ?? null,
  setItem: (k, v) => { _store[k] = String(v); },
  removeItem: (k) => { delete _store[k]; },
  clear: () => { _store = {}; }
};

import {
  createChinaOverlayManager,
  CHINA_RENDER_MODE_KEY,
  CHINA_RENDER_MODE_DEFAULT
} from '../../../src/controllers/WeatherController.js';

import ChinaRasterOverlayManager from '../../../src/services/ChinaRasterOverlayManager.js';
import ChinaSpotsOverlayManager from '../../../src/services/ChinaSpotsOverlayManager.js';

describe('createChinaOverlayManager() - feature flag 工厂', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('默认值（无 localStorage 键）→ 返回 ChinaRasterOverlayManager', () => {
    const manager = createChinaOverlayManager();
    expect(manager).toBeInstanceOf(ChinaRasterOverlayManager);
  });

  test('china_render_mode=raster → 返回 ChinaRasterOverlayManager', () => {
    localStorage.setItem(CHINA_RENDER_MODE_KEY, 'raster');
    const manager = createChinaOverlayManager();
    expect(manager).toBeInstanceOf(ChinaRasterOverlayManager);
  });

  test('china_render_mode=spots → 返回 ChinaSpotsOverlayManager', () => {
    localStorage.setItem(CHINA_RENDER_MODE_KEY, 'spots');
    const manager = createChinaOverlayManager();
    expect(manager).toBeInstanceOf(ChinaSpotsOverlayManager);
  });

  test('未知值回退到默认 raster → 返回 ChinaRasterOverlayManager', () => {
    localStorage.setItem(CHINA_RENDER_MODE_KEY, 'unknown_value');
    // 未知值不等于 'spots'，走 raster 分支
    const manager = createChinaOverlayManager();
    expect(manager).toBeInstanceOf(ChinaRasterOverlayManager);
  });

  test('CHINA_RENDER_MODE_KEY 常量值为 "china_render_mode"', () => {
    expect(CHINA_RENDER_MODE_KEY).toBe('china_render_mode');
  });

  test('CHINA_RENDER_MODE_DEFAULT 常量值为 "raster"', () => {
    expect(CHINA_RENDER_MODE_DEFAULT).toBe('raster');
  });

  test('每次调用返回新实例（无单例缓存）', () => {
    const a = createChinaOverlayManager();
    const b = createChinaOverlayManager();
    expect(a).not.toBe(b);
    expect(a).toBeInstanceOf(ChinaRasterOverlayManager);
    expect(b).toBeInstanceOf(ChinaRasterOverlayManager);
  });

  test('spots 模式下返回的 Manager 具备标准接口方法', () => {
    localStorage.setItem(CHINA_RENDER_MODE_KEY, 'spots');
    const manager = createChinaOverlayManager();
    expect(typeof manager.init).toBe('function');
    expect(typeof manager.loadAllPeriods).toBe('function');
    expect(typeof manager.switchPeriod).toBe('function');
    expect(typeof manager.getActivePeriod).toBe('function');
    expect(typeof manager.getOverlay).toBe('function');
    expect(typeof manager.getSpotCount).toBe('function');
    expect(typeof manager.getUpdatedAt).toBe('function');
  });

  test('raster 模式下返回的 Manager 具备标准接口方法', () => {
    const manager = createChinaOverlayManager();
    expect(typeof manager.init).toBe('function');
    expect(typeof manager.loadAllPeriods).toBe('function');
    expect(typeof manager.switchPeriod).toBe('function');
    expect(typeof manager.getActivePeriod).toBe('function');
    expect(typeof manager.getOverlay).toBe('function');
    expect(typeof manager.getSpotCount).toBe('function');
    expect(typeof manager.getUpdatedAt).toBe('function');
  });

  test('raster Manager.getSpotCount() 返回 0（栅格层无散点计数）', () => {
    const manager = createChinaOverlayManager();
    expect(manager.getSpotCount()).toBe(0);
  });

  test('spots 模式切换回 raster 后工厂返回正确类型', () => {
    localStorage.setItem(CHINA_RENDER_MODE_KEY, 'spots');
    expect(createChinaOverlayManager()).toBeInstanceOf(ChinaSpotsOverlayManager);

    localStorage.setItem(CHINA_RENDER_MODE_KEY, 'raster');
    expect(createChinaOverlayManager()).toBeInstanceOf(ChinaRasterOverlayManager);
  });
});
