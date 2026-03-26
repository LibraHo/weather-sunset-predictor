/**
 * ChinaRasterOverlay.js - 中国大陆火烧云连续栅格渲染器（等值热力层）
 *
 * 基于 /api/spots/china/raster 数据渲染：
 * 1) 等值面（contourf 风格填色）
 * 2) 细等值线（marching-squares）
 * 3) 关键值标签（70 / 80）
 */

// ─── 常量 ────────────────────────────────────────────────────────────────────

// 数据有效阈值（用于统计，不等于视觉显示阈值）
const RASTER_MIN_SCORE = 15;
const RASTER_FULL_SCORE = 95;

// 视觉显示阈值：低于 60 分几乎不显示
const VISUAL_MIN_SCORE = 60;

// 等值面分级（>=8 档）
const BAND_LEVELS = [60, 63, 66, 69, 72, 75, 78, 81, 84, 87];

// 细等值线（更密）
const CONTOUR_LEVELS = Array.from({ length: 14 }, (_, i) => 60 + i * 2); // 60~86 每 2 分

// 关键标签
const KEY_LABEL_LEVELS = [70, 80];

// 晚霞（粉紫系）
const FIRECLOUD_PALETTE = [
  { t: 0.00, r: 255, g: 228, b: 240, a: 0.05 },
  { t: 0.12, r: 255, g: 206, b: 232, a: 0.10 },
  { t: 0.28, r: 250, g: 184, b: 228, a: 0.16 },
  { t: 0.46, r: 239, g: 156, b: 223, a: 0.24 },
  { t: 0.64, r: 226, g: 132, b: 219, a: 0.32 },
  { t: 0.82, r: 205, g: 108, b: 210, a: 0.40 },
  { t: 1.00, r: 182, g: 86,  b: 198, a: 0.48 },
];

// 朝霞（更浅粉）
const SUNRISE_PALETTE = [
  { t: 0.00, r: 255, g: 236, b: 244, a: 0.04 },
  { t: 0.12, r: 255, g: 220, b: 236, a: 0.08 },
  { t: 0.28, r: 255, g: 198, b: 228, a: 0.14 },
  { t: 0.46, r: 247, g: 172, b: 220, a: 0.21 },
  { t: 0.64, r: 232, g: 146, b: 208, a: 0.29 },
  { t: 0.82, r: 214, g: 122, b: 196, a: 0.37 },
  { t: 1.00, r: 192, g: 100, b: 182, a: 0.44 },
];

export function getPaletteForPeriod(period) {
  return period === 'sunrise' ? SUNRISE_PALETTE : FIRECLOUD_PALETTE;
}

// ─── 工具函数 ─────────────────────────────────────────────────────────────────

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function lerp(a, b, t) { return a + (b - a) * t; }

function smoothstep01(t) {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

function alphaSoftThreshold(score) {
  if (score < 58) return 0;          // 低分不显示
  if (score < VISUAL_MIN_SCORE) return 0.02; // 58~60 极低透明
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
function scoreToRGBA(score, noDataValue = -1, palette = FIRECLOUD_PALETTE) {
  if (score === noDataValue || !Number.isFinite(score)) {
    return { r: 0, g: 0, b: 0, a: 0 };
  }

  const soft = alphaSoftThreshold(score);
  if (soft <= 0) return { r: 0, g: 0, b: 0, a: 0 };

  const clamped = clamp(score, VISUAL_MIN_SCORE, RASTER_FULL_SCORE);

  // 基于 band 的离散层级 + 层内平滑（兼顾 contourf 质感与边缘柔和）
  let bandIndex = 0;
  while (bandIndex < BAND_LEVELS.length - 1 && clamped >= BAND_LEVELS[bandIndex + 1]) {
    bandIndex += 1;
  }
  const bandLo = BAND_LEVELS[bandIndex];
  const bandHi = BAND_LEVELS[Math.min(bandIndex + 1, BAND_LEVELS.length - 1)];
  const localT = bandHi === bandLo ? 1 : smoothstep01((clamped - bandLo) / (bandHi - bandLo));

  const globalLoT = (bandLo - VISUAL_MIN_SCORE) / (RASTER_FULL_SCORE - VISUAL_MIN_SCORE);
  const globalHiT = (bandHi - VISUAL_MIN_SCORE) / (RASTER_FULL_SCORE - VISUAL_MIN_SCORE);
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
  }

  init(leafletMap) {
    this._map = leafletMap;
    this._createCanvas();

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
    this._period = ['sunrise', 'sunset'].includes(period) ? period : 'sunset';
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
      const params = new URLSearchParams({ period: this._period, resolution: String(resolution) });

      const res = await fetch(`/api/spots/china/raster?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
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

    const smoothed = smoothGrid(values, width, height, noData);
    this._smoothedValues = smoothed;

    const imgData = this._offCtx.createImageData(width, height);
    const buf = imgData.data;
    const palette = getPaletteForPeriod(this._period);

    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const idx = row * width + col;
        const score = smoothed[idx];
        const { r, g, b, a } = scoreToRGBA(score, noData, palette);
        const px = idx * 4;
        buf[px] = r;
        buf[px + 1] = g;
        buf[px + 2] = b;
        buf[px + 3] = Math.round(clamp(a, 0, 1) * 255);
      }
    }

    this._offCtx.putImageData(imgData, 0, 0);

    this._contours = buildContours(smoothed, width, height, CONTOUR_LEVELS, noData);
    this._labelAnchors = buildLabelAnchors(this._contours, KEY_LABEL_LEVELS);

    console.log(`[ChinaRasterOverlay] 等值热力层离屏构建完成 ${width}×${height} period=${this._period}`);
  }

  _gridToScreenPoint(gx, gy, tl, screenW, screenH, width, height) {
    const x = tl.x + (gx / Math.max(1, width - 1)) * screenW;
    const y = tl.y + (gy / Math.max(1, height - 1)) * screenH;
    return { x, y };
  }

  _drawContourLines(ctx, tl, screenW, screenH, width, height) {
    if (!this._contours) return;

    for (const level of CONTOUR_LEVELS) {
      const segments = this._contours.get(level);
      if (!segments || segments.length === 0) continue;

      const isKey = KEY_LABEL_LEVELS.includes(level);
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

    for (const level of KEY_LABEL_LEVELS) {
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

    // Pass 1: 填色层（柔和）
    const zoom = this._map.getZoom();
    const blurPx = clamp(3.0 - (zoom - 5) * 0.25, 1.2, 3.2);
    ctx.save();
    ctx.filter = `blur(${blurPx.toFixed(1)}px) saturate(1.06)`;
    ctx.globalCompositeOperation = 'source-over';
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this._offscreen, 0, 0, width, height, tl.x, tl.y, screenW, screenH);
    ctx.restore();

    // Pass 2: 细等值线
    this._drawContourLines(ctx, tl, screenW, screenH, width, height);

    // Pass 3: 关键值标签（70/80）
    this._drawLabels(ctx, tl, screenW, screenH, width, height);
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
  FIRECLOUD_PALETTE,
  SUNRISE_PALETTE,
  RASTER_MIN_SCORE,
  RASTER_FULL_SCORE,
  VISUAL_MIN_SCORE,
  BAND_LEVELS,
  CONTOUR_LEVELS,
  KEY_LABEL_LEVELS,
};
