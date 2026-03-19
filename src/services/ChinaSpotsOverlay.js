/**
 * ChinaSpotsOverlay.js - 中国火烧云连续覆盖层（Phase 16）
 *
 * 目标：做出“连续图层”视觉，而不是散点 marker。
 * 本版本聚焦中国大陆（排除南海插图区域、排除台湾 bbox），
 * 使用 IDW（反距离加权）在画布上生成平滑火烧云概率场。
 */

const MAINLAND_BOUNDS = {
  minLon: 73,
  maxLon: 135,
  minLat: 18,
  maxLat: 54
};

// 当前阶段先排除台湾区域，聚焦中国大陆连续图层
const TAIWAN_EXCLUDE_BBOX = {
  minLon: 119,
  maxLon: 123,
  minLat: 21.5,
  maxLat: 26
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
    if (!this._visible) return;
    if (this._animFrame) return;
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

      const rawSpots = Array.isArray(data.spots) ? data.spots : [];
      this._spots = rawSpots.filter(spot => this._isMainlandCoordinate(spot.lat, spot.lon));

      if (this._spots.length === 0) {
        console.log('[ChinaSpotsOverlay] 暂无中国大陆散点数据');
        this.hide();
        return;
      }

      this.show();
      console.log(`[ChinaSpotsOverlay] 已加载 ${rawSpots.length} 个点，保留大陆点 ${this._spots.length} 个`);
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

    const renderSpots = this._spots
      .filter(spot => Number.isFinite(spot.lat) && Number.isFinite(spot.lon) && Number.isFinite(spot.score))
      .map(spot => {
        const p = this._map.latLngToContainerPoint([spot.lat, spot.lon]);
        return { x: p.x, y: p.y, score: spot.score };
      });

    if (renderSpots.length === 0) return;

    const step = this._map.getZoom() >= 6 ? 8 : 10;
    const influenceRadius = this._map.getZoom() >= 6 ? 140 : 120;

    for (let y = 0; y < this._canvas.height; y += step) {
      for (let x = 0; x < this._canvas.width; x += step) {
        const latLng = this._map.containerPointToLatLng([x + step / 2, y + step / 2]);
        if (!this._isMainlandCoordinate(latLng.lat, latLng.lng)) continue;

        const score = this._sampleScore(renderSpots, x + step / 2, y + step / 2, influenceRadius);
        if (score < 52) continue;

        ctx.globalAlpha = this._scoreToAlpha(score);
        ctx.fillStyle = this._scoreToColor(score);
        ctx.fillRect(x, y, step, step);
      }
    }

    ctx.globalAlpha = 1;
  }

  _sampleScore(spots, x, y, influenceRadius) {
    let weighted = 0;
    let weightSum = 0;

    for (const spot of spots) {
      const dx = x - spot.x;
      const dy = y - spot.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > influenceRadius) continue;

      const w = 1 / Math.max(1, dist * dist);
      weighted += spot.score * w;
      weightSum += w;
    }

    if (weightSum === 0) return 0;
    return weighted / weightSum;
  }

  _scoreToColor(score) {
    if (score >= 82) return '#ff5a00';
    if (score >= 72) return '#ff7a00';
    if (score >= 62) return '#ff9800';
    return '#ffb347';
  }

  _scoreToAlpha(score) {
    if (score >= 82) return 0.50;
    if (score >= 72) return 0.38;
    if (score >= 62) return 0.30;
    return 0.22;
  }

  _isMainlandCoordinate(lat, lon) {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;

    const inChinaRect =
      lon >= MAINLAND_BOUNDS.minLon &&
      lon <= MAINLAND_BOUNDS.maxLon &&
      lat >= MAINLAND_BOUNDS.minLat &&
      lat <= MAINLAND_BOUNDS.maxLat;

    if (!inChinaRect) return false;

    const inTaiwanBox =
      lon >= TAIWAN_EXCLUDE_BBOX.minLon &&
      lon <= TAIWAN_EXCLUDE_BBOX.maxLon &&
      lat >= TAIWAN_EXCLUDE_BBOX.minLat &&
      lat <= TAIWAN_EXCLUDE_BBOX.maxLat;

    return !inTaiwanBox;
  }

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

  hide() {
    if (!this._map) return;
    this._visible = false;
    this._canvas.style.display = 'none';
    this._updateButtonState();
  }

  toggle() {
    if (this._visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  clear() {
    this.hide();
    this._spots = [];
    if (this._ctx) {
      this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
    }
  }

  getUpdatedAt() {
    return this._updatedAt;
  }
}
