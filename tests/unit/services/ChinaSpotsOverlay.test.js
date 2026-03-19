import { jest } from '@jest/globals';
import ChinaSpotsOverlay from '../../../src/services/ChinaSpotsOverlay.js';

describe('ChinaSpotsOverlay', () => {
  let overlay;
  let map;
  let container;

  beforeEach(() => {
    document.body.innerHTML = '<div id="map"></div>';
    container = document.getElementById('map');
    container.style.width = '600px';
    container.style.height = '400px';

    global.fetch = jest.fn();

    const canvasCtx = {
      clearRect: jest.fn(),
      fillRect: jest.fn()
    };
    Object.defineProperty(global, '__canvasContext2DMock', {
      value: canvasCtx,
      writable: true,
      configurable: true
    });
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      writable: true,
      value: jest.fn(() => canvasCtx)
    });

    map = {
      on: jest.fn(),
      getContainer: jest.fn(() => container),
      getSize: jest.fn(() => ({ x: 600, y: 400 })),
      getZoom: jest.fn(() => 6),
      latLngToContainerPoint: jest.fn(([lat, lon]) => ({
        x: ((lon - 73) / (135 - 73)) * 600,
        y: ((54 - lat) / (54 - 18)) * 400
      })),
      containerPointToLatLng: jest.fn(([x, y]) => ({
        lat: 54 - (y / 400) * (54 - 18),
        lng: 73 + (x / 600) * (135 - 73)
      }))
    };

    overlay = new ChinaSpotsOverlay();
    overlay.init(map);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('init should inject canvas and toggle button', () => {
    expect(container.querySelector('.china-spots-canvas')).toBeTruthy();
    expect(container.querySelector('.china-spots-toggle-btn')).toBeTruthy();
    expect(map.on).toHaveBeenCalledWith('moveend zoomend resize', expect.any(Function));
    expect(map.on).toHaveBeenCalledWith('move', expect.any(Function));
  });

  test('loadAndRender should keep mainland spots and exclude taiwan bbox', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        updatedAt: '2026-03-20T00:00:00.000Z',
        spots: [
          { lat: 39.9, lon: 116.4, score: 86 }, // 北京
          { lat: 24.0, lon: 121.0, score: 88 }, // 台湾（应排除）
          { lat: 10.0, lon: 114.0, score: 90 }  // 南海（应排除）
        ]
      })
    });

    await overlay.loadAndRender();

    expect(overlay.getUpdatedAt()).toBe('2026-03-20T00:00:00.000Z');
    expect(overlay._spots).toHaveLength(1);
    expect(overlay._spots[0].lat).toBeCloseTo(39.9);
    expect(overlay._canvas.style.display).toBe('block');
  });

  test('show/hide should toggle canvas visibility', () => {
    overlay.show();
    expect(overlay._canvas.style.display).toBe('block');

    overlay.hide();
    expect(overlay._canvas.style.display).toBe('none');
  });

  test('redraw should paint continuous field with fillRect', () => {
    overlay._spots = [
      { lat: 39.9, lon: 116.4, score: 85 },
      { lat: 31.2, lon: 121.4, score: 75 }
    ];

    overlay.show();

    const ctx = global.__canvasContext2DMock;
    expect(ctx.clearRect).toHaveBeenCalled();
    expect(ctx.fillRect).toHaveBeenCalled();
  });
});
