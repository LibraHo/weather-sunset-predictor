/**
 * ChinaSpotsOverlay.js - 中国火烧云连续图层（Phase 16 增量）
 *
 * - 数据来源：/api/spots/china
 * - 渲染策略：Canvas 径向渐变 + lighter 融合，形成连续火烧云色带
 * - 区域策略：仅渲染中国大陆区域（排除南海远海/台湾区域）
 */

import { isInMainlandChina } from '../utils/mainlandChinaRegion.js';

export const MAINLAND_RENDER_MIN_SCORE = 40;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function alpha(base, scoreNorm) {
  return (base * (0.78 + scoreNorm * 0.32)).toFixed(3);
}

/**
 * 将评分映射到连续视觉样式（半径 + 颜色）
 * @param {number} score
 * @param {number} zoom
 */
export function mapScoreToOverlayStyle(score, zoom = 4) {
  const safeScore = clamp(Number.isFinite(score) ? score : 0, MAINLAND_RENDER_MIN_SCORE, 95);
  const scoreNorm = (safeScore - MAINLAND_RENDER_MIN_SCORE) / (95 - MAINLAND_RENDER_MIN_SCORE);
  const zoomFactor = Math.pow(1.15, Math.max(0, zoom - 5));

  const radiusPx = clamp(lerp(58, 112, scoreNorm) * zoomFactor, 42, 240);

  const warm = {
    r: Math.round(lerp(255, 255, scoreNorm)),
    g: Math.round(lerp(198, 90, scoreNorm)),
    b: Math.round(lerp(92, 8, scoreNorm))
  };
  const glow = {
    r: Math.round(lerp(255, 255, scoreNorm)),
    g: Math.round(lerp(226, 160, scoreNorm)),
    b: Math.round(lerp(145, 40, scoreNorm))
  };

  return {
    radiusPx,
    innerColor: `rgba(${warm.r}, ${warm.g}, ${warm.b}, ${alpha(0.72, scoreNorm)})`,
    midColor: `rgba(${glow.r}, ${glow.g}, ${glow.b}, ${alpha(0.34, scoreNorm)})`,
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
      'white-space: nowrap'
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

  async loadAndRender() {
    if (!this._map) {
      console.warn('[ChinaSpotsOverlay] 地图未初始化，无法渲染');
      return;
    }

    try {
      const res = await fetch('/api/spots/china');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      this._updatedAt = data.updatedAt || null;
      this._spots = Array.isArray(data.spots) ? data.spots.filter(isRenderableMainlandSpot) : [];

      if (this._spots.length === 0) {
        console.log('[ChinaSpotsOverlay] 暂无中国大陆散点数据');
        this.hide();
        return;
      }

      this.show();
      console.log(`[ChinaSpotsOverlay] 已加载并渲染 ${this._spots.length} 个大陆点位`);
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
    ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
    ctx.globalCompositeOperation = 'lighter';

    const zoom = this._map.getZoom();
    this._spots.forEach(spot => {
      const pt = this._map.latLngToContainerPoint(window.L.latLng(spot.lat, spot.lon));
      const { radiusPx, innerColor, midColor, outerColor } = mapScoreToOverlayStyle(spot.score, zoom);

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

  getUpdatedAt() {
    return this._updatedAt;
  }
}
