/**
 * ChinaSpotsOverlay.js - 中国火烧云连续渐变图层（Phase 16）
 *
 * 目标：贴近参考图的“连续云层”观感，避免雷达式离散斑点。
 * - 使用 /api/spots/china 的离散评分点
 * - 在 Canvas 上做核密度插值，生成连续色带
 * - 严格限制到中国大陆粗边界（72-135E, 18-53N）
 */

const MAINLAND_BOUNDS = {
  lonMin: 72,
  lonMax: 135,
  latMin: 18,
  latMax: 53
};

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

  /**
   * 初始化，绑定 Leaflet 地图实例，创建 canvas layer + 控制按钮
   * @param {L.Map} leafletMap
   */
  init(leafletMap) {
    this._map = leafletMap;
    this._initCanvas();
    this._initButton();
    this._boundRedraw = () => this._redrawCanvas();
    this._map.on('moveend zoomend resize', this._boundRedraw);

    // 拖动中实时重绘（rAF 节流）
    this._boundMove = () => this._scheduleRedraw();
    this._map.on('move', this._boundMove);
  }

  /** 创建并挂载 Canvas 覆盖层 */
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

    // 挂到地图容器本身（不是 overlayPane，避免 Leaflet transform 偏移影响绘制坐标）
    const container = this._map.getContainer();
    container.style.position = 'relative';
    container.appendChild(canvas);

    this._canvas = canvas;
    this._ctx = canvas.getContext('2d');
  }

  /** 在右上角注入开关按钮 */
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

  /**
   * rAF 节流重绘（用于 move 事件）
   */
  _scheduleRedraw() {
    if (!this._visible) return;
    if (this._animFrame) return;
    this._animFrame = requestAnimationFrame(() => {
      this._animFrame = null;
      this._redrawCanvas();
    });
  }

  /** 更新按钮高亮状态 */
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

  _isMainlandChina(lat, lon) {
    return lon >= MAINLAND_BOUNDS.lonMin
      && lon <= MAINLAND_BOUNDS.lonMax
      && lat >= MAINLAND_BOUNDS.latMin
      && lat <= MAINLAND_BOUNDS.latMax;
  }

  _normalizeSpots(spots = []) {
    return spots
      .filter(s => Number.isFinite(s?.lat) && Number.isFinite(s?.lon) && Number.isFinite(s?.score))
      .filter(s => this._isMainlandChina(s.lat, s.lon))
      .map(s => ({
        lat: s.lat,
        lon: s.lon,
        score: Math.max(0, Math.min(100, s.score))
      }));
  }

  /**
   * 从 /api/spots/china 加载数据并渲染
   * @returns {Promise<void>}
   */
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
      this._spots = this._normalizeSpots(data.spots || []);

      if (this._spots.length === 0) {
        this.clear();
        console.log('[ChinaSpotsOverlay] 暂无可渲染点位');
        return;
      }

      this.show();
      console.log(`[ChinaSpotsOverlay] 已加载 ${this._spots.length} 个点，连续图层渲染完成`);
    } catch (err) {
      console.error('[ChinaSpotsOverlay] 加载散点失败:', err);
    }
  }

  _scoreToColor(score, alphaScale = 1) {
    // 60-100 分映射到暖色连续色带（黄 -> 橙 -> 红）
    const t = Math.max(0, Math.min(1, (score - 60) / 40));

    const r = Math.round(255);
    const g = Math.round(228 - 160 * t);
    const b = Math.round(86 - 78 * t);
    const a = (0.16 + 0.70 * t) * alphaScale;

    return `rgba(${r}, ${g}, ${Math.max(0, b)}, ${Math.max(0, Math.min(0.92, a))})`;
  }

  _buildProjectedSpots() {
    return this._spots.map(spot => {
      const pt = this._map.latLngToContainerPoint(window.L.latLng(spot.lat, spot.lon));
      const zoom = this._map.getZoom();
      const baseRadius = spot.score >= 85 ? 150 : spot.score >= 75 ? 120 : 95;
      const radius = Math.max(64, Math.min(280, baseRadius * Math.pow(1.1, Math.max(0, zoom - 5))));
      return {
        x: pt.x,
        y: pt.y,
        score: spot.score,
        radius
      };
    });
  }

  _sampleScoreAt(px, py, projectedSpots) {
    let weightSum = 0;
    let scoreSum = 0;

    projectedSpots.forEach(spot => {
      const dx = px - spot.x;
      const dy = py - spot.y;
      const d2 = dx * dx + dy * dy;
      const sigma = spot.radius * 0.55;
      const sigma2 = sigma * sigma;
      if (d2 > sigma2 * 6.2) return;

      const w = Math.exp(-d2 / (2 * sigma2));
      weightSum += w;
      scoreSum += w * spot.score;
    });

    if (weightSum < 0.018) {
      return null;
    }

    return {
      score: scoreSum / weightSum,
      density: Math.min(1, weightSum / 0.9)
    };
  }

  /** 重绘 Canvas 连续渐变图层 */
  _redrawCanvas() {
    if (!this._visible || !this._canvas || !this._map || this._spots.length === 0) return;

    const mapSize = this._map.getSize();
    if (this._canvas.width !== mapSize.x || this._canvas.height !== mapSize.y) {
      this._canvas.width = mapSize.x;
      this._canvas.height = mapSize.y;
    }

    const ctx = this._ctx;
    const width = this._canvas.width;
    const height = this._canvas.height;

    ctx.clearRect(0, 0, width, height);

    const projectedSpots = this._buildProjectedSpots();
    const cell = Math.max(8, Math.min(18, Math.round(Math.min(width, height) / 50)));

    ctx.globalCompositeOperation = 'source-over';

    for (let y = 0; y < height; y += cell) {
      for (let x = 0; x < width; x += cell) {
        const sample = this._sampleScoreAt(x + cell * 0.5, y + cell * 0.5, projectedSpots);
        if (!sample) continue;

        const score = Math.max(60, sample.score);
        const alphaScale = 0.25 + 0.85 * sample.density;
        ctx.fillStyle = this._scoreToColor(score, alphaScale);
        ctx.fillRect(x, y, cell + 1, cell + 1);
      }
    }

    // 轻模糊，消除网格感
    if (typeof ctx.drawImage === 'function') {
      ctx.save?.();
      ctx.globalCompositeOperation = 'source-over';
      ctx.filter = 'blur(10px)';
      ctx.drawImage(this._canvas, 0, 0);
      ctx.filter = 'none';
      ctx.restore?.();
    }
  }

  /** 显示图层 */
  show() {
    if (!this._map) return;
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

  /** 隐藏图层 */
  hide() {
    if (!this._map) return;
    this._visible = false;
    this._canvas.style.display = 'none';
    this._updateButtonState();
  }

  /** 切换显示/隐藏 */
  toggle() {
    if (this._visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /** 完全清除（含 canvas 内容） */
  clear() {
    this.hide();
    this._spots = [];
    if (this._ctx) {
      this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
    }
  }

  /**
   * 返回数据更新时间（ISO 字符串）
   * @returns {string|null}
   */
  getUpdatedAt() {
    return this._updatedAt;
  }
}
