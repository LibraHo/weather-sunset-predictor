/**
 * ChinaRasterOverlay.js - 东亚火烧云连续栅格渲染器（等值热力层）
 *
 * 基于 /api/spots/china/raster 数据渲染：
 * 1) 等值面（contourf 风格填色）
 * 2) 细等值线（marching-squares）
 * 3) 关键值标签（70 / 80）
 */

// ─── 模块级 GeoJSON 缓存（用于 canvas clip）─────────────────────────────────
let _chinaGeoJSONCache = null;
async function _loadChinaGeoJSON() {
  if (_chinaGeoJSONCache) return _chinaGeoJSONCache;
  try {
    const resp = await fetch('/data/east-asia-geojson.json');
    if (resp.ok) _chinaGeoJSONCache = await resp.json();
  } catch (_) {}
  return _chinaGeoJSONCache;
}

// ─── 常量 ────────────────────────────────────────────────────────────────────

// 数据有效阈值（用于统计，不等于视觉显示阈值）
const RASTER_MIN_SCORE = 15;
const RASTER_FULL_SCORE = 70;

const RASTER_COLOR_MODE_KEY = 'firecloud_raster_color_mode';
const RASTER_COLOR_MODES = Object.freeze({
  FULL: 'full',
  COMPACT: 'compact'
});

function getRasterColorMode() {
  try {
    const mode = localStorage.getItem(RASTER_COLOR_MODE_KEY);
    return mode === RASTER_COLOR_MODES.FULL ? RASTER_COLOR_MODES.FULL : RASTER_COLOR_MODES.COMPACT;
  } catch (_) {
    return RASTER_COLOR_MODES.COMPACT;
  }
}

function getVisualMinScore(mode = getRasterColorMode()) {
  return mode === RASTER_COLOR_MODES.FULL ? 0 : 40;
}

function getBandLevels(mode = getRasterColorMode()) {
  return mode === RASTER_COLOR_MODES.FULL
    ? [0, 10, 20, 30, 40, 45, 50, 55, 60, 65, 70]
    : [40, 45, 50, 55, 60, 65, 70];
}

function getContourLevels(mode = getRasterColorMode()) {
  return mode === RASTER_COLOR_MODES.FULL
    ? Array.from({ length: 21 }, (_, i) => 30 + i * 2)
    : Array.from({ length: 16 }, (_, i) => 40 + i * 2);
}

// 默认导出常量保持兼容；运行时使用 get* 方法读取当前设置
const VISUAL_MIN_SCORE = 40;
const BAND_LEVELS = getBandLevels(RASTER_COLOR_MODES.COMPACT);
const CONTOUR_LEVELS = getContourLevels(RASTER_COLOR_MODES.COMPACT);

// 关键标签（高分不足时用次级标签）
const KEY_LABEL_LEVELS = [70, 80];
const FALLBACK_LABEL_LEVELS = [50, 60];

// 调试：渲染原始采样点（仅 test 时段生效）
const DEBUG_DRAW_RAW_POINTS = false;

// 测试板块：北京投影链路校验点（十字 + 文本）
const BEIJING_CHECK = {
  lat: 39.9042,
  lon: 116.4074,
  text: '北京校验点'
};

// 晚霞（橙粉系，淡）
const FIRECLOUD_PALETTE = [
  { t: 0.00, r: 255, g: 236, b: 212, a: 0.05 },
  { t: 0.12, r: 255, g: 218, b: 176, a: 0.10 },
  { t: 0.28, r: 255, g: 194, b: 132, a: 0.18 },
  { t: 0.46, r: 255, g: 166, b: 92,  a: 0.26 },
  { t: 0.64, r: 248, g: 132, b: 54,  a: 0.35 },
  { t: 0.82, r: 235, g: 100, b: 38,  a: 0.44 },
  { t: 1.00, r: 218, g: 78,  b: 28,  a: 0.55 },
];

// 朝霞（橙粉系，稍淡）
const SUNRISE_PALETTE = [
  { t: 0.00, r: 255, g: 236, b: 214, a: 0.06 },
  { t: 0.12, r: 255, g: 220, b: 184, a: 0.12 },
  { t: 0.28, r: 255, g: 196, b: 150, a: 0.22 },
  { t: 0.46, r: 255, g: 166, b: 112, a: 0.32 },
  { t: 0.64, r: 248, g: 132, b: 82,  a: 0.42 },
  { t: 0.82, r: 236, g: 104, b: 62,  a: 0.54 },
  { t: 1.00, r: 222, g: 84,  b: 46,  a: 0.65 },
];

export function getPaletteForPeriod(period) {
  return period === 'sunrise' ? SUNRISE_PALETTE : FIRECLOUD_PALETTE;
}


// 测试面板：注入可见的模拟图层（仅渲染层，不影响后端评分）
const ENABLE_SYNTHETIC_TEST_DATA = false;

// ─── 工具函数 ─────────────────────────────────────────────────────────────────

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function lerp(a, b, t) { return a + (b - a) * t; }

function smoothstep01(t) {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

function alphaSoftThreshold(score, mode = getRasterColorMode()) {
  const visualMin = getVisualMinScore(mode);
  if (score < visualMin) return 0;
  return 1;
}

function samplePalette(t, palette) {
  const tt = clamp(t, 0, 1);
  for (let i = 0; i < palette.length - 1; i++) {
    const lo = palette[i];
    const hi = palette[i + 1];
    if (tt >= lo.t && tt <= hi.t) {
      const lt = (tt - lo.t) / (hi.t - lo.t || 1);
      return {
        r: Math.round(lerp(lo.r, hi.r, lt)),
        g: Math.round(lerp(lo.g, hi.g, lt)),
        b: Math.round(lerp(lo.b, hi.b, lt)),
        a: clamp(lerp(lo.a, hi.a, lt), 0, 1),
      };
    }
  }
  const last = palette[palette.length - 1];
  return { r: last.r, g: last.g, b: last.b, a: last.a };
}

/**
 * score 映射为填色（粉色半透明、分级平滑）
 */
function scoreToRGBA(score, noDataValue = -1, palette = FIRECLOUD_PALETTE, mode = getRasterColorMode()) {
  if (score === noDataValue || !Number.isFinite(score)) {
    return { r: 0, g: 0, b: 0, a: 0 };
  }

  const soft = alphaSoftThreshold(score, mode);
  if (soft <= 0) return { r: 0, g: 0, b: 0, a: 0 };

  const visualMin = getVisualMinScore(mode);
  const bandLevels = getBandLevels(mode);
  const clamped = clamp(score, visualMin, RASTER_FULL_SCORE);

  // 基于 band 的离散层级 + 层内平滑（兼顾 contourf 质感与边缘柔和）
  let bandIndex = 0;
  while (bandIndex < bandLevels.length - 1 && clamped >= bandLevels[bandIndex + 1]) {
    bandIndex += 1;
  }
  const bandLo = bandLevels[bandIndex];
  const bandHi = bandLevels[Math.min(bandIndex + 1, bandLevels.length - 1)];
  const localT = bandHi === bandLo ? 1 : smoothstep01((clamped - bandLo) / (bandHi - bandLo));

  const denom = RASTER_FULL_SCORE - visualMin || 1;
  const globalLoT = (bandLo - visualMin) / denom;
  const globalHiT = (bandHi - visualMin) / denom;
  const globalT = lerp(globalLoT, globalHiT, localT);

  const base = samplePalette(globalT, palette);
  return { r: base.r, g: base.g, b: base.b, a: base.a * soft };
}

/**
 * 根据缩放等级决定请求分辨率
 */
export function resolutionForZoom(zoom) {
  if (zoom >= 7) return 0.25;
  if (zoom >= 6) return 0.3;
  return 0.5;
}

function idxOf(col, row, width) {
  return row * width + col;
}

/**
 * 轻度高斯平滑（3x3，忽略 noData）
 */
function smoothGrid(values, width, height, noData = -1) {
  const kernel = [
    [1, 2, 1],
    [2, 4, 2],
    [1, 2, 1],
  ];

  const out = new Float32Array(width * height);

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      let sum = 0;
      let wsum = 0;

      for (let ky = -1; ky <= 1; ky++) {
        const sy = row + ky;
        if (sy < 0 || sy >= height) continue;
        for (let kx = -1; kx <= 1; kx++) {
          const sx = col + kx;
          if (sx < 0 || sx >= width) continue;

          const v = values[idxOf(sx, sy, width)];
          if (v === noData || !Number.isFinite(v)) continue;

          const w = kernel[ky + 1][kx + 1];
          sum += v * w;
          wsum += w;
        }
      }

      const center = values[idxOf(col, row, width)];
      out[idxOf(col, row, width)] = wsum > 0 ? sum / wsum : (center === noData ? noData : center);
    }
  }

  return out;
}

function interpolatePoint(x1, y1, v1, x2, y2, v2, level) {
  if (!Number.isFinite(v1) || !Number.isFinite(v2)) return null;
  if (v1 === v2) return { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
  const t = clamp((level - v1) / (v2 - v1), 0, 1);
  return { x: lerp(x1, x2, t), y: lerp(y1, y2, t) };
}

/**
 * marching-squares 生成等值线段（网格坐标系）
 */
function buildContours(grid, width, height, levels, noData = -1) {
  const contourMap = new Map();
  for (const lv of levels) contourMap.set(lv, []);

  for (const level of levels) {
    const segments = contourMap.get(level);

    for (let row = 0; row < height - 1; row++) {
      for (let col = 0; col < width - 1; col++) {
        const v0 = grid[idxOf(col, row, width)];
        const v1 = grid[idxOf(col + 1, row, width)];
        const v2 = grid[idxOf(col + 1, row + 1, width)];
        const v3 = grid[idxOf(col, row + 1, width)];

        if ([v0, v1, v2, v3].some(v => v === noData || !Number.isFinite(v))) continue;

        const edges = [];
        const cross = (a, b) => (a < level && b >= level) || (a >= level && b < level);

        if (cross(v0, v1)) edges.push(interpolatePoint(col, row, v0, col + 1, row, v1, level));       // top
        if (cross(v1, v2)) edges.push(interpolatePoint(col + 1, row, v1, col + 1, row + 1, v2, level)); // right
        if (cross(v3, v2)) edges.push(interpolatePoint(col, row + 1, v3, col + 1, row + 1, v2, level)); // bottom
        if (cross(v0, v3)) edges.push(interpolatePoint(col, row, v0, col, row + 1, v3, level));         // left

        if (edges.length === 2) {
          segments.push([edges[0], edges[1]]);
        } else if (edges.length === 4) {
          // 歧义格：按中心值拆分
          const center = (v0 + v1 + v2 + v3) / 4;
          if (center >= level) {
            segments.push([edges[0], edges[1]]);
            segments.push([edges[2], edges[3]]);
          } else {
            segments.push([edges[0], edges[3]]);
            segments.push([edges[1], edges[2]]);
          }
        }
      }
    }
  }

  return contourMap;
}

function buildLabelAnchors(contours, levels) {
  const anchors = new Map();

  for (const level of levels) {
    const segs = contours.get(level) || [];
    const sortable = segs
      .map(seg => {
        const [p1, p2] = seg;
        const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        return {
          len,
          x: (p1.x + p2.x) / 2,
          y: (p1.y + p2.y) / 2,
        };
      })
      .filter(s => s.len > 1.4)
      .sort((a, b) => b.len - a.len);

    const picked = [];
    for (const cand of sortable) {
      const tooClose = picked.some(p => Math.hypot(p.x - cand.x, p.y - cand.y) < 8);
      if (!tooClose) picked.push(cand);
      if (picked.length >= 3) break;
    }
    anchors.set(level, picked);
  }

  return anchors;
}

// ─── 主类 ─────────────────────────────────────────────────────────────────────

export default class ChinaRasterOverlay {
  constructor() {
    this._map = null;
    this._canvas = null;

    this._offscreen = null;    // 填色离屏 canvas
    this._offCtx = null;

    this._rasterData = null;
    this._smoothedValues = null;
    this._contours = null;
    this._labelAnchors = null;

    this._period = 'sunset';
    this._visible = false;
    this._loading = false;
    this._updatedAt = null;

    this._boundReproject = null;
    this._boundSchedule = null;
    this._rafHandle = null;

    this._boundColorModeChanged = () => {
      if (this._rasterData) this._buildOffscreen(this._rasterData);
      if (this._visible) this._reprojectCanvas();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('firecloudRasterColorModeChanged', this._boundColorModeChanged);
    }
  }

  init(leafletMap) {
    this._map = leafletMap;
    this._createCanvas();

    // 预加载 GeoJSON 用于 clip
    _loadChinaGeoJSON();

    this._boundReproject = () => this._reprojectCanvas();
    this._boundSchedule = () => this._scheduleReproject();

    this._map.on('moveend zoomend resize', this._boundReproject);
    this._map.on('move', this._boundSchedule);
  }

  _createCanvas() {
    const canvas = document.createElement('canvas');
    canvas.style.cssText = [
      'position:absolute',
      'top:0',
      'left:0',
      'pointer-events:none',
      'z-index:448',
      'display:none',
    ].join(';');
    canvas.className = 'china-raster-canvas';

    const container = this._map.getContainer();
    container.style.position = 'relative';
    container.appendChild(canvas);
    this._canvas = canvas;
  }

  setPeriod(period) {
    this._period = ['sunrise', 'sunset', 'test'].includes(period) ? period : 'sunset';
  }

  getPeriod() { return this._period; }
  getUpdatedAt() { return this._updatedAt; }

  getMaxScore() {
    if (!this._rasterData) return null;
    const { values, noData = -1 } = this._rasterData;
    if (!Array.isArray(values) || values.length === 0) return null;
    let max = -Infinity;
    for (const v of values) {
      if (v !== noData && Number.isFinite(v) && v >= RASTER_MIN_SCORE && v > max) max = v;
    }
    return max === -Infinity ? null : max;
  }

  getSpotCount() {
    if (!this._rasterData || !Array.isArray(this._rasterData.values)) return 0;
    const noData = this._rasterData.noData ?? -1;
    let count = 0;
    for (const v of this._rasterData.values) {
      if (Number.isFinite(v) && v !== noData && v >= RASTER_MIN_SCORE) count += 1;
    }
    return count;
  }

  isVisible() { return this._visible; }

  async loadAndRender(period = this._period) {
    this.setPeriod(period);
    if (this._loading) return;

    this._loading = true;
    try {
      const zoom = this._map ? this._map.getZoom() : 5;
      const resolution = resolutionForZoom(zoom);
      const requestPeriod = this._period === 'test' ? 'sunset' : this._period;
      const params = new URLSearchParams({ period: requestPeriod, resolution: String(resolution) });

      const res = await fetch(`/api/spots/china/raster?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const rawData = await res.json();
      const data = (ENABLE_SYNTHETIC_TEST_DATA && this._period === 'test')
        ? this._buildSyntheticTestData(rawData)
        : rawData;
      this._rasterData = data;
      this._updatedAt = data.updatedAt || null;

      this._buildOffscreen(data);
      this.show();
    } catch (err) {
      console.error('[ChinaRasterOverlay] 加载栅格失败:', err);
    } finally {
      this._loading = false;
    }
  }

  _buildSyntheticTestData(data) {
    if (!data || !Array.isArray(data.values) || !data.width || !data.height || !data.bbox) return data;

    const { bbox } = data;
    const width = data.width;
    const height = data.height;
    const noData = data.noData ?? -1;

    // 测试模式：完全忽略真实数据，只在北京附近生成可控云团
    // 避免真实热点（如蒙古附近）干扰映射验证
    const values = new Array(width * height).fill(noData);

    const lonStep = (bbox.east - bbox.west) / Math.max(1, width);
    const latStep = (bbox.north - bbox.south) / Math.max(1, height);

    const gaussian = (x, y, cx, cy, sx, sy, amp) => {
      const dx = (x - cx) / sx;
      const dy = (y - cy) / sy;
      return amp * Math.exp(-(dx * dx + dy * dy));
    };

    // 以真实经纬度锚定北京中心，避免按宽高比例估算带来偏移
    const beijing = { lat: 39.9042, lon: 116.4074 };
    const bjx = (beijing.lon - bbox.west) / lonStep - 0.5;
    const bjy = (bbox.north - beijing.lat) / latStep - 0.5;

    const blobs = [
      { cx: bjx - 4.0, cy: bjy - 2.5, sx: 5.5, sy: 4.8, amp: 28 },
      { cx: bjx + 5.0, cy: bjy + 1.8, sx: 4.8, sy: 4.2, amp: 24 },
      { cx: bjx,       cy: bjy + 3.8, sx: 6.5, sy: 5.2, amp: 20 },
    ];

    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        let score = 0;
        for (const b of blobs) score += gaussian(col, row, b.cx, b.cy, b.sx, b.sy, b.amp);

        if (score >= getVisualMinScore()) {
          values[row * width + col] = Math.min(68, Math.round(score * 10) / 10);
        }
      }
    }

    return {
      ...data,
      values,
      synthetic: true,
      syntheticCenter: beijing,
      updatedAt: data.updatedAt || new Date().toISOString()
    };
  }

  show() {
    if (!this._map || !this._canvas) return;
    this._visible = true;
    this._canvas.style.display = 'block';
    this._reprojectCanvas();
  }

  hide() {
    if (!this._canvas) return;
    this._visible = false;
    this._canvas.style.display = 'none';
  }

  toggle() {
    if (this._visible) this.hide();
    else this.show();
  }

  clear() {
    this.hide();
    this._rasterData = null;
    this._smoothedValues = null;
    this._contours = null;
    this._labelAnchors = null;
    this._offscreen = null;
    this._offCtx = null;
  }

  _buildOffscreen(data) {
    const { width, height, values, noData = -1 } = data;
    if (!width || !height || !Array.isArray(values) || values.length !== width * height) {
      console.warn('[ChinaRasterOverlay] 栅格数据格式异常', { width, height, valLen: values?.length });
      return;
    }

    if (!this._offscreen) {
      this._offscreen = document.createElement('canvas');
      this._offCtx = this._offscreen.getContext('2d');
    }

    this._offscreen.width = width;
    this._offscreen.height = height;

    const useSmoothing = this._period !== 'test';
    const renderValues = useSmoothing
      ? smoothGrid(values, width, height, noData)
      : Float32Array.from(values);
    this._smoothedValues = renderValues;

    const imgData = this._offCtx.createImageData(width, height);
    const buf = imgData.data;
    const palette = getPaletteForPeriod(this._period);
    const colorMode = getRasterColorMode();

    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const idx = row * width + col;
        const score = renderValues[idx];
        const { r, g, b, a } = scoreToRGBA(score, noData, palette, colorMode);
        const px = idx * 4;
        buf[px] = r;
        buf[px + 1] = g;
        buf[px + 2] = b;
        buf[px + 3] = Math.round(clamp(a, 0, 1) * 255);
      }
    }

    this._offCtx.putImageData(imgData, 0, 0);

    this._contours = buildContours(renderValues, width, height, getContourLevels(colorMode), noData);

    const maxScore = renderValues.reduce((m, v) => (Number.isFinite(v) && v !== noData && v > m ? v : m), -Infinity);
    this._activeLabelLevels = maxScore >= 70 ? KEY_LABEL_LEVELS : FALLBACK_LABEL_LEVELS;
    this._labelAnchors = buildLabelAnchors(this._contours, this._activeLabelLevels);

    console.log(`[ChinaRasterOverlay] 等值热力层离屏构建完成 ${width}×${height} period=${this._period}`);
  }

  _gridToScreenPoint(gx, gy, _tl, _screenW, _screenH, width, height) {
    if (!this._map || !this._rasterData?.bbox) return { x: 0, y: 0 };
    const { bbox } = this._rasterData;
    const lonStep = (bbox.east - bbox.west) / Math.max(1, width);
    const latStep = (bbox.north - bbox.south) / Math.max(1, height);
    const lon = bbox.west + (gx + 0.5) * lonStep;
    const lat = bbox.north - (gy + 0.5) * latStep;
    const pt = this._map.latLngToContainerPoint(window.L.latLng(lat, lon));
    return { x: pt.x, y: pt.y };
  }

  _drawContourLines(ctx, tl, screenW, screenH, width, height) {
    if (!this._contours) return;

    for (const level of CONTOUR_LEVELS) {
      const segments = this._contours.get(level);
      if (!segments || segments.length === 0) continue;

      const activeLabels = this._activeLabelLevels || KEY_LABEL_LEVELS;
      const isKey = activeLabels.includes(level);
      ctx.beginPath();

      for (const [p1, p2] of segments) {
        const s1 = this._gridToScreenPoint(p1.x, p1.y, tl, screenW, screenH, width, height);
        const s2 = this._gridToScreenPoint(p2.x, p2.y, tl, screenW, screenH, width, height);
        ctx.moveTo(s1.x, s1.y);
        ctx.lineTo(s2.x, s2.y);
      }

      ctx.strokeStyle = isKey
        ? 'rgba(255, 236, 246, 0.48)'
        : 'rgba(255, 224, 238, 0.22)';
      ctx.lineWidth = isKey ? 1.1 : 0.65;
      ctx.stroke();
    }
  }

  _drawLabels(ctx, tl, screenW, screenH, width, height) {
    if (!this._labelAnchors) return;

    ctx.save();
    ctx.font = '12px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const activeLabels = this._activeLabelLevels || KEY_LABEL_LEVELS;
    for (const level of activeLabels) {
      const anchors = this._labelAnchors.get(level) || [];
      for (const a of anchors) {
        const s = this._gridToScreenPoint(a.x, a.y, tl, screenW, screenH, width, height);

        ctx.fillStyle = 'rgba(255, 246, 252, 0.72)';
        ctx.strokeStyle = 'rgba(114, 49, 109, 0.35)';
        ctx.lineWidth = 2.6;
        const text = `${level}`;
        ctx.strokeText(text, s.x, s.y);
        ctx.fillText(text, s.x, s.y);
      }
    }

    ctx.restore();
  }

  _drawRawSamplePoints(ctx, tl, screenW, screenH, width, height) {
    if (!this._rasterData || !Array.isArray(this._rasterData.values) || !this._map) return;

    const { values, noData = -1, bbox } = this._rasterData;
    if (!bbox) return;

    const pointRadius = 2.2;
    const lonStep = (bbox.east - bbox.west) / Math.max(1, width);
    const latStep = (bbox.north - bbox.south) / Math.max(1, height);

    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const idx = row * width + col;
        const score = values[idx];
        if (!Number.isFinite(score) || score === noData) continue;

        // 显式走：网格(row,col) -> 经纬度(lat,lon) -> 地图像素坐标
        const lat = bbox.north - (row + 0.5) * latStep;
        const lon = bbox.west + (col + 0.5) * lonStep;
        const pt = this._map.latLngToContainerPoint(window.L.latLng(lat, lon));

        const { r, g, b, a } = scoreToRGBA(score, noData, getPaletteForPeriod(this._period), getRasterColorMode());
        if (a <= 0) continue;

        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pointRadius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${Math.max(0.22, a)})`;
        ctx.fill();
      }
    }
  }

  _drawBeijingProjectionCheckMark(ctx) {
    if (!this._map || this._period !== 'test') return;

    const pt = this._map.latLngToContainerPoint(window.L.latLng(BEIJING_CHECK.lat, BEIJING_CHECK.lon));
    const size = 8;

    ctx.save();
    ctx.strokeStyle = 'rgba(255, 245, 100, 0.95)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pt.x - size, pt.y);
    ctx.lineTo(pt.x + size, pt.y);
    ctx.moveTo(pt.x, pt.y - size);
    ctx.lineTo(pt.x, pt.y + size);
    ctx.stroke();

    ctx.font = '12px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillStyle = 'rgba(255, 245, 180, 0.98)';
    const label = `${BEIJING_CHECK.text} (${BEIJING_CHECK.lat.toFixed(4)}, ${BEIJING_CHECK.lon.toFixed(4)})`;
    ctx.strokeText(label, pt.x + 12, pt.y - 12);
    ctx.fillText(label, pt.x + 12, pt.y - 12);
    ctx.restore();
  }

  _reprojectCanvas() {
    if (!this._visible || !this._canvas || !this._rasterData || !this._offscreen || !this._map) return;

    const { bbox, width, height } = this._rasterData;
    if (!bbox || !width || !height) return;

    const tl = this._map.latLngToContainerPoint(window.L.latLng(bbox.north, bbox.west));
    const br = this._map.latLngToContainerPoint(window.L.latLng(bbox.south, bbox.east));

    const screenW = Math.round(Math.abs(br.x - tl.x));
    const screenH = Math.round(Math.abs(br.y - tl.y));
    if (screenW <= 0 || screenH <= 0) return;

    const mapSize = this._map.getSize();
    this._canvas.width = mapSize.x;
    this._canvas.height = mapSize.y;
    this._canvas.style.width = `${mapSize.x}px`;
    this._canvas.style.height = `${mapSize.y}px`;

    const ctx = this._canvas.getContext('2d');
    ctx.clearRect(0, 0, mapSize.x, mapSize.y);

    const shouldDebugDrawRawPoints = this._period === 'test' && DEBUG_DRAW_RAW_POINTS;
    if (shouldDebugDrawRawPoints) {
      this._drawRawSamplePoints(ctx, tl, screenW, screenH, width, height);
      this._drawBeijingProjectionCheckMark(ctx);
      return;
    }

    // Pass 1: 填色层（test 模式更锐利，便于映射校验）
    const zoom = this._map.getZoom();
    const blurPx = clamp(3.0 - (zoom - 5) * 0.25, 1.2, 3.2);
    const sharpTest = this._period === 'test';

    // 建立中国边界 clip path（严格裁剪到中国边界内，消除东北/西藏外溢）
    const geoJSON = _chinaGeoJSONCache;
    if (geoJSON && geoJSON.features) {
      ctx.save();
      ctx.beginPath();
      for (const feature of geoJSON.features) {
        const geom = feature.geometry;
        const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
        for (const poly of polys) {
          for (const ring of poly) {
            let first = true;
            for (const [lon, lat] of ring) {
              const pt = this._map.latLngToContainerPoint(window.L.latLng(lat, lon));
              if (first) { ctx.moveTo(pt.x, pt.y); first = false; }
              else ctx.lineTo(pt.x, pt.y);
            }
            ctx.closePath();
          }
        }
      }
      ctx.clip();
      // 使用 evenodd 规则确保复杂多边形正确裁剪
      ctx.clip('evenodd');
    } else {
      ctx.save();
    }

    if (sharpTest) {
      ctx.filter = 'none';
      ctx.imageSmoothingEnabled = false;
    } else {
      ctx.filter = `blur(${blurPx.toFixed(1)}px) saturate(1.15)`;
      ctx.imageSmoothingEnabled = true;
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.drawImage(this._offscreen, 0, 0, width, height, tl.x, tl.y, screenW, screenH);
    ctx.restore();

    // Pass 2/3 已禁用：按产品要求仅保留纯色带渲染，不显示等高线与标签
    // this._drawContourLines(ctx, tl, screenW, screenH, width, height);
    // this._drawLabels(ctx, tl, screenW, screenH, width, height);

  }

  _scheduleReproject() {
    if (!this._visible || this._rafHandle) return;
    this._rafHandle = requestAnimationFrame(() => {
      this._rafHandle = null;
      this._reprojectCanvas();
    });
  }

  destroy() {
    if (this._map && this._boundReproject) {
      this._map.off('moveend zoomend resize', this._boundReproject);
      this._map.off('move', this._boundSchedule);
    }
    if (typeof window !== 'undefined' && this._boundColorModeChanged) {
      window.removeEventListener('firecloudRasterColorModeChanged', this._boundColorModeChanged);
    }
    if (this._canvas) this._canvas.remove();

    this._canvas = null;
    this._offscreen = null;
    this._offCtx = null;
    this._rasterData = null;
    this._smoothedValues = null;
    this._contours = null;
    this._labelAnchors = null;
    this._map = null;
  }
}

export {
  scoreToRGBA,
  RASTER_COLOR_MODE_KEY,
  RASTER_COLOR_MODES,
  getRasterColorMode,
  getVisualMinScore,
  getBandLevels,
  getContourLevels,
  FIRECLOUD_PALETTE,
  SUNRISE_PALETTE,
  RASTER_MIN_SCORE,
  RASTER_FULL_SCORE,
  VISUAL_MIN_SCORE,
  BAND_LEVELS,
  CONTOUR_LEVELS,
  KEY_LABEL_LEVELS,
};
