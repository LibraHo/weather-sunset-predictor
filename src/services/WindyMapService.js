/**
 * WindyMapService - 地图服务（Leaflet + OpenStreetMap）
 *
 * Phase 6 重构：使用 Leaflet 替代 iframe 嵌入方式
 * 解决原 iframe 跨域隔离问题，支持火烧云覆盖层同步
 *
 * 需求：18.1, 18.4, 20.7（Phase 6 重构）
 */

class WindyMapService {
  constructor(apiKey) {
    this.apiKey = apiKey; // 保留用于可选 Windy 升级
    this.container = null;
    this.map = null;
    this.isInitialized = false;
    this.currentOptions = {};
    this.tileLayer = null;
    this.markers = [];
    this.overlays = [];
    this._moveCallbacks = [];
  }

  /**
   * 初始化地图
   * @param {string} containerId - 地图容器ID
   * @param {Object} options - 地图配置选项
   * @returns {Promise<void>}
   *
   * 需求：18.1, 18.2.1, 18.2.2
   */
  async initializeMap(containerId, options = {}) {
    if (this.isInitialized) {
      console.warn('[WindyMapService] 地图已初始化');
      return;
    }

    const defaultOptions = {
      lat: 35.6762,
      lon: 139.6503,
      zoom: 6,
      overlay: 'wind'
    };

    this.currentOptions = { ...defaultOptions, ...options };
    this.container = document.getElementById(containerId);

    if (!this.container) {
      throw new Error(`地图容器不存在: ${containerId}`);
    }

    // 检查 Leaflet 是否可用
    if (typeof L === 'undefined') {
      throw new Error('Leaflet 未加载，请确认 CDN 脚本已引入');
    }

    try {
      console.log('[WindyMapService] 正在初始化地图 (Leaflet + OSM)...');

      // 清空容器
      this.container.innerHTML = '';

      // 创建 Leaflet 地图实例
      this.map = L.map(this.container, {
        center: [this.currentOptions.lat, this.currentOptions.lon],
        zoom: this.currentOptions.zoom,
        zoomControl: true,
        attributionControl: true
      });

      // 添加 OpenStreetMap 瓦片图层
      this.tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 18
      }).addTo(this.map);

      // 添加中心标记
      this._addCenterMarker(this.currentOptions.lat, this.currentOptions.lon);

      // 监听地图移动事件（用于通知覆盖层更新）
      this.map.on('moveend', () => {
        const center = this.map.getCenter();
        this.currentOptions.lat = center.lat;
        this.currentOptions.lon = center.lng;
        this._moveCallbacks.forEach(cb => cb({ lat: center.lat, lon: center.lng }));
      });

      this.isInitialized = true;

      console.log('[WindyMapService] 地图初始化成功 (Leaflet)');

      // 触发地图初始化完成事件
      window.dispatchEvent(new CustomEvent('mapInitialized', {
        detail: { map: this.map, options: this.currentOptions }
      }));

    } catch (error) {
      console.error('[WindyMapService] 地图初始化失败:', error);
      throw error;
    }
  }

  /**
   * 获取 Leaflet 地图实例
   * @returns {Object|null} Leaflet map 实例
   */
  getMap() {
    return this.map;
  }

  /**
   * 移动地图到指定位置
   * @param {number} lat - 纬度
   * @param {number} lon - 经度
   * @param {number} zoom - 缩放级别（可选）
   *
   * 需求：18.1
   */
  moveTo(lat, lon, zoom) {
    if (!this.isInitialized || !this.map) {
      console.warn('[WindyMapService] 地图未初始化');
      return;
    }

    // 更新当前位置
    this.currentOptions.lat = lat;
    this.currentOptions.lon = lon;
    if (zoom !== undefined) {
      this.currentOptions.zoom = zoom;
    }

    // 移动地图（使用 flyTo 平滑过渡）
    this.map.flyTo([lat, lon], this.currentOptions.zoom, {
      duration: 1
    });

    // 更新中心标记
    this._addCenterMarker(lat, lon);

    console.log('[WindyMapService] 地图已移动到:', lat, lon);
  }

  /**
   * 更改地图叠加层
   * @param {string} overlay - 叠加层类型 ('wind', 'temp', 'rain', 'clouds')
   *
   * 需求：18.1
   */
  changeOverlay(overlay) {
    this.currentOptions.overlay = overlay;
    console.log(`[WindyMapService] 图层切换为: ${overlay}（OSM 基础地图不支持气象图层，需升级 Windy API）`);
  }

  /**
   * 设置地图时间
   * @param {number} timestamp - Unix时间戳（毫秒）
   */
  setTimestamp(timestamp) {
    this.currentOptions.timestamp = timestamp;
    console.log('[WindyMapService] 时间已设置:', new Date(timestamp).toLocaleString());
    return true;
  }

  /**
   * 获取当前时间戳
   * @returns {number} 当前时间戳（毫秒）
   */
  getTimestamp() {
    return this.currentOptions.timestamp || Date.now();
  }

  /**
   * 获取允许的时间戳范围
   * @returns {Object|null} 包含min和max时间戳的对象
   */
  getAllowedTimestampRange() {
    const now = Date.now();
    return {
      min: now,
      max: now + 7 * 24 * 60 * 60 * 1000 // 7天后
    };
  }

  /**
   * 注册地图移动回调
   * @param {Function} callback - 移动回调函数，参数为 {lat, lon}
   */
  onMove(callback) {
    if (typeof callback === 'function') {
      this._moveCallbacks.push(callback);
    }
  }

  /**
   * 添加图像覆盖层（供 FireCloudOverlayService 使用）
   * @param {string} imageUrl - 图片 URL 或 dataURL
   * @param {Object} bounds - 地理边界 {north, south, east, west}
   * @param {Object} options - 覆盖层选项
   * @returns {Object} Leaflet imageOverlay 实例
   */
  addImageOverlay(imageUrl, bounds, options = {}) {
    if (!this.isInitialized || !this.map) {
      console.warn('[WindyMapService] 地图未初始化，无法添加覆盖层');
      return null;
    }

    const leafletBounds = L.latLngBounds(
      [bounds.south, bounds.west],
      [bounds.north, bounds.east]
    );

    const overlay = L.imageOverlay(imageUrl, leafletBounds, {
      opacity: options.opacity || 0.7,
      interactive: options.interactive || false,
      zIndex: options.zIndex || 400
    }).addTo(this.map);

    this.overlays.push(overlay);

    console.log('[WindyMapService] 图像覆盖层已添加');
    return overlay;
  }

  /**
   * 移除图像覆盖层
   * @param {Object} overlay - Leaflet imageOverlay 实例（可选，不传则移除所有）
   */
  removeImageOverlay(overlay) {
    if (overlay) {
      overlay.remove();
      this.overlays = this.overlays.filter(o => o !== overlay);
    } else {
      // 移除所有覆盖层
      this.overlays.forEach(o => o.remove());
      this.overlays = [];
    }
    console.log('[WindyMapService] 图像覆盖层已移除');
  }

  /**
   * 获取当前地图状态
   * @returns {Object|null} 地图状态信息
   */
  getStatus() {
    if (!this.isInitialized) {
      return null;
    }

    return {
      isInitialized: this.isInitialized,
      center: {
        lat: this.currentOptions.lat,
        lon: this.currentOptions.lon
      },
      zoom: this.currentOptions.zoom,
      overlay: this.currentOptions.overlay,
      mode: 'leaflet',
      overlayCount: this.overlays.length
    };
  }

  /**
   * 获取当前地图边界
   * @returns {Object|null} 边界 {north, south, east, west}
   */
  getBounds() {
    if (!this.isInitialized || !this.map) {
      return null;
    }

    const bounds = this.map.getBounds();
    return {
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest()
    };
  }

  /**
   * 添加中心位置标记
   * @param {number} lat - 纬度
   * @param {number} lon - 经度
   * @private
   */
  _addCenterMarker(lat, lon) {
    // 移除旧标记
    this.markers.forEach(m => m.remove());
    this.markers = [];

    if (!this.map) return;

    const marker = L.marker([lat, lon]).addTo(this.map);
    this.markers.push(marker);
  }

  /**
   * 销毁地图
   *
   * 需求：18.1
   */
  destroy() {
    if (this.map) {
      // 移除所有覆盖层
      this.overlays.forEach(o => o.remove());
      this.overlays = [];

      // 移除所有标记
      this.markers.forEach(m => m.remove());
      this.markers = [];

      // 销毁地图
      this.map.remove();
      this.map = null;
    }

    if (this.container) {
      this.container.innerHTML = '';
    }

    this.isInitialized = false;
    this._moveCallbacks = [];

    console.log('[WindyMapService] 地图已销毁');
  }
}

export default WindyMapService;
