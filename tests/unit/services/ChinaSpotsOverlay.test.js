import { jest } from '@jest/globals';
import ChinaSpotsOverlay, {
  MAINLAND_RENDER_MIN_SCORE,
  mapScoreToOverlayStyle,
  isRenderableMainlandSpot
} from '../../../src/services/ChinaSpotsOverlay.js';

describe('ChinaSpotsOverlay helpers', () => {
  test('mapScoreToOverlayStyle: 分数越高半径越大，且包含外扩 halo 层', () => {
    const low = mapScoreToOverlayStyle(40, 5);
    const high = mapScoreToOverlayStyle(90, 5);

    expect(low.radiusPx).toBeGreaterThanOrEqual(42);
    expect(high.radiusPx).toBeGreaterThan(low.radiusPx);
    expect(low.haloRadiusPx).toBeGreaterThan(low.radiusPx);
    expect(high.haloRadiusPx).toBeGreaterThan(high.radiusPx);
    expect(typeof low.haloColor).toBe('string');
    expect(typeof high.midColor).toBe('string');
  });

  test('mapScoreToOverlayStyle: 缩放越高半径越大', () => {
    const z4 = mapScoreToOverlayStyle(75, 4);
    const z8 = mapScoreToOverlayStyle(75, 8);
    expect(z8.radiusPx).toBeGreaterThan(z4.radiusPx);
    expect(z8.haloRadiusPx).toBeGreaterThan(z4.haloRadiusPx);
  });

  test('isRenderableMainlandSpot: 仅保留大陆有效点', () => {
    expect(
      isRenderableMainlandSpot({ lat: 39.9, lon: 116.4, score: MAINLAND_RENDER_MIN_SCORE })
    ).toBe(true);

    expect(
      isRenderableMainlandSpot({ lat: 25.03, lon: 121.56, score: 85 })
    ).toBe(false); // 台湾

    expect(
      isRenderableMainlandSpot({ lat: 10, lon: 114, score: 80 })
    ).toBe(false); // 南海远海

    expect(
      isRenderableMainlandSpot({ lat: 39.9, lon: 116.4, score: 20 })
    ).toBe(false); // 分数过低
  });
});

describe('ChinaSpotsOverlay integration', () => {
  let overlay;
  let mockCtx;
  let mapContainer;
  let map;

  beforeEach(() => {
    document.body.innerHTML = '';

    mockCtx = {
      clearRect: jest.fn(),
      beginPath: jest.fn(),
      arc: jest.fn(),
      fill: jest.fn(),
      createRadialGradient: jest.fn(() => ({ addColorStop: jest.fn() })),
      globalCompositeOperation: 'source-over',
      fillStyle: ''
    };

    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(mockCtx);

    mapContainer = document.createElement('div');
    document.body.appendChild(mapContainer);

    map = {
      on: jest.fn(),
      getContainer: jest.fn(() => mapContainer),
      getSize: jest.fn(() => ({ x: 600, y: 360 })),
      getZoom: jest.fn(() => 6),
      latLngToContainerPoint: jest.fn(() => ({ x: 120, y: 80 }))
    };

    window.L = {
      latLng: jest.fn((lat, lon) => ({ lat, lon }))
    };

    overlay = new ChinaSpotsOverlay();
    overlay.init(map);

    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('loadAndRender: 只加载并渲染中国大陆可用点位', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        updatedAt: '2026-03-20T01:00:00.000Z',
        spots: [
          { lat: 39.9, lon: 116.4, score: 82 }, // 大陆
          { lat: 25.03, lon: 121.56, score: 88 }, // 台湾（应过滤）
          { lat: 31.2, lon: 121.5, score: 35 } // 低分（应过滤）
        ]
      })
    });

    await overlay.loadAndRender();

    expect(fetch).toHaveBeenCalledWith('/api/spots/china');
    expect(overlay._spots).toHaveLength(1);
    expect(overlay._spots[0]).toEqual(expect.objectContaining({ lat: 39.9, lon: 116.4 }));
    expect(overlay._visible).toBe(true);
    expect(overlay.getUpdatedAt()).toBe('2026-03-20T01:00:00.000Z');
  });

  test('show 后 _redrawCanvas: 每个点绘制 halo + 主体两层径向渐变', () => {
    overlay._spots = [{ lat: 39.9, lon: 116.4, score: 85 }];

    overlay.show();

    expect(mockCtx.createRadialGradient).toHaveBeenCalledTimes(2);
    expect(mockCtx.arc).toHaveBeenCalledTimes(2);
    expect(mockCtx.fill).toHaveBeenCalledTimes(2);
    expect(mockCtx.clearRect).toHaveBeenCalled();
    expect(mockCtx.globalCompositeOperation).toBe('source-over');
  });
});
