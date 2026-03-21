/**
 * ChinaRasterOverlay.js - 中国大陆火烧云连续栅格渲染器
 *
 * 使用 /api/spots/china/raster（IDW 插值）接口，
 * 在 Leaflet 地图上以 ImageData 像素级渲染连续火烧云色层。
 *
 * 视觉目标：贴近参考火烧云叠加风格（连续色带、非散点圆圈）。
 *
 * 架构：
 *  - 数据来源：GET /api/spots/china/raster?period=sunset&resolution=0.5
 *  - 渲染路径：raster values[] → ImageData 像素着色 → canvas drawImage → CSS transform 定位
 *  - 事件监听：moveend / zoomend / resize → 重定位 canvas（不重新插值）
 *  - 动态分辨率：高缩放时请求 resolution=0.25，低缩放时 resolution=0.5
 */

import { isInMainlandChina, MAINLAND_BOUNDS } from '../utils/mainlandChinaRegion.js';

// ─── 常量 ────────────────────────────────────────────────────────────────────

const RASTER_MIN_SCORE = 30;   // 低于此分值的格元不渲染（透明）
const RASTER_FULL_SCORE = 95;  // 色板上限

/**
 * 火烧云色板（t ∈ [0,1] → RGBA）
 * t=0 对应 RASTER_MIN_SCORE，t=1 对应 RASTER_FULL_SCORE
 */
const FIRECLOUD_PALETTE = [
  { t: 0.00, r: 255, g: 214, b: 132, a: 0.00 }, // 透明过渡起点
  { t: 0.10, r: 255, g: 200, b: 110, a: 0.18 }, // 金黄晨曦底色
  { t: 0.30, r: 255, g: 170, b:  80, a: 0.42 }, // 橙黄
  { t: 0.55, r: 255, g: 120, b:  40, a: 0.62 }, // 深橙
  { t: 0.75, r: 255, g:  80, b:  18, a: 0.75 }, // 火红橙
  { t: 1.00, r: 255, g:  55, b:  15, a: 0.85 }, // 极值深红橙
];

// ─── 工具函数 ─────────────────────────────────────────────────────────────────

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function lerp(a, b, t) { return a + (b - a) * t; }

function smoothstep01(t) {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

/**
 * 将 score 映射到色板颜色（返回 {r,g,b,a}）
 * score < RASTER_MIN_SCORE → 透明
 */
function scoreToRGBA(score, noDataValue = -1) {
  if (score === noDataValue || score < RASTER_MIN_SCORE) {
    return { r: 0, g: 0, b: 0, a: 0 };
  }

  const raw = clamp(score, RASTER_MIN_SCORE, RASTER_FULL_SCORE);
  const t = smoothstep01((raw - RASTER_MIN_SCORE) / (RASTER_FULL_SCORE - RASTER_MIN_SCORE));

  // 色板插值
  for (let i = 0; i < FIRECLOUD_PALETTE.length - 1; i++) {
    const lo = FIRECLOUD_PALETTE[i];
    const hi = FIRECLOUD_PALETTE[i + 1];
    if (t >= lo.t && t <= hi.t) {
      const lt = (t - lo.t) / (hi.t - lo.t);
      return {
        r: Math.round(lerp(lo.r, hi.r, lt)),
        g: Math.round(lerp(lo.g, hi.g, lt)),
        b: Math.round(lerp(lo.b, hi.b, lt)),
        a: clamp(lerp(lo.a, hi.a, lt), 0, 1),
      };
    }
  }

  const last = FIRECLOUD_PALETTE[FIRECLOUD_PALETTE.length - 1];
  return { r: last.r, g: last.g, b: last.b, a: last.a };
}

/**
 * 根据缩放等级决定请求分辨率
 */
export function resolutionForZoom(zoom) {
  if (zoom >= 7) return 0.25;
  if (zoom >= 6) return 0.3;
  return 0.5;
}

// ─── 主类 ─────────────────────────────────────────────────────────────────────

export default class ChinaRasterOverlay {
  constructor() {
    this._map = null;
    this._canvas = null;       // 显示用 canvas（叠在地图上）
    this._offscreen = null;    // 离屏 canvas（存储栅格像素）
    this._offCtx = null;

    this._rasterData = null;   // 最近一次加载的栅格元数据 + values
    this._period = 'sunset';
    this._visible = false;
    this._loading = false;

    this._updatedAt = null;

    // 事件绑定句柄
    this._boundReproject = null;
    this._boundSchedule = null;
    this._rafHandle = null;
  }

  // ── 初始化 ─────────────────────────────────────────────────────────────────

  /**
   * @param {L.Map} leafletMap - Leaflet 地图实例
   */
  init(leafletMap) {
    this._map = leafletMap;
    this._createCanvas();

    this._boundReproject = () => this._reprojectCanvas();
    this._boundSchedule  = () => this._scheduleReproject();

    this._map.on('moveend zoomend resize', this._boundReproject);
    this._map.on('move',                   this._boundSchedule);
  }

  _createCanvas() {
    const canvas = document.createElement('canvas');
    canvas.style.cssText = [
      'position:absolute',
      'top:0',
      'left:0',
      'pointer-events:none',
      'z-index:448',        // 低于 ChinaSpotsOverlay(450)，叠加顺序：栅格在下，散点在上
      'display:none',
      'image-rendering:pixelated',
    ].join(';');
    canvas.className = 'china-raster-canvas';

    const container = this._map.getContainer();
    container.style.position = 'relative';
    container.appendChild(canvas);
    this._canvas = canvas;
  }

  // ── 公开 API ───────────────────────────────────────────────────────────────

  setPeriod(period) {
    const safe = ['sunrise', 'sunset'].includes(period) ? period : 'sunset';
    this._period = safe;
  }

  getPeriod() { return this._period; }

  getUpdatedAt() { return this._updatedAt; }

  isVisible() { return this._visible; }

  /**
   * 加载栅格数据并渲染（若已有缓存数据则复用）
   * @param {string} [period]
   */
  async loadAndRender(period = this._period) {
    this.setPeriod(period);
    if (this._loading) return;

    this._loading = true;
    try {
      const zoom = this._map ? this._map.getZoom() : 5;
      const resolution = resolutionForZoom(zoom);

      const params = new URLSearchParams({
        period: this._period,
        resolution: String(resolution),
      });

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
    this._offscreen = null;
    this._offCtx = null;
  }

  // ── 离屏渲染（栅格 → ImageData） ──────────────────────────────────────────

  /**
   * 将 API 返回的 values[] 渲染到离屏 canvas
   * 只在数据变化时调用一次（不随地图移动重绘）
   */
  _buildOffscreen(data) {
    const { width, height, values, noData = -1 } = data;
    if (!width || !height || !Array.isArray(values) || values.length !== width * height) {
      console.warn('[ChinaRasterOverlay] 栅格数据格式异常', { width, height, valLen: values?.length });
      return;
    }

    // 创建或复用离屏 canvas
    if (!this._offscreen) {
      this._offscreen = document.createElement('canvas');
      this._offCtx = this._offscreen.getContext('2d');
    }
    this._offscreen.width = width;
    this._offscreen.height = height;

    const imgData = this._offCtx.createImageData(width, height);
    const buf = imgData.data; // Uint8ClampedArray, row-major

    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const idx = row * width + col;
        const score = values[idx];
        const { r, g, b, a } = scoreToRGBA(score, noData);
        const px = idx * 4;
        buf[px]     = r;
        buf[px + 1] = g;
        buf[px + 2] = b;
        buf[px + 3] = Math.round(a * 255);
      }
    }

    this._offCtx.putImageData(imgData, 0, 0);
    console.log(`[ChinaRasterOverlay] 离屏栅格已构建 ${width}×${height}，period=${this._period}`);
  }

  // ── 地图定位（地理坐标 → 屏幕坐标）────────────────────────────────────────

  /**
   * 将离屏 canvas 重投影到当前地图视图
   * 每次地图移动/缩放时调用
   */
  _reprojectCanvas() {
    if (!this._visible || !this._canvas || !this._rasterData || !this._offscreen || !this._map) return;

    const data = this._rasterData;
    const { bbox, resolution, width, height } = data;
    if (!bbox || !resolution || !width || !height) return;

    // 计算栅格四角的屏幕坐标
    const tl = this._map.latLngToContainerPoint(window.L.latLng(bbox.north, bbox.west));
    const br = this._map.latLngToContainerPoint(window.L.latLng(bbox.south, bbox.east));

    const screenW = Math.round(Math.abs(br.x - tl.x));
    const screenH = Math.round(Math.abs(br.y - tl.y));

    if (screenW <= 0 || screenH <= 0) return;

    // 调整主 canvas 尺寸与地图容器一致
    const mapSize = this._map.getSize();
    this._canvas.width  = mapSize.x;
    this._canvas.height = mapSize.y;
    this._canvas.style.width  = `${mapSize.x}px`;
    this._canvas.style.height = `${mapSize.y}px`;

    const ctx = this._canvas.getContext('2d');
    ctx.clearRect(0, 0, mapSize.x, mapSize.y);

    // 应用 CSS blur 平滑（视觉参考风格）
    const zoom = this._map.getZoom();
    const blurPx = clamp(5 - (zoom - 4) * 0.6, 1.5, 5);
    this._canvas.style.filter = `blur(${blurPx.toFixed(1)}px) saturate(1.1)`;

    // 将离屏栅格绘制到地图上对应的地理区域
    ctx.drawImage(this._offscreen, 0, 0, width, height, tl.x, tl.y, screenW, screenH);
  }

  _scheduleReproject() {
    if (!this._visible || this._rafHandle) return;
    this._rafHandle = requestAnimationFrame(() => {
      this._rafHandle = null;
      this._reprojectCanvas();
    });
  }

  // ── 清理 ───────────────────────────────────────────────────────────────────

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
    this._map = null;
  }
}

// ─── 纯函数导出（方便测试）────────────────────────────────────────────────────

export { scoreToRGBA, FIRECLOUD_PALETTE, RASTER_MIN_SCORE, RASTER_FULL_SCORE };
