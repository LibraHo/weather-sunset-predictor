/**
 * HeatmapLayer - 晚霞评分热力地图渲染（Phase 16）
 *
 * 基于 Leaflet Canvas Overlay，将网格评分双线性插值渲染为热力图
 */

// 颜色阈值配置（与评分体系一致）
const COLOR_THRESHOLDS = [
  { min: 80, color: [255, 69, 0],   alpha: 0.75 },  // #FF4500 深橙红：顶级
  { min: 65, color: [255, 140, 0],  alpha: 0.65 },  // #FF8C00 橙色：优质
  { min: 50, color: [255, 209, 102], alpha: 0.5  },  // #FFD166 金黄：还行
  // < 50：透明不渲染
];

/**
 * 根据评分返回 [r, g, b, a] 颜色
 * @param {number} score
 * @returns {[number, number, number, number] | null} null 表示不渲染
 */
function scoreToColor(score) {
  for (const threshold of COLOR_THRESHOLDS) {
    if (score >= threshold.min) {
      const [r, g, b] = threshold.color;
      return [r, g, b, Math.round(threshold.alpha * 255)];
    }
  }
  return null; // < 50，不渲染
}

/**
 * 双线性插值
 * @param {number} x - 目标经度
 * @param {number} y - 目标纬度
 * @param {{ lat, lon, score }[]} points - 网格点
 * @param {number} step - 网格间距（度）
 * @returns {number | null}
 */
function bilinearInterpolate(x, y, points, step = 5) {
  // 找到四个角点
  const x0 = Math.floor(x / step) * step;
  const x1 = x0 + step;
  const y0 = Math.floor(y / step) * step;
  const y1 = y0 + step;

  const find = (lat, lon) => {
    const p = points.find(p => Math.abs(p.lat - lat) < 0.01 && Math.abs(p.lon - lon) < 0.01);
    return p && p.score !== null ? p.score : null;
  };

  const q00 = find(y0, x0);
  const q10 = find(y1, x0);
  const q01 = find(y0, x1);
  const q11 = find(y1, x1);

  // 若任一角点缺失，回退到最近点
  const validPoints = [
    q00 !== null ? { score: q00, lat: y0, lon: x0 } : null,
    q10 !== null ? { score: q10, lat: y1, lon: x0 } : null,
    q01 !== null ? { score: q01, lat: y0, lon: x1 } : null,
    q11 !== null ? { score: q11, lat: y1, lon: x1 } : null,
  ].filter(Boolean);

  if (validPoints.length === 0) return null;
  if (validPoints.length < 4) {
    // 最近点回退
    let nearest = null, minDist = Infinity;
    for (const p of validPoints) {
      const d = Math.hypot(p.lat - y, p.lon - x);
      if (d < minDist) { minDist = d; nearest = p; }
    }
    return nearest.score;
  }

  // 标准双线性插值
  const tx = (x - x0) / step;
  const ty = (y - y0) / step;
  return (
    q00 * (1 - tx) * (1 - ty) +
    q01 * tx * (1 - ty) +
    q10 * (1 - tx) * ty +
    q11 * tx * ty
  );
}

class HeatmapLayer {
  constructor(proxyURL = '') {
    this.proxyURL = proxyURL.replace(/\/$/, '');
    this._map = null;
    this._canvas = null;
    this._ctx = null;
    this._visible = false;
    this._gridData = null; // { updatedAt, gridPoints }
    this._overlay = null; // Leaflet layer
  }

  /**
   * 初始化：绑定 Leaflet 地图
   * @param {L.Map} leafletMap
   */
  init(leafletMap) {
    this._map = leafletMap;
    this._createCanvasOverlay();
    leafletMap.on('moveend zoomend', () => this._redraw());
  }

  /**
   * 从后端加载网格数据
   */
  async loadData() {
    try {
      const resp = await fetch(`${this.proxyURL}/api/heatmap/grid`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      this._gridData = data;
      console.log(`[HeatmapLayer] 加载完成，${data.count} 个网格点，更新于 ${data.updatedAt}`);
      return data;
    } catch (err) {
      console.error('[HeatmapLayer] 加载网格数据失败:', err.message);
      throw err;
    }
  }

  /**
   * 显示/隐藏图层
   * @param {boolean} visible
   */
  toggle(visible) {
    this._visible = visible;
    if (this._canvas) {
      this._canvas.style.display = visible ? 'block' : 'none';
    }
    if (visible && this._gridData) {
      this._redraw();
    }
  }

  /**
   * 获取指定坐标的插值评分
   * @param {number} lat
   * @param {number} lon
   * @returns {number | null}
   */
  getScoreAt(lat, lon) {
    if (!this._gridData?.gridPoints) return null;
    return bilinearInterpolate(lon, lat, this._gridData.gridPoints);
  }

  /**
   * 获取数据更新时间（本地时间字符串）
   * @returns {string | null}
   */
  getUpdatedAtLabel() {
    if (!this._gridData?.updatedAt) return null;
    const d = new Date(this._gridData.updatedAt);
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }

  // ---- 私有方法 ----

  _createCanvasOverlay() {
    if (!window.L) return;
    // 使用 Leaflet canvas overlay（自定义 layer）
    const self = this;
    const CanvasLayer = window.L.Layer.extend({
      onAdd(map) {
        self._canvas = document.createElement('canvas');
        self._canvas.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;';
        self._ctx = self._canvas.getContext('2d');
        map.getPanes().overlayPane.appendChild(self._canvas);
        map.on('viewreset', self._reset, self);
        self._reset();
      },
      onRemove(map) {
        map.getPanes().overlayPane.removeChild(self._canvas);
        map.off('viewreset', self._reset, self);
      }
    });
    this._overlay = new CanvasLayer();
    this._overlay.addTo(this._map);
  }

  _reset() {
    if (!this._map || !this._canvas) return;
    const mapSize = this._map.getSize();
    this._canvas.width = mapSize.x;
    this._canvas.height = mapSize.y;
    const topLeft = this._map.containerPointToLayerPoint([0, 0]);
    window.L.DomUtil.setPosition(this._canvas, topLeft);
    this._redraw();
  }

  _redraw() {
    if (!this._visible || !this._gridData?.gridPoints || !this._ctx) return;

    const canvas = this._canvas;
    const ctx = this._ctx;
    const map = this._map;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const points = this._gridData.gridPoints.filter(p => p.score !== null);
    if (points.length === 0) return;

    // 渲染分辨率：每个像素格子代表多少度
    const pixelStep = 0.5; // 0.5° 分辨率插值

    // 获取当前地图边界
    const bounds = map.getBounds();
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();

    for (let lat = sw.lat; lat <= ne.lat; lat += pixelStep) {
      for (let lon = sw.lng; lon <= ne.lng; lon += pixelStep) {
        const score = bilinearInterpolate(lon, lat, points);
        if (score === null) continue;

        const rgba = scoreToColor(score);
        if (!rgba) continue; // < 50，跳过

        const [r, g, b, a] = rgba;
        const pt = map.latLngToContainerPoint([lat, lon]);
        const ptNext = map.latLngToContainerPoint([lat + pixelStep, lon + pixelStep]);
        const w = Math.max(1, Math.abs(ptNext.x - pt.x));
        const h = Math.max(1, Math.abs(ptNext.y - pt.y));

        ctx.fillStyle = `rgba(${r},${g},${b},${(a / 255).toFixed(2)})`;
        ctx.fillRect(Math.round(pt.x), Math.round(pt.y), Math.ceil(w), Math.ceil(h));
      }
    }
  }
}

export default HeatmapLayer;
export { scoreToColor, bilinearInterpolate };
