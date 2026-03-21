/**
 * ChinaSpotsOverlay.js - 中国火烧云连续图层（Phase 16 增量）
 *
 * - 数据来源：/api/spots/china
 * - 渲染策略：Canvas 径向渐变 + lighter 融合，形成连续火烧云色带
 * - 区域策略：仅渲染中国大陆区域（排除南海远海/台湾区域）
 */

import { isInMainlandChina, MAINLAND_BOUNDS } from '../utils/mainlandChinaRegion.js';

export const MAINLAND_RENDER_MIN_SCORE = 40;
const SUPPORTED_SPOT_PERIODS = ['sunrise', 'sunset'];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep01(t) {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

function alpha(base, scoreNorm, zoomOpacityFactor = 1) {
  const raw = base * (0.76 + scoreNorm * 0.38) * zoomOpacityFactor;
  return clamp(raw, 0, 0.95).toFixed(3);
}

function getZoomOpacityFactor(zoom = 5) {
  // 微调高缩放透明度衰减:0.09→0.08,使放大时透明度下降更温和
  return clamp(1.04 - Math.max(0, zoom - 5) * 0.08, 0.66, 1.08);
}

export function getDensityOpacityFactor(spotsInViewCount = 0, zoom = 5) {
  const count = Number.isFinite(spotsInViewCount) ? spotsInViewCount : 0;
  // 微调密度阈值:18→20,使密度适应更温和
  const density = clamp(count / 20, 0, 2.0);
  // 微调透明度衰减斜率:0.2→0.18,使密集区域透明度下降更平缓
  const base = 1.05 - density * 0.18;
  // 微调低缩放补偿:0.04→0.05,使低缩放下略亮
  const zoomCompensation = zoom <= 5 ? 0.05 : 0;
  return clamp(base + zoomCompensation, 0.72, 1.08);
}

export function getMainlandEdgeOpacityFactor(spot, zoom = 5) {
  if (!spot || !Number.isFinite(spot.lat) || !Number.isFinite(spot.lon)) return 1;

  const distToBorderDeg = Math.min(
    spot.lon - MAINLAND_BOUNDS.lonMin,
    MAINLAND_BOUNDS.lonMax - spot.lon,
    spot.lat - MAINLAND_BOUNDS.latMin,
    MAINLAND_BOUNDS.latMax - spot.lat
  );

  // 微调羽化带宽:低缩放时羽化范围更广(3.2→2.8),高缩放时更窄(1.6→1.4)
  const featherBandDeg = clamp(3.2 - (zoom - 4) * 0.32, 1.6, 3.2);
  const t = smoothstep01(clamp(distToBorderDeg / featherBandDeg, 0, 1));
  // 调整最低透明度因子(0.66→0.72),使边缘过渡更柔和
  return clamp(0.72 + t * 0.28, 0.72, 1);
}

export function getCanvasFilterStyle(zoom = 5) {
  // 微调模糊范围:6.2→6.4(低缩放),2.2→2.0(高缩放)
  const blurPx = clamp(6.4 - (zoom - 4) * 0.5, 2.0, 6.4);
  // 微调饱和度提升:1.08→1.10(低缩放),0.95→0.98(高缩放)
  const warmBoost = clamp(1.10 - (zoom - 5) * 0.024, 0.98, 1.10);
  return `blur(${blurPx.toFixed(1)}px) saturate(${warmBoost.toFixed(2)})`;
}

export function getOverlayBlendMode(zoom = 5) {
  // 低缩放优先连续、柔和叠加；高缩放回到 lighter，保留局部层次
  return zoom <= 6 ? 'screen' : 'lighter';
}

function getViewportPaddingDeg(zoom = 5) {
  // 微调缓冲区宽度:3.2→3.0(低缩放),1.1→1.2(高缩放)
  // 低缩放时缓冲略小,高缩放时缓冲略大,避免裁剪边缘闪烁
  return clamp(3.0 - (zoom - 4) * 0.3, 1.2, 3.0);
}

export function normalizeSpotsPeriod(period = 'sunset') {
  const safe = typeof period === 'string' ? period.toLowerCase() : 'sunset';
  return SUPPORTED_SPOT_PERIODS.includes(safe) ? safe : 'sunset';
}

export function isSpotInViewport(spot, viewport) {
  if (!spot || !viewport) return true;
  return (
    spot.lat >= viewport.latMin &&
    spot.lat <= viewport.latMax &&
    spot.lon >= viewport.lonMin &&
    spot.lon <= viewport.lonMax
  );
}

const FIRECLOUD_PALETTE = [
  // 低分：温暖金色（晨曦/黄昏底色）
  { t: 0, rgb: [255, 214, 132] },
  // 中分：橙红色过渡（火焰主体色）
  { t: 0.45, rgb: [255, 158, 74] },
  // 高分：深红橙色（强烈火烧云核心）
  { t: 0.85, rgb: [255, 94, 28] },
  // 极高分：深红紫红（最高温火焰色）
  { t: 1, rgb: [255, 60, 20] }
];

function interpolatePalette(norm) {
  const x = clamp(norm, 0, 1);
  for (let i = 0; i < FIRECLOUD_PALETTE.length - 1; i += 1) {
    const left = FIRECLOUD_PALETTE[i];
    const right = FIRECLOUD_PALETTE[i + 1];
    if (x >= left.t && x <= right.t) {
      const localT = (x - left.t) / (right.t - left.t);
      return {
        r: Math.round(lerp(left.rgb[0], right.rgb[0], localT)),
        g: Math.round(lerp(left.rgb[1], right.rgb[1], localT)),
        b: Math.round(lerp(left.rgb[2], right.rgb[2], localT))
      };
    }
  }

  const [r, g, b] = FIRECLOUD_PALETTE[FIRECLOUD_PALETTE.length - 1].rgb;
  return { r, g, b };
}

export function normalizeOverlayScore(score) {
  const safeScore = clamp(Number.isFinite(score) ? score : 0, MAINLAND_RENDER_MIN_SCORE, 95);
  const linearNorm = (safeScore - MAINLAND_RENDER_MIN_SCORE) / (95 - MAINLAND_RENDER_MIN_SCORE);
  return smoothstep01(linearNorm);
}

export function getPlumeDriftOffset(score, zoom = 5) {
  const scoreNorm = normalizeOverlayScore(score);
  const driftBase = clamp(lerp(8, 20, scoreNorm), 8, 20);
  const zoomFactor = Math.pow(1.06, Math.max(0, zoom - 5));
  const driftPx = clamp(driftBase * zoomFactor, 8, 34);

  // 固定偏东偏北，形成“顺风拉伸”效果，降低同心圆观感
  return {
    x: driftPx,
    y: -driftPx * 0.42
  };
}

/**
 * 将评分映射到连续视觉样式（半径 + 颜色）
 * @param {number} score
 * @param {number} zoom
 */
export function mapScoreToOverlayStyle(score, zoom = 4, opacityFactor = 1) {
  const scoreNorm = normalizeOverlayScore(score);
  const zoomFactor = Math.pow(1.12, Math.max(0, zoom - 5));

  const radiusPx = clamp(lerp(62, 124, scoreNorm) * zoomFactor, 44, 240);
  const haloRadiusPx = clamp(radiusPx * lerp(1.42, 1.88, scoreNorm), radiusPx + 10, 330);
  const plumeRadiusPx = clamp(radiusPx * lerp(1.08, 1.26, scoreNorm), radiusPx + 8, 280);

  const warm = interpolatePalette(scoreNorm);
  const glow = interpolatePalette(clamp(scoreNorm * 0.82, 0, 1));
  const zoomOpacityFactor = getZoomOpacityFactor(zoom) * clamp(opacityFactor, 0.72, 1.08);

  return {
    radiusPx,
    haloRadiusPx,
    plumeRadiusPx,
    haloColor: `rgba(${glow.r}, ${glow.g}, ${glow.b}, ${alpha(0.19, scoreNorm, zoomOpacityFactor)})`,
    plumeColor: `rgba(${glow.r}, ${glow.g}, ${glow.b}, ${alpha(0.15, scoreNorm, zoomOpacityFactor)})`,
    innerColor: `rgba(${warm.r}, ${warm.g}, ${warm.b}, ${alpha(0.76, scoreNorm, zoomOpacityFactor)})`,
    midColor: `rgba(${glow.r}, ${glow.g}, ${glow.b}, ${alpha(0.38, scoreNorm, zoomOpacityFactor)})`,
    outerColor: `rgba(${glow.r}, ${glow.g}, ${glow.b}, 0)`
  };
}

export function isRenderableMainlandSpot(spot) {
  if (!spot || typeof spot !== 'object') return false;
  return (
    Number.isFinite(spot.lat) &&
    Number.isFinite(spot.lon) &&
    Number.isFinite(spot.score) &&
    spot.score >= MAINLAND_RENDER_MIN_SCORE &&
    isInMainlandChina(spot.lat, spot.lon)
  );
}

export default class ChinaSpotsOverlay {
  constructor() {
    this._map = null;
    this._spots = [];
    this._updatedAt = null;
    this._visible = false;
    this._canvas = null;
    this._ctx = null;
    this._button = null;
    this._animFrame = null;
    this._boundRedraw = null;
    this._boundMove = null;
    this._period = 'sunset';
  }

  getSpotCount() {
    return this._spots.length;
  }

  init(leafletMap) {
    this._map = leafletMap;
    this._initCanvas();
    this._initButton();

    this._boundRedraw = () => this._redrawCanvas();
    this._map.on('moveend zoomend resize', this._boundRedraw);

    this._boundMove = () => this._scheduleRedraw();
    this._map.on('move', this._boundMove);
  }

  _initCanvas() {
    const canvas = document.createElement('canvas');
    canvas.style.cssText = [
      'position: absolute',
      'top: 0',
      'left: 0',
      'pointer-events: none',
      'z-index: 450',
      'display: none'
    ].join(';');
    canvas.className = 'china-spots-canvas';

    const container = this._map.getContainer();
    container.style.position = 'relative';
    container.appendChild(canvas);

    this._canvas = canvas;
    this._ctx = canvas.getContext('2d');
  }

  _initButton() {
    const btn = document.createElement('button');
    btn.textContent = '🌅 火烧云';
    btn.className = 'china-spots-toggle-btn';
    btn.style.cssText = [
      'position: absolute',
      'top: 10px',
      'right: 10px',
      'z-index: 1000',
      'padding: 6px 12px',
      'border: 2px solid rgba(255,120,0,0.7)',
      'border-radius: 20px',
      'background: rgba(0,0,0,0.6)',
      'color: #fff',
      'font-size: 13px',
      'cursor: pointer',
      'backdrop-filter: blur(4px)',
      'transition: background 0.2s, border-color 0.2s',
      'white-space: nowrap',
      'display: none'
    ].join(';');

    btn.addEventListener('click', () => this.toggle());
    this._map.getContainer().appendChild(btn);
    this._button = btn;
  }

  _scheduleRedraw() {
    if (!this._visible || this._animFrame) return;
    this._animFrame = requestAnimationFrame(() => {
      this._animFrame = null;
      this._redrawCanvas();
    });
  }

  _setButtonVisibility(visible) {
    if (!this._button) return;
    this._button.style.display = visible ? 'inline-flex' : 'none';
  }

  setButtonVisible(visible) {
    this._setButtonVisibility(Boolean(visible));
  }

  _updateButtonState() {
    if (!this._button) return;
    if (this._visible) {
      this._button.style.background = 'rgba(255, 100, 0, 0.85)';
      this._button.style.borderColor = 'rgba(255,200,50,0.9)';
      this._button.style.boxShadow = '0 0 8px rgba(255,120,0,0.6)';
    } else {
      this._button.style.background = 'rgba(0,0,0,0.6)';
      this._button.style.borderColor = 'rgba(255,120,0,0.7)';
      this._button.style.boxShadow = 'none';
    }
  }

  setPeriod(period) {
    this._period = normalizeSpotsPeriod(period);
  }

  getPeriod() {
    return this._period;
  }

  async loadAndRender(period = this._period) {
    if (!this._map) {
      console.warn('[ChinaSpotsOverlay] 地图未初始化，无法渲染');
      return;
    }

    this._period = normalizeSpotsPeriod(period);

    try {
      const params = new URLSearchParams({ period: this._period });
      const res = await fetch(`/api/spots/china?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      this._updatedAt = data.updatedAt || null;
      this._spots = Array.isArray(data.spots) ? data.spots.filter(isRenderableMainlandSpot) : [];

      if (this._spots.length === 0) {
        console.log('[ChinaSpotsOverlay] 暂无中国大陆散点数据');
        this.hide();
        this._setButtonVisibility(false);
        return;
      }

      this._setButtonVisibility(true);
      this.show();
      console.log(`[ChinaSpotsOverlay] 已加载并渲染 ${this._spots.length} 个大陆点位（${this._period}）`);
    } catch (err) {
      console.error('[ChinaSpotsOverlay] 加载散点失败:', err);
    }
  }

  _redrawCanvas() {
    if (!this._visible || !this._canvas || !this._map || this._spots.length === 0) return;

    const mapSize = this._map.getSize();
    if (this._canvas.width !== mapSize.x || this._canvas.height !== mapSize.y) {
      this._canvas.width = mapSize.x;
      this._canvas.height = mapSize.y;
    }

    const ctx = this._ctx;
    const zoom = this._map.getZoom();

    this._canvas.style.filter = getCanvasFilterStyle(zoom);
    ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
    ctx.globalCompositeOperation = getOverlayBlendMode(zoom);

    let viewport = null;
    if (typeof this._map.getBounds === 'function') {
      const bounds = this._map.getBounds();
      if (
        bounds &&
        typeof bounds.getSouth === 'function' &&
        typeof bounds.getNorth === 'function' &&
        typeof bounds.getWest === 'function' &&
        typeof bounds.getEast === 'function'
      ) {
        const pad = getViewportPaddingDeg(zoom);
        viewport = {
          latMin: bounds.getSouth() - pad,
          latMax: bounds.getNorth() + pad,
          lonMin: bounds.getWest() - pad,
          lonMax: bounds.getEast() + pad
        };
      }
    }

    const spotsToDraw = viewport ? this._spots.filter(spot => isSpotInViewport(spot, viewport)) : this._spots;
    const densityOpacityFactor = getDensityOpacityFactor(spotsToDraw.length, zoom);

    spotsToDraw.forEach(spot => {
      const pt = this._map.latLngToContainerPoint(window.L.latLng(spot.lat, spot.lon));
      const edgeOpacityFactor = getMainlandEdgeOpacityFactor(spot, zoom);
      const opacityFactor = densityOpacityFactor * edgeOpacityFactor;
      const { radiusPx, haloRadiusPx, plumeRadiusPx, haloColor, plumeColor, innerColor, midColor, outerColor } = mapScoreToOverlayStyle(spot.score, zoom, opacityFactor);
      const plumeOffset = getPlumeDriftOffset(spot.score, zoom);

      const plumeGrad = ctx.createRadialGradient(
        pt.x + plumeOffset.x,
        pt.y + plumeOffset.y,
        0,
        pt.x + plumeOffset.x,
        pt.y + plumeOffset.y,
        plumeRadiusPx
      );
      plumeGrad.addColorStop(0.0, plumeColor);
      plumeGrad.addColorStop(1.0, 'rgba(255, 180, 80, 0)');
      ctx.beginPath();
      ctx.arc(pt.x + plumeOffset.x, pt.y + plumeOffset.y, plumeRadiusPx, 0, Math.PI * 2);
      ctx.fillStyle = plumeGrad;
      ctx.fill();

      const haloGrad = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, haloRadiusPx);
      haloGrad.addColorStop(0.0, haloColor);
      haloGrad.addColorStop(1.0, 'rgba(255, 180, 80, 0)');
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, haloRadiusPx, 0, Math.PI * 2);
      ctx.fillStyle = haloGrad;
      ctx.fill();

      const grad = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, radiusPx);
      grad.addColorStop(0.0, innerColor);
      grad.addColorStop(0.46, midColor);
      grad.addColorStop(1.0, outerColor);

      ctx.beginPath();
      ctx.arc(pt.x, pt.y, radiusPx, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    });

    ctx.globalCompositeOperation = 'source-over';
  }

  show() {
    if (!this._map || !this._canvas) return;
    this._visible = true;

    const mapSize = this._map.getSize();
    this._canvas.width = mapSize.x;
    this._canvas.height = mapSize.y;
    this._canvas.style.width = `${mapSize.x}px`;
    this._canvas.style.height = `${mapSize.y}px`;
    this._canvas.style.display = 'block';

    this._redrawCanvas();
    this._updateButtonState();
  }

  hide() {
    if (!this._map || !this._canvas) return;
    this._visible = false;
    this._canvas.style.display = 'none';
    this._updateButtonState();
  }

  toggle() {
    if (this._visible) this.hide();
    else this.show();
  }

  clear() {
    this.hide();
    this._spots = [];
    if (this._ctx && this._canvas) {
      this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
    }
  }

  getSpotCount() {
    return this._spots.length;
  }

  getUpdatedAt() {
    return this._updatedAt;
  }
}
