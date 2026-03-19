import { jest } from '@jest/globals';
import ChinaSpotsOverlay from '../../../src/services/ChinaSpotsOverlay.js';

describe('ChinaSpotsOverlay', () => {
  let overlay;
  let map;
  let container;

  beforeEach(() => {
    overlay = new ChinaSpotsOverlay();

    container = document.createElement('div');
    container.id = 'map-container';
    document.body.innerHTML = '';
    document.body.appendChild(container);

    map = {
      on: jest.fn(),
      getContainer: jest.fn(() => container),
      getSize: jest.fn(() => ({ x: 320, y: 240 })),
      getZoom: jest.fn(() => 6),
      latLngToContainerPoint: jest.fn(() => ({ x: 120, y: 90 })),
      hasLayer: jest.fn(() => false),
      removeLayer: jest.fn()
    };

    HTMLCanvasElement.prototype.getContext.mockImplementation(() => global.__canvasContext2DMock);
    Object.values(global.__canvasContext2DMock).forEach((fn) => {
      if (typeof fn === 'function' && 'mockClear' in fn) fn.mockClear();
    });

    global.__canvasContext2DMock.createRadialGradient.mockImplementation(() => ({
      addColorStop: jest.fn()
    }));

    window.L = {
      latLng: jest.fn((lat, lon) => ({ lat, lon }))
    };

    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('init 应创建 canvas + 开关按钮并绑定地图事件', () => {
    overlay.init(map);

    expect(map.on).toHaveBeenCalledWith('moveend zoomend resize', expect.any(Function));
    expect(map.on).toHaveBeenCalledWith('move', expect.any(Function));
    expect(container.querySelector('.china-spots-canvas')).not.toBeNull();
    expect(container.querySelector('.china-spots-toggle-btn')).not.toBeNull();
  });

  test('loadAndRender 应只保留中国大陆范围点并更新时间', async () => {
    overlay.init(map);
    const showSpy = jest.spyOn(overlay, 'show').mockImplementation(() => {});

    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        updatedAt: '2026-03-20T00:00:00.000Z',
        spots: [
          { lat: 39.9, lon: 116.4, score: 80 },
          { lat: 16.0, lon: 113.0, score: 88 },
          { lat: 31.2, lon: 121.5, score: 75 }
        ]
      })
    });

    await overlay.loadAndRender();

    expect(fetch).toHaveBeenCalledWith('/api/spots/china');
    expect(showSpy).toHaveBeenCalled();
    expect(overlay._spots).toHaveLength(2);
    expect(overlay.getUpdatedAt()).toBe('2026-03-20T00:00:00.000Z');
  });

  test('redraw 仅渲染 score>=60 的连续云层并使用径向渐变', () => {
    overlay.init(map);
    overlay._visible = true;
    overlay._spots = [
      { lat: 39.9, lon: 116.4, score: 55 },
      { lat: 31.2, lon: 121.5, score: 82 }
    ];

    overlay._redrawCanvas();

    expect(global.__canvasContext2DMock.createRadialGradient).toHaveBeenCalledTimes(1);
    expect(global.__canvasContext2DMock.arc).toHaveBeenCalledTimes(1);
    expect(global.__canvasContext2DMock.fill).toHaveBeenCalledTimes(1);
    expect(window.L.latLng).toHaveBeenCalledTimes(1);
  });

  test('_getRadiusPx 应随缩放变化且限制在安全区间', () => {
    expect(overlay._getRadiusPx(90, 3)).toBeGreaterThanOrEqual(52);
    expect(overlay._getRadiusPx(90, 15)).toBeLessThanOrEqual(190);

    const lowScoreRadius = overlay._getRadiusPx(62, 6);
    const highScoreRadius = overlay._getRadiusPx(88, 6);
    expect(highScoreRadius).toBeGreaterThan(lowScoreRadius);
  });
});
