/**
 * NativeFireCloudRenderer - 原生 Canvas 火烧云图层
 *
 * 核心特性：拖动中实时跟手（监听 move 事件 + rAF 节流）
 * 挂载到 map 容器，坐标转换由 Leaflet 提供。
 */

function scoreToRGBA(score) {
  if (score < 40) return null;
  if (score < 65) return [255, 200, 50, 110];
  if (score < 80) return [230, 60, 10, 180];
  return [180, 10, 10, 210];
}

class NativeFireCloudRenderer {
  constructor(options = {}) {
    this.proxyURL = (options.proxyURL || '').replace(/\/$/, '');
    this.type     = options.type    || 'sunset';
    this.opacity  = options.opacity != null ? options.opacity : 0.7;

    this._map      = null;
    this._canvas   = null;
    this._ctx      = null;
    this._visible  = false;
    this._rafId    = null;
    this._grid     = null;
    this._gridBbox = null;
    this._fetchTimer = null;
    this._fetching = false;

    this._onMove      = () => this._scheduleFrame();
    this._onZoomStart = () => { if (this._canvas) this._canvas.style.opacity = '0'; };
    this._onZoom      = () => { this._grid = null; this._resetCanvas(); };
    this._onResize    = () => this._resetCanvas();
  }

  init(leafletMap) {
    this._map = leafletMap;
    this._createCanvas();
    this._map.on('move',      this._onMove);
    this._map.on('zoomstart', this._onZoomStart);
    this._map.on('zoom',      this._onZoom);
    this._map.on('resize',    this._onResize);
    this._resetCanvas();
  }

  show() {
    if (!this._map) return;
    this._visible = true;
    if (this._canvas) this._canvas.style.display = 'block';
    this._scheduleFrame();
  }

  hide() {
    this._visible = false;
    if (this._canvas) this._canvas.style.display = 'none';
    if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
  }

  toggle() { this._visible ? this.hide() : this.show(); }

  setType(type) {
    this.type  = type;
    this._grid = null;
    if (this._visible) this._scheduleFrame();
  }

  destroy() {
    this.hide();
    if (this._map) {
      this._map.off('move',      this._onMove);
      this._map.off('zoomstart', this._onZoomStart);
      this._map.off('zoom',      this._onZoom);
      this._map.off('resize',    this._onResize);
    }
    if (this._canvas && this._canvas.parentNode) {
      this._canvas.parentNode.removeChild(this._canvas);
    }
    this._canvas = null;
    this._ctx    = null;
    this._map    = null;
  }

  getStatus() {
    return {
      renderMode:   'canvas-native',
      visible:      this._visible,
      gridCacheHit: !!this._grid,
      degraded:     false
    };
  }

  _createCanvas() {
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:450;display:none';
    canvas.className = 'firecloud-native-canvas';
    const container = this._map.getContainer();
    container.style.position = 'relative';
    container.appendChild(canvas);
    this._canvas = canvas;
    this._ctx    = canvas.getContext('2d');
  }

  _resetCanvas() {
    if (!this._map || !this._canvas) return;
    const size = this._map.getSize();
    this._canvas.width  = size.x;
    this._canvas.height = size.y;
    this._canvas.style.opacity = '1';
    if (this._visible) this._scheduleFrame();
  }

  _scheduleFrame() {
    if (!this._visible || this._rafId) return;
    this._rafId = requestAnimationFrame(() => {
      this._rafId = null;
      this._render();
    });
  }

  _render() {
    if (!this._visible || !this._ctx || !this._map) return;

    const map    = this._map;
    const canvas = this._canvas;
    const ctx    = this._ctx;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!this._grid) {
      this._fetchGrid();
      return;
    }

    const { meta, values } = this._grid;
    const { west, south, east, north } = meta.bbox;
    const { rows, cols } = meta.resolution;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const score = values[r][c];
        if (score < 40) continue;

        const cellLon0 = west  + (c / cols) * (east  - west);
        const cellLat0 = north - (r / rows) * (north - south);
        const cellLon1 = west  + ((c + 1) / cols) * (east  - west);
        const cellLat1 = north - ((r + 1) / rows) * (north - south);

        const pt0 = map.latLngToContainerPoint([cellLat0, cellLon0]);
        const pt1 = map.latLngToContainerPoint([cellLat1, cellLon1]);

        const px = Math.round(Math.min(pt0.x, pt1.x));
        const py = Math.round(Math.min(pt0.y, pt1.y));
        const pw = Math.ceil(Math.abs(pt1.x - pt0.x)) || 1;
        const ph = Math.ceil(Math.abs(pt1.y - pt0.y)) || 1;

        const rgba = scoreToRGBA(score);
        if (!rgba) continue;

        const [r_, g, b, a] = rgba;
        ctx.fillStyle = `rgba(${r_},${g},${b},${(a / 255 * this.opacity).toFixed(2)})`;
        ctx.fillRect(px, py, pw, ph);
      }
    }

    this._checkAndRefetch();
  }

  _checkAndRefetch() {
    if (!this._grid || !this._map) return;
    const bounds = this._map.getBounds();
    const { west, south, east, north } = this._grid.meta.bbox;
    const margin = 0.5;
    if (bounds.getWest()  < west  + margin ||
        bounds.getSouth() < south + margin ||
        bounds.getEast()  > east  - margin ||
        bounds.getNorth() > north - margin) {
      this._fetchGridDebounced();
    }
  }

  _fetchGridDebounced() {
    if (this._fetchTimer) clearTimeout(this._fetchTimer);
    this._fetchTimer = setTimeout(() => {
      this._fetchTimer = null;
      this._grid = null;
      this._fetchGrid();
    }, 500);
  }

  async _fetchGrid() {
    if (this._fetching || !this._map) return;

    const bounds = this._map.getBounds();
    const pad    = 1.5;
    const west   = (bounds.getWest()  - pad).toFixed(4);
    const south  = (bounds.getSouth() - pad).toFixed(4);
    const east   = (bounds.getEast()  + pad).toFixed(4);
    const north  = (bounds.getNorth() + pad).toFixed(4);
    const zoom   = this._map.getZoom();
    const bbox   = `${west},${south},${east},${north}`;

    if (bbox === this._gridBbox) return;

    this._fetching = true;
    try {
      const url = `${this.proxyURL}/api/firecloud/grid?bbox=${bbox}&zoom=${zoom}&time=${Date.now()}&type=${this.type}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error(`grid API ${res.status}`);
      const data = await res.json();
      this._grid    = data;
      this._gridBbox = bbox;
      this._scheduleFrame();
    } catch (err) {
      console.warn('[NativeFireCloudRenderer] 拉取网格失败:', err.message);
      setTimeout(() => { this._fetching = false; }, 3000);
      return;
    }
    this._fetching = false;
  }
}

export default NativeFireCloudRenderer;
export { scoreToRGBA };
