import { jest } from '@jest/globals';
import ChinaSpotsOverlay from '../../../src/services/ChinaSpotsOverlay.js';

describe('ChinaSpotsOverlay', () => {
  let overlay;
  let mapMock;
  let container;

  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
    container = document.createElement('div');
    container.style.width = '400px';
    container.style.height = '300px';
    document.getElementById('root').appendChild(container);

    const ctx = global.__canvasContext2DMock || {
      clearRect: jest.fn(),
      fillRect: jest.fn(),
      beginPath: jest.fn(),
      arc: jest.fn(),
      fill: jest.fn()
    };
    global.__canvasContext2DMock = ctx;
    ctx.clearRect.mockClear?.();
    ctx.fillRect.mockClear?.();
    ctx.beginPath.mockClear?.();
    ctx.arc.mockClear?.();
    ctx.fill.mockClear?.();
    ctx.drawImage = jest.fn();
    ctx.save = jest.fn();
    ctx.restore = jest.fn();

    if (typeof HTMLCanvasElement !== 'undefined') {
      HTMLCanvasElement.prototype.getContext = jest.fn(() => ctx);
    }

    mapMock = {
      on: jest.fn(),
      getContainer: jest.fn(() => container),
      getSize: jest.fn(() => ({ x: 400, y: 300 })),
      getZoom: jest.fn(() => 5),
      latLngToContainerPoint: jest.fn(({ lat, lon }) => ({
        x: (lon - 70) * 6,
        y: (55 - lat) * 6
      }))
    };

    window.L = {
      latLng: (lat, lon) => ({ lat, lon })
    };

    global.fetch = jest.fn();
    overlay = new ChinaSpotsOverlay();
    overlay.init(mapMock);
  });

  test('init 应创建 canvas 和切换按钮，并绑定地图事件', () => {
    const canvas = container.querySelector('canvas.china-spots-canvas');
    const button = container.querySelector('button.china-spots-toggle-btn');

    expect(canvas).toBeTruthy();
    expect(button).toBeTruthy();
    expect(mapMock.on).toHaveBeenCalledWith('moveend zoomend resize', expect.any(Function));
    expect(mapMock.on).toHaveBeenCalledWith('move', expect.any(Function));
  });

  test('loadAndRender 应过滤非中国大陆点并渲染连续图层', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        updatedAt: '2026-03-20T00:00:00Z',
        spots: [
          { lat: 39.9, lon: 116.4, score: 88 },
          { lat: 31.2, lon: 121.5, score: 76 },
          { lat: 10, lon: 114, score: 95 }, // 非中国大陆粗边界，应被过滤
          { lat: 34, lon: 140, score: 82 }  // 非中国大陆粗边界，应被过滤
        ]
      })
    });

    await overlay.loadAndRender();

    expect(fetch).toHaveBeenCalledWith('/api/spots/china');
    expect(overlay._spots).toHaveLength(2);
    expect(overlay._visible).toBe(true);
    expect(overlay._canvas.style.display).toBe('block');
    expect(global.__canvasContext2DMock.fillRect).toHaveBeenCalled();
    expect(overlay.getUpdatedAt()).toBe('2026-03-20T00:00:00Z');
  });

  test('无有效点位时应清空并隐藏图层', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ updatedAt: null, spots: [] })
    });

    await overlay.loadAndRender();

    expect(overlay._spots).toHaveLength(0);
    expect(overlay._visible).toBe(false);
    expect(overlay._canvas.style.display).toBe('none');
  });

  test('toggle 应在 show/hide 间切换', () => {
    overlay.show();
    expect(overlay._visible).toBe(true);

    overlay.toggle();
    expect(overlay._visible).toBe(false);

    overlay.toggle();
    expect(overlay._visible).toBe(true);
  });
});
