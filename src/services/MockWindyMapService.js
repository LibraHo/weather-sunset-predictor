/**
 * MockWindyMapService - 模拟地图服务
 *
 * API 与 WindyMapService（Leaflet 版本）完全对齐
 * 用于 Mock 模式下的离线开发和测试
 *
 * 需求：18.3, 20.7（Phase 6 Mock 对齐）
 */

class MockWindyMapService {
  constructor(apiKey) {
    this.apiKey = apiKey || 'mock-map-key';
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
   * 初始化模拟地图
   * @param {string} containerId - 地图容器ID
   * @param {Object} options - 地图配置选项
   * @returns {Promise<void>}
   */
  async initializeMap(containerId, options = {}) {
    if (this.isInitialized) {
      console.warn('[MockWindyMapService] 地图已初始化');
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
      console.error('[MockWindyMapService] 地图容器不存在:', containerId);
      return;
    }

    console.log('[MockWindyMapService] 正在初始化模拟地图...');

    this.container.innerHTML = '';

    // 创建模拟地图元素
    const mockMap = document.createElement('div');
    mockMap.id = 'mock-map';
    mockMap.style.cssText = 'width:100%;height:100%;position:relative;background:#1a1a2e;border-radius:8px;overflow:hidden;';

    const title = document.createElement('div');
    title.textContent = '地图预测（模拟模式）';
    title.style.cssText = 'position:absolute;top:10px;left:50%;transform:translateX(-50%);color:white;z-index:10;font-size:18px;font-weight:bold;text-shadow:1px 1px 3px rgba(0,0,0,0.8);';
    mockMap.appendChild(title);

    const info = document.createElement('div');
    info.style.cssText = 'position:absolute;bottom:10px;left:10px;color:rgba(255,255,255,0.7);z-index:10;font-size:12px;';
    info.textContent = `${this.currentOptions.lat.toFixed(2)}, ${this.currentOptions.lon.toFixed(2)} | zoom: ${this.currentOptions.zoom}`;
    mockMap.appendChild(info);

    this.container.appendChild(mockMap);
    this.map = mockMap;
    this.isInitialized = true;

    console.log('[MockWindyMapService] 模拟地图初始化成功');

    window.dispatchEvent(new CustomEvent('mapInitialized', {
      detail: { map: this.map, options: this.currentOptions }
    }));
  }

  /**
   * 获取地图实例（模拟）
   * @returns {Object|null}
   */
  getMap() {
    return this.map;
  }

  /**
   * 移动地图到指定位置
   * @param {number} lat - 纬度
   * @param {number} lon - 经度
   * @param {number} zoom - 缩放级别
   */
  moveTo(lat, lon, zoom) {
    if (!this.isInitialized) {
      console.warn('[MockWindyMapService] 地图未初始化');
      return;
    }

    this.currentOptions.lat = lat;
    this.currentOptions.lon = lon;
    if (zoom !== undefined) {
      this.currentOptions.zoom = zoom;
    }

    console.log('[MockWindyMapService] 地图已移动到:', lat, lon);

    this._moveCallbacks.forEach(cb => cb({ lat, lon }));
  }

  /**
   * 更改地图叠加层
   * @param {string} overlay - 叠加层类型
   */
  changeOverlay(overlay) {
    this.currentOptions.overlay = overlay;
    console.log(`[MockWindyMapService] 图层切换为: ${overlay}`);
  }

  /**
   * 设置地图时间
   * @param {number} timestamp - Unix时间戳（毫秒）
   * @returns {boolean}
   */
  setTimestamp(timestamp) {
    this.currentOptions.timestamp = timestamp;
    console.log('[MockWindyMapService] 时间已设置:', new Date(timestamp).toLocaleString());
    return true;
  }

  /**
   * 获取当前时间戳
   * @returns {number}
   */
  getTimestamp() {
    return this.currentOptions.timestamp || Date.now();
  }

  /**
   * 获取允许的时间戳范围
   * @returns {Object}
   */
  getAllowedTimestampRange() {
    const now = Date.now();
    return {
      min: now,
      max: now + 7 * 24 * 60 * 60 * 1000
    };
  }

  /**
   * 注册地图移动回调
   * @param {Function} callback
   */
  onMove(callback) {
    if (typeof callback === 'function') {
      this._moveCallbacks.push(callback);
    }
  }

  /**
   * 添加图像覆盖层（模拟）
   * @param {string} imageUrl - 图片 URL
   * @param {Object} bounds - 地理边界
   * @param {Object} options - 选项
   * @returns {Object} 模拟覆盖层对象
   */
  addImageOverlay(imageUrl, bounds, options = {}) {
    if (!this.isInitialized || !this.map) {
      console.warn('[MockWindyMapService] 地图未初始化，无法添加覆盖层');
      return null;
    }

    // 创建模拟的覆盖层 DOM 元素
    const overlayEl = document.createElement('img');
    overlayEl.src = imageUrl;
    overlayEl.style.cssText = `position:absolute;top:20%;left:20%;width:60%;height:60%;opacity:${options.opacity || 0.7};z-index:${options.zIndex || 400};pointer-events:none;`;
    this.map.appendChild(overlayEl);

    const mockOverlay = {
      _element: overlayEl,
      remove() {
        if (overlayEl.parentNode) {
          overlayEl.parentNode.removeChild(overlayEl);
        }
      },
      setOpacity(val) {
        overlayEl.style.opacity = val;
      },
      setBounds() {}
    };

    this.overlays.push(mockOverlay);
    console.log('[MockWindyMapService] 模拟图像覆盖层已添加');
    return mockOverlay;
  }

  /**
   * 移除图像覆盖层
   * @param {Object} overlay - 指定覆盖层（可选，不传移除所有）
   */
  removeImageOverlay(overlay) {
    if (overlay) {
      overlay.remove();
      this.overlays = this.overlays.filter(o => o !== overlay);
    } else {
      this.overlays.forEach(o => o.remove());
      this.overlays = [];
    }
    console.log('[MockWindyMapService] 图像覆盖层已移除');
  }

  /**
   * 获取当前地图状态
   * @returns {Object|null}
   */
  getStatus() {
    if (!this.isInitialized) return null;

    return {
      isInitialized: this.isInitialized,
      center: { lat: this.currentOptions.lat, lon: this.currentOptions.lon },
      zoom: this.currentOptions.zoom,
      overlay: this.currentOptions.overlay,
      mode: 'mock',
      overlayCount: this.overlays.length
    };
  }

  /**
   * 获取当前地图边界（模拟）
   * @returns {Object|null}
   */
  getBounds() {
    if (!this.isInitialized) return null;

    const lat = this.currentOptions.lat;
    const lon = this.currentOptions.lon;
    const delta = 5;
    return {
      north: lat + delta,
      south: lat - delta,
      east: lon + delta,
      west: lon - delta
    };
  }

  /**
   * 销毁地图
   */
  destroy() {
    this.overlays.forEach(o => o.remove());
    this.overlays = [];
    this.markers = [];

    if (this.container) {
      this.container.innerHTML = '';
    }

    this.map = null;
    this.isInitialized = false;
    this._moveCallbacks = [];

    console.log('[MockWindyMapService] 地图已销毁');
  }
}

export default MockWindyMapService;
