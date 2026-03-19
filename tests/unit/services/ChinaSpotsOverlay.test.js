import { jest } from '@jest/globals';
import ChinaSpotsOverlay from '../../../src/services/ChinaSpotsOverlay.js';

const createMapMock = () => {
  const container = document.createElement('div');
  document.body.appendChild(container);

  return {
    getContainer: jest.fn(() => container),
    on: jest.fn(),
    getSize: jest.fn(() => ({ x: 400, y: 300 })),
    latLngToContainerPoint: jest.fn((latLng) => ({
      x: latLng.lng * 2,
      y: latLng.lat * 2
    })),
    getZoom: jest.fn(() => 5)
  };
};

describe('ChinaSpotsOverlay', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    global.fetch = jest.fn();
    window.L = {
      latLng: (lat, lon) => ({ lat, lng: lon })
    };
  });

  afterEach(() => {
    delete window.L;
    delete global.fetch;
  });

  it('应过滤非中国大陆点位（含台湾 bbox）', async () => {
    const map = createMapMock();
    const overlay = new ChinaSpotsOverlay();
    overlay.init(map);

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        updatedAt: '2026-03-20T00:00:00.000Z',
        spots: [
          { lat: 39.9, lon: 116.4, score: 88 }, // 北京，保留
          { lat: 25.0, lon: 121.5, score: 92 }, // 台湾，排除
          { lat: 10.0, lon: 100.0, score: 75 }  // 越界，排除
        ]
      })
    });

    await overlay.loadAndRender();

    expect(overlay.getSpotCount()).toBe(1);
    expect(overlay.getUpdatedAt()).toBe('2026-03-20T00:00:00.000Z');

    const canvas = document.querySelector('.china-spots-canvas');
    expect(canvas.style.display).toBe('block');
  });

  it('当大陆范围无可用点时应隐藏图层', async () => {
    const map = createMapMock();
    const overlay = new ChinaSpotsOverlay();
    overlay.init(map);

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        updatedAt: '2026-03-20T00:00:00.000Z',
        spots: [
          { lat: 25.0, lon: 121.5, score: 92 }
        ]
      })
    });

    await overlay.loadAndRender();

    expect(overlay.getSpotCount()).toBe(0);
    const canvas = document.querySelector('.china-spots-canvas');
    expect(canvas.style.display).toBe('none');
  });

  it('大陆判定边界应符合预期', () => {
    const overlay = new ChinaSpotsOverlay();

    expect(overlay._isMainlandChinaSpot({ lat: 31.2, lon: 121.4 })).toBe(true); // 上海
    expect(overlay._isMainlandChinaSpot({ lat: 24.2, lon: 121.0 })).toBe(false); // 台湾 bbox
    expect(overlay._isMainlandChinaSpot({ lat: 17.9, lon: 110.3 })).toBe(false); // 南界外
    expect(overlay._isMainlandChinaSpot({ lat: 39.9, lon: 71.9 })).toBe(false);  // 西界外
  });
});
