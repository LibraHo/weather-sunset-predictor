/**
 * 任务 64.13 - ChinaRenderModeFlag 单元测试
 *
 * 验证 createChinaOverlayManager() 工厂函数行为。
 * 当前实现固定返回 ChinaRasterOverlayManager（Phase 16 决策）。
 */
import { jest } from '@jest/globals';

// 在导入任何 Leaflet 相关模块前，先给 window.L 打桩
global.window = global.window || {};
global.window.L = global.window.L || {
  latLng: (lat, lon) => ({ lat, lng: lon }),
  latLngBounds: (a, b) => ({ a, b }),
};

let createChinaOverlayManager;
let CHINA_RENDER_MODE_KEY;
let CHINA_RENDER_MODE_DEFAULT;

beforeAll(async () => {
  const wcMod = await import('../../../src/controllers/WeatherController.js');
  createChinaOverlayManager = wcMod.createChinaOverlayManager;
  CHINA_RENDER_MODE_KEY = wcMod.CHINA_RENDER_MODE_KEY;
  CHINA_RENDER_MODE_DEFAULT = wcMod.CHINA_RENDER_MODE_DEFAULT;
});

describe('createChinaOverlayManager() - feature flag 工厂', () => {
  beforeEach(() => {
    if (global.localStorage) global.localStorage.clear();
  });

  test('默认值（无 localStorage 键）→ 返回具备标准接口的对象', () => {
    const manager = createChinaOverlayManager();
    expect(manager).not.toBeNull();
    expect(typeof manager.init).toBe('function');
    expect(typeof manager.loadAllPeriods).toBe('function');
    expect(typeof manager.switchPeriod).toBe('function');
    expect(typeof manager.getActivePeriod).toBe('function');
    expect(typeof manager.getOverlay).toBe('function');
    expect(typeof manager.getSpotCount).toBe('function');
    expect(typeof manager.getUpdatedAt).toBe('function');
  });

  test('china_render_mode=raster → 返回有效对象', () => {
    global.localStorage.setItem(CHINA_RENDER_MODE_KEY, 'raster');
    const manager = createChinaOverlayManager();
    expect(manager).not.toBeNull();
    expect(typeof manager.init).toBe('function');
  });

  test('china_render_mode=spots → 仍返回有效对象（当前固定实现）', () => {
    global.localStorage.setItem(CHINA_RENDER_MODE_KEY, 'spots');
    const manager = createChinaOverlayManager();
    expect(manager).not.toBeNull();
    expect(typeof manager.init).toBe('function');
  });

  test('未知值回退到默认 raster → 返回有效对象', () => {
    global.localStorage.setItem(CHINA_RENDER_MODE_KEY, 'unknown_value');
    const manager = createChinaOverlayManager();
    expect(manager).not.toBeNull();
    expect(typeof manager.init).toBe('function');
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
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
  });

  test('返回的 Manager 具备标准接口方法', () => {
    const manager = createChinaOverlayManager();
    expect(typeof manager.init).toBe('function');
    expect(typeof manager.loadAllPeriods).toBe('function');
    expect(typeof manager.switchPeriod).toBe('function');
    expect(typeof manager.getActivePeriod).toBe('function');
    expect(typeof manager.getOverlay).toBe('function');
    expect(typeof manager.getSpotCount).toBe('function');
    expect(typeof manager.getUpdatedAt).toBe('function');
  });

  test('Manager.getSpotCount() 返回 0（栅格层无散点计数）', () => {
    const manager = createChinaOverlayManager();
    expect(manager.getSpotCount()).toBe(0);
  });

  test('spots 值改变不影响返回类型，始终返回有效对象', () => {
    global.localStorage.setItem(CHINA_RENDER_MODE_KEY, 'spots');
    const mgr1 = createChinaOverlayManager();
    expect(mgr1).not.toBeNull();
    expect(typeof mgr1.init).toBe('function');

    global.localStorage.setItem(CHINA_RENDER_MODE_KEY, 'raster');
    const mgr2 = createChinaOverlayManager();
    expect(mgr2).not.toBeNull();
    expect(typeof mgr2.init).toBe('function');
  });
});
