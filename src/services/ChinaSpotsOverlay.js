/**
 * ChinaSpotsOverlay.js - 中国火烧云渐变图层覆盖层（Phase 16）
 *
 * 在 Leaflet 地图上渲染来自 /api/spots/china 的评分热力渐变图层。
 * 使用 HTML5 Canvas 自定义图层实现天气 App 风格的颜色渐变效果。
 */

export default class ChinaSpotsOverlay {
  constructor() {
    this._map = null;
    this._spots = [];
    this._markers = [];
    this._updatedAt = null;
    this._visible = false;
    this._canvas = null;
    this._ctx = null;
    this._button = null;
    this._animFrame = null;
    this._boundRedraw = null;
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
  }

  /** 创建并挂载 Canvas 覆盖层 */
  _initCanvas() {
    const canvas = document.createElement('canvas');
    canvas.style.cssText = [
      'position: absolute',
      'top: 0',
      'left: 0',
      'width: 100%',
      'height: 100%',
      'pointer-events: none',
      'z-index: 400',
      'display: none'
    ].join(';');
    canvas.className = 'china-spots-canvas';

    // 挂载到 Leaflet 的 overlayPane
    const pane = this._map.getPanes().overlayPane;
    pane.appendChild(canvas);

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

  /**
   * 从 /api/spots/china 加载数据并在地图上渲染
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
      this._spots = data.spots || [];

      // 清除旧 markers
      this._clearMarkers();

      if (this._spots.length === 0) {
        console.log('[ChinaSpotsOverlay] 暂无散点数据');
        return;
      }

      // 高分点（≥70）添加小 marker
      this._spots.forEach(spot => {
        if (spot.score < 50) return;

        const emoji = spot.score >= 80 ? '🌅' : '🌄';
        const size = spot.score >= 80 ? 16 : 13;
        const icon = window.L.divIcon({
          html: `<div style="font-size:${size}px; line-height:1; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.6));">${emoji}</div>`,
          className: '',
          iconSize: [size + 4, size + 4],
          iconAnchor: [(size + 4) / 2, (size + 4) / 2],
          popupAnchor: [0, -(size + 4) / 2 - 2]
        });

        const qualityLabel = spot.score >= 80 ? '顶级' : spot.score >= 65 ? '优质' : spot.score >= 50 ? '良好' : '一般';
        const marker = window.L.marker([spot.lat, spot.lon], { icon });
        marker.bindPopup(
          `<div style="font-size:13px; line-height:1.7;">
            <b>${emoji} ${qualityLabel}</b><br>
            评分：<b>${spot.score}</b> 分<br>
            位置：${spot.lat.toFixed(2)}°N, ${spot.lon.toFixed(2)}°E
          </div>`,
          { maxWidth: 180 }
        );
        marker.addTo(this._map);
        this._markers.push(marker);
      });

      this.show();
      console.log(`[ChinaSpotsOverlay] 已加载 ${this._spots.length} 个点，渲染 ${this._markers.length} 个 marker`);
    } catch (err) {
      console.error('[ChinaSpotsOverlay] 加载散点失败:', err);
    }
  }

  /** 重绘 Canvas 渐变图层 */
  _redrawCanvas() {
    if (!this._visible || !this._canvas || !this._map || this._spots.length === 0) return;

    const mapSize = this._map.getSize();
    // 同步 canvas 尺寸与地图像素尺寸
    if (this._canvas.width !== mapSize.x || this._canvas.height !== mapSize.y) {
      this._canvas.width = mapSize.x;
      this._canvas.height = mapSize.y;
    }

    const ctx = this._ctx;
    ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);

    // 获取当前左上角地图像素原点偏移（Leaflet 在平移时移动 overlayPane）
    const topLeft = this._map.containerPointToLayerPoint([0, 0]);

    this._spots.forEach(spot => {
      if (spot.score < 40) return;

      // 经纬度 → 容器像素坐标
      const containerPt = this._map.latLngToContainerPoint(window.L.latLng(spot.lat, spot.lon));
      const x = containerPt.x;
      const y = containerPt.y;

      // 300km 约对应的像素半径（根据当前缩放级别计算）
      const metersPerPixel = this._getMetersPerPixel(spot.lat);
      const radiusPx = Math.max(30, 300000 / metersPerPixel);

      // 根据分数选颜色
      let innerColor, outerColor;
      if (spot.score >= 80) {
        innerColor = 'rgba(255, 69, 0, 0.6)';
        outerColor = 'rgba(255, 69, 0, 0)';
      } else if (spot.score >= 60) {
        innerColor = 'rgba(255, 165, 0, 0.5)';
        outerColor = 'rgba(255, 165, 0, 0)';
      } else {
        // 40-59
        innerColor = 'rgba(255, 220, 50, 0.4)';
        outerColor = 'rgba(255, 220, 50, 0)';
      }

      const grad = ctx.createRadialGradient(x, y, 0, x, y, radiusPx);
      grad.addColorStop(0, innerColor);
      grad.addColorStop(0.5, innerColor.replace(/[\d.]+\)$/, s => `${parseFloat(s) * 0.5})`));
      grad.addColorStop(1, outerColor);

      ctx.beginPath();
      ctx.arc(x, y, radiusPx, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    });
  }

  /** 计算当前纬度每像素对应的实际米数 */
  _getMetersPerPixel(lat) {
    const zoom = this._map.getZoom();
    // Leaflet 标准公式
    return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom);
  }

  /** 显示图层 */
  show() {
    if (!this._map) return;
    this._visible = true;
    this._canvas.style.display = 'block';
    // markers 显示
    this._markers.forEach(m => {
      if (!this._map.hasLayer(m)) m.addTo(this._map);
    });
    this._redrawCanvas();
    this._updateButtonState();
  }

  /** 隐藏图层 */
  hide() {
    if (!this._map) return;
    this._visible = false;
    this._canvas.style.display = 'none';
    // 隐藏 markers
    this._markers.forEach(m => {
      if (this._map.hasLayer(m)) this._map.removeLayer(m);
    });
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

  /** 清除 markers */
  _clearMarkers() {
    if (this._map) {
      this._markers.forEach(m => {
        if (this._map.hasLayer(m)) this._map.removeLayer(m);
      });
    }
    this._markers = [];
  }

  /** 完全清除（含 canvas 内容） */
  clear() {
    this.hide();
    this._clearMarkers();
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
