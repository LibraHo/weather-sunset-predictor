import { jest } from '@jest/globals';
import ChinaSpotsOverlay, {
  MAINLAND_RENDER_MIN_SCORE,
  mapScoreToOverlayStyle,
  normalizeOverlayScore,
  isRenderableMainlandSpot,
  isSpotInViewport,
  getCanvasFilterStyle,
  getOverlayBlendMode,
  getDensityOpacityFactor,
  getMainlandEdgeOpacityFactor,
  getPlumeDriftOffset,
  normalizeSpotsPeriod
} from '../../../src/services/ChinaSpotsOverlay.js';

function rgbaAlpha(rgba) {
  const match = /,\s*([0-9.]+)\)$/.exec(rgba);
  return match ? Number(match[1]) : NaN;
}

describe('ChinaSpotsOverlay helpers', () => {
  test('mapScoreToOverlayStyle: 分数越高半径越大，且包含外扩 halo 层', () => {
    const low = mapScoreToOverlayStyle(40, 5);
    const high = mapScoreToOverlayStyle(90, 5);

    expect(low.radiusPx).toBeGreaterThanOrEqual(42);
    expect(high.radiusPx).toBeGreaterThan(low.radiusPx);
    expect(low.haloRadiusPx).toBeGreaterThan(low.radiusPx);
    expect(high.haloRadiusPx).toBeGreaterThan(high.radiusPx);
    expect(low.plumeRadiusPx).toBeGreaterThan(low.radiusPx);
    expect(typeof low.haloColor).toBe('string');
    expect(typeof low.plumeColor).toBe('string');
    expect(typeof high.midColor).toBe('string');
  });

  test('mapScoreToOverlayStyle: 缩放越高半径越大', () => {
    const z4 = mapScoreToOverlayStyle(75, 4);
    const z8 = mapScoreToOverlayStyle(75, 8);
    expect(z8.radiusPx).toBeGreaterThan(z4.radiusPx);
    expect(z8.haloRadiusPx).toBeGreaterThan(z4.haloRadiusPx);
  });

  test('mapScoreToOverlayStyle: 高缩放下透明度自动衰减，避免高亮过曝', () => {
    const z4 = mapScoreToOverlayStyle(85, 4);
    const z10 = mapScoreToOverlayStyle(85, 10);

    expect(rgbaAlpha(z10.innerColor)).toBeLessThan(rgbaAlpha(z4.innerColor));
    expect(rgbaAlpha(z10.haloColor)).toBeLessThan(rgbaAlpha(z4.haloColor));
  });

  test('getPlumeDriftOffset: 分值/缩放越高，顺风偏移越明显（降低同心圆感）', () => {
    const low = getPlumeDriftOffset(45, 5);
    const high = getPlumeDriftOffset(90, 5);
    const zoomed = getPlumeDriftOffset(90, 9);

    expect(low.x).toBeGreaterThan(0);
    expect(low.y).toBeLessThan(0);
    expect(high.x).toBeGreaterThan(low.x);
    expect(zoomed.x).toBeGreaterThan(high.x);
  });

  test('getCanvasFilterStyle: 低缩放更强平滑，高缩放降低模糊', () => {
    expect(getCanvasFilterStyle(4)).toContain('blur(6.4px)');
    expect(getCanvasFilterStyle(10)).toContain('blur(3.4px)');
  });

  test('getOverlayBlendMode: 低缩放使用 screen 连续混合，高缩放回到 lighter', () => {
    expect(getOverlayBlendMode(4)).toBe('screen');
    expect(getOverlayBlendMode(6)).toBe('screen');
    expect(getOverlayBlendMode(7)).toBe('lighter');
  });

  test('getDensityOpacityFactor: 视窗点位越密集，透明度因子越低（防过曝）', () => {
    const sparse = getDensityOpacityFactor(2, 5);
    const dense = getDensityOpacityFactor(36, 5);

    expect(sparse).toBeGreaterThan(dense);
    expect(dense).toBeGreaterThanOrEqual(0.72);
    expect(sparse).toBeLessThanOrEqual(1.08);
  });

  test('mapScoreToOverlayStyle: 密集点位下透明度更保守', () => {
    const sparse = mapScoreToOverlayStyle(88, 5, getDensityOpacityFactor(2, 5));
    const dense = mapScoreToOverlayStyle(88, 5, getDensityOpacityFactor(40, 5));

    expect(rgbaAlpha(dense.innerColor)).toBeLessThan(rgbaAlpha(sparse.innerColor));
    expect(rgbaAlpha(dense.haloColor)).toBeLessThan(rgbaAlpha(sparse.haloColor));
  });

  test('getMainlandEdgeOpacityFactor: 靠近大陆边界时透明度因子更低（边缘羽化）', () => {
    const center = getMainlandEdgeOpacityFactor({ lat: 35, lon: 110 }, 5);
    const edge = getMainlandEdgeOpacityFactor({ lat: 20.1, lon: 110 }, 5);

    expect(center).toBeGreaterThan(edge);
    expect(edge).toBeGreaterThanOrEqual(0.66);
    expect(center).toBeLessThanOrEqual(1);
  });

  test('mapScoreToOverlayStyle: 边缘羽化会降低颜色 alpha，避免大陆边界突兀', () => {
    const centerFactor = getMainlandEdgeOpacityFactor({ lat: 35, lon: 110 }, 5);
    const edgeFactor = getMainlandEdgeOpacityFactor({ lat: 20.1, lon: 110 }, 5);

    const centerStyle = mapScoreToOverlayStyle(88, 5, centerFactor);
    const edgeStyle = mapScoreToOverlayStyle(88, 5, edgeFactor);

    expect(rgbaAlpha(edgeStyle.innerColor)).toBeLessThan(rgbaAlpha(centerStyle.innerColor));
    expect(rgbaAlpha(edgeStyle.haloColor)).toBeLessThan(rgbaAlpha(centerStyle.haloColor));
  });

  test('normalizeOverlayScore: 对低分更保守，映射在 0~1 区间', () => {
    const s40 = normalizeOverlayScore(40);
    const s65 = normalizeOverlayScore(65);
    const s90 = normalizeOverlayScore(90);

    expect(s40).toBeGreaterThanOrEqual(0);
    expect(s90).toBeLessThanOrEqual(1);
    expect(s65).toBeGreaterThan(s40);
    expect(s90).toBeGreaterThan(s65);
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

  test('isSpotInViewport: 仅渲染当前视窗（带缓冲）范围内点位', () => {
    const viewport = { latMin: 25, latMax: 40, lonMin: 100, lonMax: 122 };

    expect(isSpotInViewport({ lat: 31.2, lon: 121.5 }, viewport)).toBe(true);
    expect(isSpotInViewport({ lat: 24.9, lon: 121.5 }, viewport)).toBe(false);
    expect(isSpotInViewport({ lat: 31.2, lon: 122.1 }, viewport)).toBe(false);
  });

  test('normalizeSpotsPeriod: 仅允许 sunrise/sunset，非法值回落 sunset', () => {
    expect(normalizeSpotsPeriod('sunrise')).toBe('sunrise');
    expect(normalizeSpotsPeriod('sunset')).toBe('sunset');
    expect(normalizeSpotsPeriod('NOON')).toBe('sunset');
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
      getBounds: jest.fn(() => ({
        getSouth: () => 20,
        getNorth: () => 40,
        getWest: () => 105,
        getEast: () => 123
      })),
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

    expect(fetch).toHaveBeenCalledWith('/api/spots/china?period=sunset');
    expect(overlay._spots).toHaveLength(1);
    expect(overlay.getSpotCount()).toBe(1);
    expect(overlay._spots[0]).toEqual(expect.objectContaining({ lat: 39.9, lon: 116.4 }));
    expect(overlay._visible).toBe(true);
    expect(overlay.getUpdatedAt()).toBe('2026-03-20T01:00:00.000Z');
  });

  test('loadAndRender: 无可渲染大陆点位时隐藏连续图层（供外部显示空态文案）', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        updatedAt: '2026-03-20T01:00:00.000Z',
        spots: [
          { lat: 25.03, lon: 121.56, score: 88 },
          { lat: 31.2, lon: 121.5, score: 35 }
        ]
      })
    });

    await overlay.loadAndRender();

    expect(overlay.getSpotCount()).toBe(0);
    expect(overlay._visible).toBe(false);
    expect(overlay._button.style.display).toBe('none');
  });

  test('setPeriod + loadAndRender: 支持朝/晚独立接口参数', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ updatedAt: '2026-03-20T02:00:00.000Z', spots: [] })
    });

    overlay.setPeriod('sunrise');
    await overlay.loadAndRender();

    expect(overlay.getPeriod()).toBe('sunrise');
    expect(fetch).toHaveBeenCalledWith('/api/spots/china?period=sunrise');
  });

  test('setButtonVisible: 可由外部控制按钮显隐（支持双 Overlay 切换）', () => {
    overlay.setButtonVisible(true);
    expect(overlay._button.style.display).toBe('inline-flex');

    overlay.setButtonVisible(false);
    expect(overlay._button.style.display).toBe('none');
  });

  test('show 后 _redrawCanvas: 每个点绘制 plume + halo + 主体三层渐变', () => {
    overlay._spots = [{ lat: 39.9, lon: 116.4, score: 85 }];

    overlay.show();

    expect(mockCtx.createRadialGradient).toHaveBeenCalledTimes(3);
    expect(mockCtx.arc).toHaveBeenCalledTimes(3);
    expect(mockCtx.fill).toHaveBeenCalledTimes(3);
    expect(mockCtx.clearRect).toHaveBeenCalled();
    expect(overlay._canvas.style.filter).toBe(getCanvasFilterStyle(6));
    expect(mockCtx.globalCompositeOperation).toBe('source-over');
  });

  test('show 后 _redrawCanvas: 视窗外点位不参与绘制，降低无效渲染开销', () => {
    overlay._spots = [
      { lat: 39.9, lon: 116.4, score: 85 }, // 视窗内
      { lat: 58, lon: 125, score: 90 } // 视窗外
    ];

    overlay.show();

    expect(map.latLngToContainerPoint).toHaveBeenCalledTimes(1);
    expect(mockCtx.createRadialGradient).toHaveBeenCalledTimes(3);
  });

  test('getRenderHealth: 有点位且已渲染时返回健康', () => {
    overlay._spots = [{ lat: 39.9, lon: 116.4, score: 85 }];
    overlay.show();

    const health = overlay.getRenderHealth();
    expect(health.ok).toBe(true);
    expect(health.reason).toBe('ok');
  });

  test('getRenderHealth: 有点位但隐藏时返回异常原因', () => {
    overlay._spots = [{ lat: 39.9, lon: 116.4, score: 85 }];
    overlay.hide();

    const health = overlay.getRenderHealth();
    expect(health.ok).toBe(false);
    expect(health.reason).toBe('overlay_hidden');
  });

});
