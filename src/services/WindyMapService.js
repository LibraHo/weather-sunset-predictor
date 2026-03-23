/**
 * WindyMapService - 地图服务（Leaflet + OpenStreetMap / ChinaMapCanvas）
 *
 * Phase 6 重构：使用 Leaflet 替代 iframe 嵌入方式
 * 解决原 iframe 跨域隔离问题，支持火烧云覆盖层同步
 *
 * Phase 7 更新：集成 ChinaMapCanvas，优先使用原生 GeoJSON 地图
 *
 * 需求：18.1, 18.4, 20.7（Phase 6 重构）
 */

import ChinaMapCanvas from '../components/ChinaMapCanvas.js';

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
    this._chinaMap = null; // ChinaMapCanvas 实例
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

    // 尝试使用 ChinaMapCanvas（优先）
    try {
      const useNativeMap = localStorage.getItem('use_native_map') !== 'false';
      if (useNativeMap) {
        console.log('[WindyMapService] 尝试使用 ChinaMapCanvas 初始化地图...');

        // 清空容器
        this.container.innerHTML = '';

        // 创建 ChinaMapCanvas 实例
        const isDark = document.body.classList.contains('theme-dark');
        this._chinaMap = new ChinaMapCanvas({
          style: isDark ? 'dark' : 'light',
          defaultCenter: [this.currentOptions.lat, this.currentOptions.lon],
          defaultZoom: this.currentOptions.zoom
        });

        // 初始化到容器
        this._chinaMap.init(this.container);

        // 获取 Leaflet map 实例
        this.map = this._chinaMap.getMap();

        if (this.map) {
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

          console.log('[WindyMapService] 地图初始化成功 (ChinaMapCanvas)');

          // 触发地图初始化完成事件
          window.dispatchEvent(new CustomEvent('mapInitialized', {
            detail: { map: this.map, options: this.currentOptions }
          }));

          return;
        }
      }
    } catch (error) {
      console.warn('[WindyMapService] ChinaMapCanvas 不可用，回退到 OSM:', error);
      // 清理失败的 ChinaMapCanvas 状态
      this._chinaMap = null;
    }

    // 回退：使用 Leaflet + OpenStreetMap
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

      console.log('[WindyMapService] 地图初始化成功 (Leaflet + OSM)');

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
    console.log(`[WindyMapService] 图层切换为: ${overlay}`);
  }

  /**
   * 在地图上显示气象数据点（使用现有天气数据可视化图层）
   * @param {Array} dataPoints - 数据点数组，每个点包含 {lat, lon, value, label}
   * @param {string} layerType - 图层类型 ('wind'|'temp'|'clouds'|'rain')
   * @param {Object} colorConfig - 颜色配置 {min, max, lowColor, highColor}
   */
  showWeatherDataLayer(dataPoints, layerType, colorConfig = {}) {
    if (!this.isInitialized || !this.map) return;

    // 清除旧的气象数据图层
    this.clearWeatherDataLayer();

    if (!dataPoints || dataPoints.length === 0) return;

    const { min = 0, max = 100 } = colorConfig;

    // 各图层的颜色配置
    const layerColors = {
      wind: { low: '#4fc3f7', high: '#e53935' },   // 蓝→红
      temp: { low: '#42a5f5', high: '#ef5350' },   // 蓝→红
      clouds: { low: '#b0bec5', high: '#37474f' }, // 浅灰→深灰
      rain: { low: '#e3f2fd', high: '#1565c0' }    // 浅蓝→深蓝
    };

    const colors = layerColors[layerType] || layerColors.clouds;

    this._weatherCircles = dataPoints.map(point => {
      const ratio = Math.min(1, Math.max(0, (point.value - min) / (max - min)));
      const color = this._interpolateColor(colors.low, colors.high, ratio);

      const circle = L.circleMarker([point.lat, point.lon], {
        radius: 28,
        fillColor: color,
        fillOpacity: 0.65,
        color: '#fff',
        weight: 1.5,
        opacity: 0.9,
        interactive: true
      }).addTo(this.map);

      circle.bindTooltip(point.label, {
        permanent: false,
        direction: 'top',
        className: 'weather-layer-tooltip'
      });

      return circle;
    });

    console.log(`[WindyMapService] 气象数据图层已显示 (${layerType}), ${dataPoints.length} 个数据点`);
  }

  /**
   * 清除气象数据图层
   */
  clearWeatherDataLayer() {
    if (this._weatherCircles && this._weatherCircles.length > 0) {
      this._weatherCircles.forEach(c => c.remove());
      this._weatherCircles = [];
    }
  }

  /**
   * 线性插值两个十六进制颜色
   * @param {string} colorA - 起始颜色 '#rrggbb'
   * @param {string} colorB - 终止颜色 '#rrggbb'
   * @param {number} t - 插值比例 [0,1]
   * @returns {string} 插值后的颜色
   * @private
   */
  _interpolateColor(colorA, colorB, t) {
    const parse = hex => [
      parseInt(hex.slice(1, 3), 16),
      parseInt(hex.slice(3, 5), 16),
      parseInt(hex.slice(5, 7), 16)
    ];
    const [r1, g1, b1] = parse(colorA);
    const [r2, g2, b2] = parse(colorB);
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    return `rgb(${r},${g},${b})`;
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
    // 清理 ChinaMapCanvas 实例
    if (this._chinaMap) {
      this._chinaMap.destroy();
      this._chinaMap = null;
    }

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
