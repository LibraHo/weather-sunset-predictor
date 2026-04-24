import { jest } from '@jest/globals';
import ShareCardGenerator, { generateShareCard } from '@services/ShareCardGenerator.js';

function createMockContext() {
  const gradient = { addColorStop: jest.fn() };
  return {
    createLinearGradient: jest.fn(() => gradient),
    createRadialGradient: jest.fn(() => gradient),
    fillRect: jest.fn(),
    beginPath: jest.fn(),
    arc: jest.fn(),
    fill: jest.fn(),
    stroke: jest.fn(),
    roundRect: jest.fn(),
    save: jest.fn(),
    restore: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    fillText: jest.fn(),
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 0,
    lineCap: '',
    font: '',
    textAlign: '',
    textBaseline: ''
  };
}

describe('ShareCardGenerator', () => {
  let generator;
  let ctx;

  beforeEach(() => {
    generator = new ShareCardGenerator();
    ctx = createMockContext();
  });

  test('constructor initializes fixed 9:16 canvas size and themes', () => {
    expect(generator.W).toBe(750);
    expect(generator.H).toBe(1334);
    expect(generator.themes.sunrise.accent).toBe('#FF6B8A');
    expect(generator.themes.sunset.accent).toBe('#FF6F00');
  });

  test('_fmtDate and _fmtTime handle empty and date-like values', () => {
    expect(generator._fmtDate(null)).toBe('');
    expect(generator._fmtDate('2026-04-24T10:30:00Z')).toContain('2026年4月24日');
    expect(generator._fmtTime(null)).toBe('--:--');
    expect(generator._fmtTime('2026-04-24T06:05:00Z')).toMatch(/^\d{2}:05$/);
  });

  test('_gauge chooses quality labels and score colors across thresholds', () => {
    const theme = generator.themes.sunset;

    generator._gauge(ctx, 85, 'excellent', theme, 100);
    generator._gauge(ctx, 50, 'good', theme, 100);
    generator._gauge(ctx, 20, 'unknown', theme, 100);

    const texts = ctx.fillText.mock.calls.map(call => String(call[0]));
    expect(texts).toContain('85');
    expect(texts).toContain('50');
    expect(texts).toContain('20');
    expect(texts).toContain('极佳');
    expect(texts).toContain('良好');
    expect(texts).toContain('—');
  });

  test('_info truncates long locations and switches period label', () => {
    const longName = '这是一个非常非常非常非常非常非常非常长的城市名字';

    generator._info(ctx, longName, { date: '2026-04-24T00:00:00Z' }, 'sunrise', 200);
    generator._info(ctx, '', { date: '2026-04-24T00:00:00Z' }, 'sunset', 200);

    const texts = ctx.fillText.mock.calls.map(call => String(call[0]));
    expect(texts.some(text => text.includes('…'))).toBe(true);
    expect(texts.some(text => text.includes('朝霞'))).toBe(true);
    expect(texts.some(text => text.includes('晚霞'))).toBe(true);
    expect(texts).toContain('未知地点');
  });

  test('_timeWindow renders fallback and optimal viewing window', () => {
    generator._timeWindow(ctx, {}, 'sunset', 200);
    generator._timeWindow(ctx, {
      sunriseTime: '2026-04-24T05:30:00Z',
      getOptimalViewingWindow: () => ({ start: '2026-04-24T05:10:00Z', end: '2026-04-24T05:50:00Z' })
    }, 'sunrise', 200);

    const texts = ctx.fillText.mock.calls.map(call => String(call[0]));
    expect(texts).toContain('日落  --:--');
    expect(texts.some(text => text.includes('日出'))).toBe(true);
    expect(texts.some(text => text.includes('最佳观赏'))).toBe(true);
  });

  test('_cloudSummary clamps missing cloud layers and renders three columns', () => {
    generator._cloudSummary(ctx, { cloudLayers: { high: 35.4, mid: 20.2 } }, generator.themes.sunset, 300);

    const texts = ctx.fillText.mock.calls.map(call => String(call[0]));
    expect(texts).toEqual(expect.arrayContaining(['高云', '中云', '低云', '35%', '20%', '0%']));
  });

  test('_verdict covers carrier and score branches', () => {
    const cases = [
      { score: 20, cloudLayers: { high: 0, mid: 0, low: 0 }, expected: '缺少色彩载体' },
      { score: 85, cloudLayers: { high: 30, mid: 30, low: 0 }, expected: '极佳条件' },
      { score: 65, cloudLayers: { high: 20, mid: 0, low: 0 }, expected: '条件不错' },
      { score: 45, cloudLayers: { high: 20, mid: 0, low: 0 }, expected: '条件中等' },
      { score: 30, cloudLayers: { high: 20, mid: 0, low: 0 }, expected: '概率较低' }
    ];

    cases.forEach(item => generator._verdict(ctx, item, generator.themes.sunset, 400));

    const texts = ctx.fillText.mock.calls.map(call => String(call[0]));
    for (const item of cases) {
      expect(texts.some(text => text.includes(item.expected))).toBe(true);
    }
  });

  test('_toBlob uses toBlob success path and rejects null blob', async () => {
    const blob = new Blob(['x'], { type: 'image/png' });
    await expect(generator._toBlob({ toBlob: cb => cb(blob) })).resolves.toBe(blob);
    await expect(generator._toBlob({ toBlob: cb => cb(null) })).rejects.toThrow('toBlob failed');
  });

  test('_toBlob falls back to dataURL when toBlob is missing', async () => {
    global.atob = jest.fn(() => 'abc');
    const result = await generator._toBlob({ toDataURL: () => 'data:image/png;base64,YWJj' });
    expect(result).toBeInstanceOf(Blob);
  });

  test('generateShareCard draws full card and exported helper delegates', async () => {
    const blob = new Blob(['png'], { type: 'image/png' });
    const canvas = {
      width: 0,
      height: 0,
      getContext: jest.fn(() => ctx),
      toBlob: jest.fn(cb => cb(blob))
    };
    const createElementSpy = jest.spyOn(document, 'createElement').mockImplementation(tag => {
      if (tag === 'canvas') return canvas;
      return document.createElement(tag);
    });

    const prediction = {
      score: 72,
      quality: 'good',
      date: '2026-04-24T00:00:00Z',
      sunsetTime: '2026-04-24T18:30:00Z',
      cloudLayers: { high: 30, mid: 20, low: 10 }
    };

    await expect(generator.generateShareCard(prediction, '北京', 'sunset')).resolves.toBe(blob);
    await expect(generateShareCard(prediction, '北京', 'sunrise')).resolves.toBe(blob);
    expect(canvas.width).toBe(750);
    expect(canvas.height).toBe(1334);
    expect(ctx.fillText).toHaveBeenCalled();

    createElementSpy.mockRestore();
  });
});
