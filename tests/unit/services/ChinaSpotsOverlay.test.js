import {
  MAINLAND_RENDER_MIN_SCORE,
  mapScoreToOverlayStyle,
  isRenderableMainlandSpot
} from '../../../src/services/ChinaSpotsOverlay.js';

describe('ChinaSpotsOverlay helpers', () => {
  test('mapScoreToOverlayStyle: 分数越高半径越大', () => {
    const low = mapScoreToOverlayStyle(40, 5);
    const high = mapScoreToOverlayStyle(90, 5);

    expect(low.radiusPx).toBeGreaterThanOrEqual(42);
    expect(high.radiusPx).toBeGreaterThan(low.radiusPx);
    expect(typeof low.innerColor).toBe('string');
    expect(typeof high.midColor).toBe('string');
  });

  test('mapScoreToOverlayStyle: 缩放越高半径越大', () => {
    const z4 = mapScoreToOverlayStyle(75, 4);
    const z8 = mapScoreToOverlayStyle(75, 8);
    expect(z8.radiusPx).toBeGreaterThan(z4.radiusPx);
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
