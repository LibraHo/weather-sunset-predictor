/**
 * ChinaSpotsOverlayManager 单元测试（任务 64.8）
 */

import { jest } from '@jest/globals';
import ChinaSpotsOverlayManager from '../../../src/services/ChinaSpotsOverlayManager.js';

describe('ChinaSpotsOverlayManager', () => {
  let manager;
  let mockMap;
  let mockContainer;

  beforeEach(() => {
    // Mock Leaflet map
    mockMap = {
      getContainer: jest.fn(() => ({
        appendChild: jest.fn(),
        style: { position: '' }
      })),
      on: jest.fn(),
      getBounds: jest.fn(() => ({
        getSouth: () => 20,
        getNorth: () => 40,
        getWest: () => 105,
        getEast: () => 123
      })),
      getSize: jest.fn(() => ({ x: 600, y: 360 })),
      getZoom: jest.fn(() => 6),
      latLngToContainerPoint: jest.fn(() => ({ x: 120, y: 80 }))
    };

    window.L = {
      map: jest.fn(() => mockMap),
      latLng: jest.fn((lat, lon) => ({ lat, lon }))
    };

    // Mock container for tabs
    mockContainer = {
      firstChild: null,
      insertBefore: jest.fn(),
      appendChild: jest.fn(),
      remove: jest.fn()
    };

    document.body.appendChild = jest.fn();

    manager = new ChinaSpotsOverlayManager();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('初始化', () => {
    it('应该成功初始化管理器', () => {
      manager.init(mockMap, mockContainer);

      expect(manager._map).toBe(mockMap);
      expect(manager._sunriseOverlay).toBeTruthy();
      expect(manager._sunsetOverlay).toBeTruthy();
      expect(manager._tabContainer).toBeTruthy();
    });

    it('地图为空时应输出警告', () => {
      const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();

      manager.init(null, mockContainer);

      expect(consoleWarn).toHaveBeenCalledWith('[ChinaSpotsOverlayManager] 地图实例为空，无法初始化');

      consoleWarn.mockRestore();
    });

    it('默认激活时段应为 sunset', () => {
      manager.init(mockMap, mockContainer);

      expect(manager.getActivePeriod()).toBe('sunset');
    });
  });

  describe('Tab UI', () => {
    it('应该创建两个 tab 按钮（朝霞/晚霞）', () => {
      manager.init(mockMap, mockContainer);

      expect(Object.keys(manager._tabButtons)).toEqual(['sunrise', 'sunset']);
      expect(manager._tabButtons.sunrise).toBeTruthy();
      expect(manager._tabButtons.sunset).toBeTruthy();
    });

    it('tab 按钮应包含正确的文本', () => {
      manager.init(mockMap, mockContainer);

      expect(manager._tabButtons.sunrise.textContent).toContain('朝霞');
      expect(manager._tabButtons.sunset.textContent).toContain('晚霞');
    });

    it('点击 tab 应切换激活时段', () => {
      manager.init(mockMap, mockContainer);

      const activeOverlay = manager._getActiveOverlay();
      const hideSpy = jest.spyOn(activeOverlay, 'hide');

      manager._tabButtons.sunrise.click();

      expect(manager.getActivePeriod()).toBe('sunrise');
      expect(hideSpy).toHaveBeenCalled();
    });
  });

  describe('时段切换', () => {
    beforeEach(() => {
      manager.init(mockMap, mockContainer);
    });

    it('应该正确切换到 sunrise', () => {
      manager.switchPeriod('sunrise');

      expect(manager.getActivePeriod()).toBe('sunrise');
    });

    it('应该正确切换到 sunset', () => {
      manager.switchPeriod('sunrise');
      manager.switchPeriod('sunset');

      expect(manager.getActivePeriod()).toBe('sunset');
    });

    it('切换到相同时段不应触发操作', () => {
      const activeOverlay = manager._getActiveOverlay();
      const hideSpy = jest.spyOn(activeOverlay, 'hide');
      const showSpy = jest.spyOn(activeOverlay, 'show');

      manager.switchPeriod('sunset');

      expect(hideSpy).not.toHaveBeenCalled();
      expect(showSpy).not.toHaveBeenCalled();
    });

    it('不支持非法时段', () => {
      const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();

      manager.switchPeriod('noon');

      expect(consoleWarn).toHaveBeenCalledWith('[ChinaSpotsOverlayManager] 不支持的时段: noon');
      expect(manager.getActivePeriod()).toBe('sunset');

      consoleWarn.mockRestore();
    });
  });

  describe('叠加层获取', () => {
    beforeEach(() => {
      manager.init(mockMap, mockContainer);
    });

    it('getOverlay 应返回正确的叠加层实例', () => {
      const sunriseOverlay = manager.getOverlay('sunrise');
      const sunsetOverlay = manager.getOverlay('sunset');

      expect(sunriseOverlay).toBeTruthy();
      expect(sunsetOverlay).toBeTruthy();
      expect(sunriseOverlay).not.toBe(sunsetOverlay);
    });

    it('应正确返回当前激活的叠加层', () => {
      const activeOverlay = manager._getActiveOverlay();

      expect(activeOverlay).toBe(manager._sunsetOverlay);
    });
  });

  describe('显示/隐藏', () => {
    beforeEach(() => {
      manager.init(mockMap, mockContainer);
    });

    it('show 应显示激活的叠加层', () => {
      const activeOverlay = manager._getActiveOverlay();
      const showSpy = jest.spyOn(activeOverlay, 'show');

      manager.show();

      expect(showSpy).toHaveBeenCalled();
    });

    it('hide 应隐藏所有叠加层', () => {
      const sunriseHideSpy = jest.spyOn(manager._sunriseOverlay, 'hide');
      const sunsetHideSpy = jest.spyOn(manager._sunsetOverlay, 'hide');

      manager.hide();

      expect(sunriseHideSpy).toHaveBeenCalled();
      expect(sunsetHideSpy).toHaveBeenCalled();
    });

    it('toggle 应切换激活叠加层的显示状态', () => {
      const activeOverlay = manager._getActiveOverlay();
      const toggleSpy = jest.spyOn(activeOverlay, 'toggle');

      manager.toggle();

      expect(toggleSpy).toHaveBeenCalled();
    });

    it('runHealthCheck 检测异常后应触发自动修复', async () => {
      const activeOverlay = manager._getActiveOverlay();
      const inactiveOverlay = manager._getInactiveOverlay();

      jest.spyOn(activeOverlay, 'getRenderHealth')
        .mockReturnValueOnce({ ok: false, reason: 'canvas_hidden' })
        .mockReturnValueOnce({ ok: true, reason: 'ok' });

      const loadSpy = jest.spyOn(manager, 'loadAndRender').mockResolvedValue();
      const showSpy = jest.spyOn(activeOverlay, 'show');
      const hideSpy = jest.spyOn(inactiveOverlay, 'hide');

      await manager.runHealthCheck();

      expect(loadSpy).toHaveBeenCalledWith('sunset');
      expect(showSpy).toHaveBeenCalled();
      expect(hideSpy).toHaveBeenCalled();
    });
  });

  describe('清理', () => {
    beforeEach(() => {
      manager.init(mockMap, mockContainer);
    });

    it('clear 应清除所有叠加层并移除 tab', () => {
      manager.clear();

      expect(manager._sunriseOverlay).toBeTruthy();
      expect(manager._sunsetOverlay).toBeTruthy();
      expect(manager._tabContainer).toBeNull();
      expect(manager._tabButtons).toEqual({});
    });

    it('destroy 应释放所有资源', () => {
      manager.destroy();

      expect(manager._map).toBeNull();
      expect(manager._sunriseOverlay).toBeNull();
      expect(manager._sunsetOverlay).toBeNull();
    });
  });
});
