/**
 * ChinaSpotsOverlay.js - 中国火烧云散点地图覆盖层（Phase 16）
 *
 * 在 Leaflet 地图上渲染来自 /api/spots/china 的高分散点。
 * score >= 80 → 🌅 顶级，60-79 → 🌄 优质
 */

export default class ChinaSpotsOverlay {
  constructor() {
    this._map = null;
    this._markers = [];
    this._updatedAt = null;
    this._visible = false;
  }

  /**
   * 初始化，绑定 Leaflet 地图实例
   * @param {L.Map} leafletMap
   */
  init(leafletMap) {
    this._map = leafletMap;
  }

  /**
   * 从 /api/spots/china 加载数据并在地图上渲染散点
   * @returns {Promise<void>}
   */
  async loadAndRender() {
    if (!this._map) {
      console.warn('[ChinaSpotsOverlay] 地图未初始化，无法渲染');
      return;
    }

    try {
      const res = await fetch('/api/spots/china');
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      this._updatedAt = data.updatedAt || null;

      this.clear();

      if (!data.spots || data.spots.length === 0) {
        console.log('[ChinaSpotsOverlay] 暂无符合条件的散点');
        return;
      }

      data.spots.forEach(spot => {
        const emoji = spot.score >= 80 ? '🌅' : '🌄';
        const icon = L.divIcon({
          html: `<div style="font-size:18px; line-height:1; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.5));">${emoji}</div>`,
          className: '',
          iconSize: [22, 22],
          iconAnchor: [11, 11],
          popupAnchor: [0, -14]
        });

        const marker = L.marker([spot.lat, spot.lon], { icon });
        marker.bindPopup(
          `<div style="font-size:13px; line-height:1.6;">
            <b>${emoji} ${spot.quality}</b><br>
            评分：<b>${spot.score}</b> 分<br>
            位置：${spot.lat.toFixed(1)}°N, ${spot.lon.toFixed(1)}°E
          </div>`,
          { maxWidth: 180 }
        );
        marker.addTo(this._map);
        this._markers.push(marker);
      });

      this._visible = true;
      console.log(`[ChinaSpotsOverlay] 渲染 ${this._markers.length} 个散点`);
    } catch (err) {
      console.error('[ChinaSpotsOverlay] 加载散点失败:', err);
    }
  }

  /** 显示所有散点 */
  show() {
    if (!this._map) return;
    this._markers.forEach(m => {
      if (!this._map.hasLayer(m)) m.addTo(this._map);
    });
    this._visible = true;
  }

  /** 隐藏所有散点（不销毁） */
  hide() {
    if (!this._map) return;
    this._markers.forEach(m => {
      if (this._map.hasLayer(m)) this._map.removeLayer(m);
    });
    this._visible = false;
  }

  /** 清除所有散点并释放内存 */
  clear() {
    if (this._map) {
      this._markers.forEach(m => {
        if (this._map.hasLayer(m)) this._map.removeLayer(m);
      });
    }
    this._markers = [];
    this._visible = false;
  }

  /**
   * 返回数据更新时间（ISO 字符串）
   * @returns {string|null}
   */
  getUpdatedAt() {
    return this._updatedAt;
  }
}
