import { jest } from '@jest/globals';
import { RADAR_FIELD_GEOMETRY, buildRadarCloudGradients, buildRadarCloudImageData, normalizeRadarDirections, paintRadarCloudCanvas, paintRadarCloudCanvas2d } from '../../../miniprogram/utils/radar-cloud-field.js';

const directions = [
  { direction: 'N', highCloud: 62, midCloud: 44, lowCloud: 12 },
  { direction: 'NE', highCloud: 68, midCloud: 48, lowCloud: 10 },
  { direction: 'E', highCloud: 58, midCloud: 39, lowCloud: 18 },
  { direction: 'SE', highCloud: 52, midCloud: 34, lowCloud: 24 },
  { direction: 'S', highCloud: 49, midCloud: 30, lowCloud: 28 },
  { direction: 'SW', highCloud: 74, midCloud: 36, lowCloud: 8 },
  { direction: 'W', highCloud: 76, midCloud: 36, lowCloud: 8 },
  { direction: 'NW', highCloud: 69, midCloud: 38, lowCloud: 12 }
];
const ORDER_FOR_TEST = directions.map((item) => item.direction);

describe('miniprogram radar cloud field renderer', () => {
  test('keeps the same cloud ring geometry as the website RadarCompass', () => {
    expect(RADAR_FIELD_GEOMETRY).toMatchObject({
      lowInnerRatio: 0.11,
      lowRatio: 0.20,
      midRatio: 0.32,
      highRatio: 0.42,
      axisRadiusRatio: 0.4368,
      ringDiameters: {
        lowInner: 22,
        low: 40,
        mid: 64,
        high: 84
      },
      labelPositions: {
        high: { left: 37.3, top: 15.2 },
        mid: { left: 41.1, top: 25.6 },
        low: { left: 44.7, top: 35.4 }
      }
    });

    expect(RADAR_FIELD_GEOMETRY.layers.low).toMatchObject({
      innerScale: 1.02,
      outerScale: 0.96,
      fadeScale: 0.34,
      alphaMax: 0.90,
      gamma: 1.20,
      edgeCut: 0.18
    });
    expect(RADAR_FIELD_GEOMETRY.layers.mid).toMatchObject({
      innerScale: 1.03,
      outerScale: 0.98,
      fadeScale: 0.34,
      alphaMax: 0.82,
      gamma: 1.12,
      edgeCut: 0.20
    });
    expect(RADAR_FIELD_GEOMETRY.layers.high).toMatchObject({
      innerScale: 1.02,
      outerScale: 0.97,
      fadeScale: 0.38,
      alphaMax: 0.66,
      gamma: 1.05,
      edgeCut: 0.24
    });
  });

  test('normalizes directions in the same compass order as the website radar', () => {
    const normalized = normalizeRadarDirections([directions[6], directions[0], directions[2]]);

    expect(normalized.map((item) => item.direction)).toEqual(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']);
    expect(normalized[0]).toMatchObject({ high: 62, mid: 44, low: 12 });
    expect(normalized[2]).toMatchObject({ high: 58, mid: 39, low: 18 });
    expect(normalized[6]).toMatchObject({ high: 76, mid: 36, low: 8 });
  });

  test('builds a non-empty pixel cloud field instead of discrete blob geometry', () => {
    const image = buildRadarCloudImageData(directions, 96);
    const alphaValues = [];

    for (let index = 3; index < image.data.length; index += 4) {
      alphaValues.push(image.data[index]);
    }

    expect(image).toMatchObject({ width: 96, height: 96 });
    expect(image.data).toBeInstanceOf(Uint8ClampedArray);
    expect(image.data.length).toBe(96 * 96 * 4);
    expect(Math.max(...alphaValues)).toBeGreaterThan(20);
    expect(alphaValues.filter((value) => value > 0).length).toBeGreaterThan(800);
  });

  test('keeps cloud colors neutral enough for the warm radar card', () => {
    const heavyHighCloud = ORDER_FOR_TEST.map((direction) => ({ direction, highCloud: 100, midCloud: 0, lowCloud: 0 }));
    const image = buildRadarCloudImageData(heavyHighCloud, 96);
    const topOuterRingIndex = (12 * 96 + 48) * 4;

    expect(image.data[topOuterRingIndex + 3]).toBeGreaterThan(40);
    expect(image.data[topOuterRingIndex + 2] - image.data[topOuterRingIndex]).toBeLessThanOrEqual(28);
    expect(image.data[topOuterRingIndex + 1] - image.data[topOuterRingIndex]).toBeLessThanOrEqual(18);
  });

  test('keeps high cloud visible after compositing on the white radar card', () => {
    const lightHighCloud = ORDER_FOR_TEST.map((direction) => ({ direction, highCloud: 60, midCloud: 35, lowCloud: 8 }));
    const image = buildRadarCloudImageData(lightHighCloud, 300);
    const topHighCloudIndex = (40 * 300 + 150) * 4;
    const alpha = image.data[topHighCloudIndex + 3] / 255;
    const compositeRed = Math.round(image.data[topHighCloudIndex] * alpha + 255 * (1 - alpha));

    expect(image.data[topHighCloudIndex + 3]).toBeGreaterThanOrEqual(30);
    expect(compositeRed).toBeLessThanOrEqual(230);
  });

  test('builds separate high mid low cloud gradients for the radar rings', () => {
    const gradients = buildRadarCloudGradients(directions);

    expect(Object.keys(gradients).sort()).toEqual(['high', 'low', 'mid']);
    expect(gradients.high).toContain('conic-gradient');
    expect(gradients.mid).toContain('conic-gradient');
    expect(gradients.low).toContain('conic-gradient');
    expect(gradients.high).not.toBe(gradients.mid);
    expect(gradients.mid).not.toBe(gradients.low);
  });

  test('paints the generated image data to the requested miniprogram canvas', () => {
    const canvasPutImageData = jest.fn();

    const painted = paintRadarCloudCanvas('resultRadarCloudField', directions, { wxApi: { canvasPutImageData } }, 64);

    expect(painted).toBe(true);
    expect(canvasPutImageData).toHaveBeenCalledWith(expect.objectContaining({
      canvasId: 'resultRadarCloudField',
      x: 0,
      y: 0,
      width: 64,
      height: 64,
      data: expect.any(Uint8ClampedArray)
    }));
  });

  test('prefers the official Canvas 2D node renderer over legacy canvasPutImageData', () => {
    const putImageData = jest.fn();
    const clearRect = jest.fn();
    const createImageData = jest.fn((width, height) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) }));
    const canvas = {
      width: 0,
      height: 0,
      getContext: jest.fn(() => ({ clearRect, createImageData, putImageData }))
    };
    const exec = jest.fn((callback) => callback([{ node: canvas, width: 96, height: 96 }]));
    const fields = jest.fn(() => ({ exec }));
    const select = jest.fn(() => ({ fields }));
    const query = { in: jest.fn(() => ({ select })), select };
    const wxApi = {
      createSelectorQuery: jest.fn(() => query),
      getSystemInfoSync: jest.fn(() => ({ pixelRatio: 2 })),
      canvasPutImageData: jest.fn()
    };

    const painted = paintRadarCloudCanvas('homeRadarCloudField', directions, { wxApi }, 64);

    expect(painted).toBe(true);
    expect(putImageData).toHaveBeenCalled();
    expect(wxApi.canvasPutImageData).not.toHaveBeenCalled();
  });

  test('scopes Canvas 2D selector queries to the miniprogram page instance', () => {
    const putImageData = jest.fn();
    const clearRect = jest.fn();
    const createImageData = jest.fn((width, height) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) }));
    const canvas = {
      width: 0,
      height: 0,
      getContext: jest.fn(() => ({ clearRect, createImageData, putImageData }))
    };
    const exec = jest.fn((callback) => callback([{ node: canvas, width: 96, height: 96 }]));
    const fields = jest.fn(() => ({ exec }));
    const scopedSelect = jest.fn(() => ({ fields }));
    const page = {};
    const query = {
      in: jest.fn((target) => (target === page ? { select: scopedSelect } : { select: jest.fn() })),
      select: jest.fn()
    };
    const wxApi = {
      createSelectorQuery: jest.fn(() => query),
      getSystemInfoSync: jest.fn(() => ({ pixelRatio: 2 }))
    };

    paintRadarCloudCanvas2d('homeRadarCloudField', directions, { wxApi, page }, 64);

    expect(query.in).toHaveBeenCalledWith(page);
    expect(scopedSelect).toHaveBeenCalledWith('#homeRadarCloudField');
    expect(putImageData).toHaveBeenCalled();
  });

  test('uses the official Canvas 2D node path when createSelectorQuery is available', () => {
    const putImageData = jest.fn();
    const clearRect = jest.fn();
    const createImageData = jest.fn((width, height) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) }));
    const drawImage = jest.fn();
    const canvas = {
      width: 0,
      height: 0,
      getContext: jest.fn(() => ({ clearRect, createImageData, drawImage, putImageData }))
    };
    const exec = jest.fn((callback) => callback([{ node: canvas, width: 96, height: 96 }]));
    const fields = jest.fn(() => ({ exec }));
    const select = jest.fn(() => ({ fields }));
    const query = { in: jest.fn(() => ({ select })), select };
    const wxApi = {
      createSelectorQuery: jest.fn(() => query),
      getSystemInfoSync: jest.fn(() => ({ pixelRatio: 2 })),
      canvasPutImageData: jest.fn()
    };

    const painted = paintRadarCloudCanvas2d('homeRadarCloudField', directions, { wxApi }, 64);

    expect(painted).toBe(true);
    expect(wxApi.createSelectorQuery).toHaveBeenCalled();
    expect(select).toHaveBeenCalledWith('#homeRadarCloudField');
    expect(canvas.width).toBe(192);
    expect(canvas.height).toBe(192);
    expect(clearRect).toHaveBeenCalledWith(0, 0, 192, 192);
    expect(putImageData).toHaveBeenCalledWith(expect.objectContaining({
      width: 192,
      height: 192,
      data: expect.any(Uint8ClampedArray)
    }), 0, 0);
    expect(drawImage).toHaveBeenCalledWith(canvas, 0, 0);
    expect(wxApi.canvasPutImageData).not.toHaveBeenCalled();
  });
});
