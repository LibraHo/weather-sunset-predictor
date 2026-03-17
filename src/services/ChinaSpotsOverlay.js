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
    // 用 rAF 节流：拖动时每帧最多重绘一次，保证跟手流畅
    this._boundRedraw = () => {
      if (this._animFrame) return;
      this._animFrame = requestAnimationFrame(() => {
        this._animFrame = null;
        this._redrawCanvas();
      });
    };
    // move 实时跟手，zoomend/resize 补充
    this._map.on('move zoom moveend zoomend resize', this._boundRedraw);
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

    // 叠加模式：让多个热点颜色自然融合，避免只看到零散点
    ctx.globalCompositeOperation = 'lighter';

    this._spots.forEach(spot => {
      if (spot.score < 40) return;

      // 经纬度 → 容器像素坐标
      const containerPt = this._map.latLngToContainerPoint(window.L.latLng(spot.lat, spot.lon));
      const x = containerPt.x;
      const y = containerPt.y;

      // 采用“屏幕像素半径”而非 300km 实际半径，保证手机端可视效果
      const zoom = this._map.getZoom();
      const zoomScale = Math.pow(1.16, Math.max(0, zoom - 5));
      const baseRadius = spot.score >= 80 ? 85 : spot.score >= 65 ? 72 : 60;
      const radiusPx = Math.max(45, Math.min(230, baseRadius * zoomScale));

      // 根据分数选颜色（更高 alpha，确保能看到图层）
      let c0, c1, c2;
      if (spot.score >= 80) {
        c0 = 'rgba(255, 80, 0, 0.82)';
        c1 = 'rgba(255, 130, 0, 0.40)';
        c2 = 'rgba(255, 130, 0, 0.00)';
      } else if (spot.score >= 60) {
        c0 = 'rgba(255, 165, 0, 0.72)';
        c1 = 'rgba(255, 200, 0, 0.34)';
        c2 = 'rgba(255, 200, 0, 0.00)';
      } else {
        c0 = 'rgba(255, 225, 70, 0.58)';
        c1 = 'rgba(255, 235, 120, 0.26)';
        c2 = 'rgba(255, 235, 120, 0.00)';
      }

      const grad = ctx.createRadialGradient(x, y, 0, x, y, radiusPx);
      grad.addColorStop(0.00, c0);
      grad.addColorStop(0.45, c1);
      grad.addColorStop(1.00, c2);

      ctx.beginPath();
      ctx.arc(x, y, radiusPx, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    });

    // 恢复默认混合模式
    ctx.globalCompositeOperation = 'source-over';
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
    // 同步 canvas 尺寸
    const mapSize = this._map.getSize();
    this._canvas.width = mapSize.x;
    this._canvas.height = mapSize.y;
    this._canvas.style.width = mapSize.x + 'px';
    this._canvas.style.height = mapSize.y + 'px';
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
