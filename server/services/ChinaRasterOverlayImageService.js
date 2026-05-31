const chinaRasterService = require('./ChinaRasterService');
const gridService = require('./GridScoreService');
const PngEncoder = require('../utils/PngEncoder');

const SUPPORTED_PERIODS = ['sunrise', 'sunset'];
const DEFAULT_OVERLAY_RESOLUTIONS = [0.5];
const DEFAULT_SCALE = 4;
const NO_DATA_VALUE = -1;
const RASTER_VISUAL_MIN_SCORE = 40;
const RASTER_FULL_SCORE = 70;
const RASTER_BAND_LEVELS = [40, 45, 50, 55, 60, 65, 70];
const RASTER_PALETTES = {
  sunset: [
    { t: 0.00, r: 255, g: 236, b: 212, a: 0.05 },
    { t: 0.12, r: 255, g: 218, b: 176, a: 0.10 },
    { t: 0.28, r: 255, g: 194, b: 132, a: 0.18 },
    { t: 0.46, r: 255, g: 166, b: 92, a: 0.26 },
    { t: 0.64, r: 248, g: 132, b: 54, a: 0.35 },
    { t: 0.82, r: 235, g: 100, b: 38, a: 0.44 },
    { t: 1.00, r: 218, g: 78, b: 28, a: 0.55 }
  ],
  sunrise: [
    { t: 0.00, r: 255, g: 236, b: 214, a: 0.06 },
    { t: 0.12, r: 255, g: 220, b: 184, a: 0.12 },
    { t: 0.28, r: 255, g: 196, b: 150, a: 0.22 },
    { t: 0.46, r: 255, g: 166, b: 112, a: 0.32 },
    { t: 0.64, r: 248, g: 132, b: 82, a: 0.42 },
    { t: 0.82, r: 236, g: 104, b: 62, a: 0.54 },
    { t: 1.00, r: 222, g: 84, b: 46, a: 0.65 }
  ]
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(start, end, t) {
  return start + (end - start) * t;
}

function smoothstep01(t) {
  const value = clamp(t, 0, 1);
  return value * value * (3 - 2 * value);
}

function samplePalette(t, palette) {
  const value = clamp(t, 0, 1);
  for (let index = 0; index < palette.length - 1; index += 1) {
    const low = palette[index];
    const high = palette[index + 1];
    if (value >= low.t && value <= high.t) {
      const localT = (value - low.t) / (high.t - low.t || 1);
      return {
        r: Math.round(lerp(low.r, high.r, localT)),
        g: Math.round(lerp(low.g, high.g, localT)),
        b: Math.round(lerp(low.b, high.b, localT)),
        a: clamp(lerp(low.a, high.a, localT), 0, 1)
      };
    }
  }
  return palette[palette.length - 1];
}

function scoreToRasterRgba(score, period = 'sunset') {
  if (!Number.isFinite(score) || score < RASTER_VISUAL_MIN_SCORE) return { r: 0, g: 0, b: 0, a: 0 };
  const palette = RASTER_PALETTES[period] || RASTER_PALETTES.sunset;
  const clamped = clamp(score, RASTER_VISUAL_MIN_SCORE, RASTER_FULL_SCORE);
  let bandIndex = 0;
  while (bandIndex < RASTER_BAND_LEVELS.length - 1 && clamped >= RASTER_BAND_LEVELS[bandIndex + 1]) {
    bandIndex += 1;
  }
  const bandLo = RASTER_BAND_LEVELS[bandIndex];
  const bandHi = RASTER_BAND_LEVELS[Math.min(bandIndex + 1, RASTER_BAND_LEVELS.length - 1)];
  const localT = bandHi === bandLo ? 1 : smoothstep01((clamped - bandLo) / (bandHi - bandLo));
  const globalLoT = (bandLo - RASTER_VISUAL_MIN_SCORE) / (RASTER_FULL_SCORE - RASTER_VISUAL_MIN_SCORE);
  const globalHiT = (bandHi - RASTER_VISUAL_MIN_SCORE) / (RASTER_FULL_SCORE - RASTER_VISUAL_MIN_SCORE);
  return samplePalette(lerp(globalLoT, globalHiT, localT), palette);
}

function sampleSmoothRasterValue(raster, x, y) {
  const { width, height, values, noData = NO_DATA_VALUE } = raster;
  const x0 = clamp(Math.floor(x), 0, width - 1);
  const y0 = clamp(Math.floor(y), 0, height - 1);
  const x1 = clamp(x0 + 1, 0, width - 1);
  const y1 = clamp(y0 + 1, 0, height - 1);
  const tx = clamp(x - x0, 0, 1);
  const ty = clamp(y - y0, 0, 1);
  const samples = [
    { value: Number(values[y0 * width + x0]), weight: (1 - tx) * (1 - ty) },
    { value: Number(values[y0 * width + x1]), weight: tx * (1 - ty) },
    { value: Number(values[y1 * width + x0]), weight: (1 - tx) * ty },
    { value: Number(values[y1 * width + x1]), weight: tx * ty }
  ];

  let weightedScore = 0;
  let totalWeight = 0;
  samples.forEach((sample) => {
    if (Number.isFinite(sample.value) && sample.value !== noData) {
      weightedScore += sample.value * sample.weight;
      totalWeight += sample.weight;
    }
  });

  return totalWeight > 0 ? weightedScore / totalWeight : noData;
}

function renderRasterOverlayPng(raster, period, options = {}) {
  const { width, height, values, noData = NO_DATA_VALUE } = raster || {};
  if (!width || !height || !Array.isArray(values)) {
    throw new Error('Invalid raster data');
  }
  const scale = clamp(Math.round(options.scale || DEFAULT_SCALE), 1, 8);
  const outputWidth = width * scale;
  const outputHeight = height * scale;
  const rgba = new Uint8Array(outputWidth * outputHeight * 4);
  for (let row = 0; row < outputHeight; row += 1) {
    const y = (row + 0.5) / scale - 0.5;
    for (let col = 0; col < outputWidth; col += 1) {
      const x = (col + 0.5) / scale - 0.5;
      const score = scale === 1
        ? Number(values[row * width + col])
        : sampleSmoothRasterValue({ width, height, values, noData }, x, y);
      const color = score === noData ? { r: 0, g: 0, b: 0, a: 0 } : scoreToRasterRgba(score, period);
      const offset = (row * outputWidth + col) * 4;
      rgba[offset] = color.r;
      rgba[offset + 1] = color.g;
      rgba[offset + 2] = color.b;
      rgba[offset + 3] = Math.round(clamp(color.a, 0, 1) * 255);
    }
  }
  return PngEncoder.encode(rgba, outputWidth, outputHeight);
}

function sourceSignatureForRaster(raster) {
  return [
    raster?._sourceSignature || '',
    raster?.updatedAt || '',
    raster?.generatedAt || '',
    raster?.resolution || ''
  ].join('|');
}

class ChinaRasterOverlayImageService {
  constructor(options = {}) {
    this.rasterService = options.rasterService || chinaRasterService;
    this._cache = {};
    if (typeof gridService.onRefreshComplete === 'function') {
      gridService.onRefreshComplete(({ period }) => {
        this.warmCache(period).catch(err => {
          console.warn(`[ChinaRasterOverlayImageService] overlay cache warm failed (${period}):`, err.message);
        });
      });
    }
  }

  _getCacheKey(period, resolution, scale) {
    return `${period}:${resolution}:${scale}`;
  }

  invalidateCache(period = 'all') {
    if (period === 'all') {
      this._cache = {};
      return;
    }
    Object.keys(this._cache).forEach((key) => {
      if (key.startsWith(`${period}:`)) delete this._cache[key];
    });
  }

  async getOverlayPng(period = 'sunset', resolution = 0.5, options = {}) {
    const safePeriod = SUPPORTED_PERIODS.includes(period) ? period : 'sunset';
    const safeRes = typeof resolution === 'number' && resolution > 0 && resolution <= 2 ? resolution : 0.5;
    const scale = clamp(Math.round(options.scale || DEFAULT_SCALE), 1, 8);
    const raster = await this.rasterService.getRaster(safePeriod, safeRes);
    const signature = sourceSignatureForRaster(raster);
    const cacheKey = this._getCacheKey(safePeriod, safeRes, scale);
    const cached = this._cache[cacheKey];
    if (cached && cached.signature === signature) return cached;

    const png = renderRasterOverlayPng(raster, safePeriod, { scale });
    const entry = {
      period: safePeriod,
      resolution: safeRes,
      scale,
      signature,
      generatedAt: new Date().toISOString(),
      rasterUpdatedAt: raster.updatedAt,
      png
    };
    this._cache[cacheKey] = entry;
    return entry;
  }

  async warmCache(period = 'sunset', resolutions = DEFAULT_OVERLAY_RESOLUTIONS) {
    const safePeriod = SUPPORTED_PERIODS.includes(period) ? period : 'sunset';
    this.invalidateCache(safePeriod);
    const warmed = [];
    for (const resolution of resolutions) {
      warmed.push(await this.getOverlayPng(safePeriod, resolution));
    }
    return warmed;
  }
}

const instance = new ChinaRasterOverlayImageService();

module.exports = instance;
module.exports.ChinaRasterOverlayImageService = ChinaRasterOverlayImageService;
module.exports.renderRasterOverlayPng = renderRasterOverlayPng;
module.exports.scoreToRasterRgba = scoreToRasterRgba;
