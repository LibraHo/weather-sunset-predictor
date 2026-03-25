/**
 * ChinaMapCanvas.js - 中国地图底层组件（GeoJSON + Canvas）
 *
 * 基于 Leaflet + GeoJSON 渲染中国省界，不依赖外部瓦片 API
 * GeoJSON 通过 fetch 懒加载，避免首屏阻塞 569KB 的模块解析
 */

// 模块级缓存，避免重复下载
let _cachedGeoJSON = null;

class ChinaMapCanvas {
  constructor(options = {}) {
    this._options = {
      style: options.style || 'dark',
      defaultZoom: options.defaultZoom || 4,
      defaultCenter: options.defaultCenter || [35, 105]
    };
    
    this._map = null;
    this._geoJsonLayer = null;
    this._container = null;
  }

  /**
   * 初始化地图到 DOM 容器（async，等待 GeoJSON 懒加载完成）
   * @param {HTMLElement|string} container - DOM 元素或选择器
   * @returns {Promise<void>}
   */
  async init(container) {
    if (!window.L) {
      console.error('[ChinaMapCanvas] Leaflet 未加载');
      return;
    }

    // 获取容器
    if (typeof container === 'string') {
      this._container = document.querySelector(container);
    } else {
      this._container = container;
    }

    if (!this._container) {
      console.error('[ChinaMapCanvas] 容器未找到');
      return;
    }

    // 创建 Leaflet 地图（启用完整交互功能）
    this._map = window.L.map(this._container, {
      center: this._options.defaultCenter,
      zoom: this._options.defaultZoom,
      zoomControl: true,
      attributionControl: false,
      dragging: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      boxZoom: true,
      touchZoom: true,
      keyboard: true,
      inertia: true,
      inertiaMaxSpeed: 1500,
      inertiaDeceleration: 3000
    });

    // 懒加载 GeoJSON（首次 fetch，之后走缓存）
    try {
      await this._loadGeoJSON();
    } catch (e) {
      console.error('[ChinaMapCanvas] GeoJSON 加载失败:', e);
    }

    // 添加 GeoJSON 图层
    this._addGeoJsonLayer();

    // 应用初始样式
    this._applyStyle();

    console.log('[ChinaMapCanvas] 地图初始化完成');
  }

  /**
   * 懒加载 GeoJSON 数据（带模块级缓存）
   */
  async _loadGeoJSON() {
    if (_cachedGeoJSON) return;
    const resp = await fetch('/data/china-geojson.json');
    if (!resp.ok) throw new Error(`GeoJSON fetch failed: ${resp.status}`);
    _cachedGeoJSON = await resp.json();
  }

  /**
   * 清理资源
   */
  destroy() {
    if (this._map) {
      this._map.remove();
      this._map = null;
    }
    this._geoJsonLayer = null;
    this._container = null;
  }

  /**
   * 返回 Leaflet map 实例
   * @returns {L.Map}
   */
  getMap() {
    return this._map;
  }

  /**
   * 移动视图到指定位置
   * @param {number} lat - 纬度
   * @param {number} lon - 经度
   * @param {number} zoom - 缩放级别
   */
  setCenter(lat, lon, zoom) {
    if (this._map) {
      this._map.setView([lat, lon], zoom);
    }
  }

  /**
   * 获取当前中心点
   * @returns {{lat: number, lon: number, zoom: number}}
   */
  getCenter() {
    if (!this._map) return null;
    
    const center = this._map.getCenter();
    return {
      lat: center.lat,
      lon: center.lng,
      zoom: this._map.getZoom()
    };
  }

  /**
   * 添加 Leaflet 图层
   * @param {L.Layer} layer - Leaflet 图层
   */
  addLayer(layer) {
    if (this._map && layer) {
      layer.addTo(this._map);
    }
  }

  /**
   * 移除 Leaflet 图层
   * @param {L.Layer} layer - Leaflet 图层
   */
  removeLayer(layer) {
    if (this._map && layer) {
      this._map.removeLayer(layer);
    }
  }

  /**
   * 添加 GeoJSON 省界图层
   */
  _addGeoJsonLayer() {
    const chinaGeoJSON = _cachedGeoJSON;
    if (!chinaGeoJSON || !chinaGeoJSON.features) {
      console.warn('[ChinaMapCanvas] GeoJSON 数据为空');
      return;
    }

    // 创建 GeoJSON 图层
    this._geoJsonLayer = window.L.geoJSON(chinaGeoJSON, {
      style: (feature) => {
        return {
          weight: 1.5,
          opacity: 0.6,
          dashArray: '3',
          fillOpacity: 0.1
        };
      },
      onEachFeature: (feature, layer) => {
        // 鼠标交互（暂时不显示省份 tooltip）
        // if (feature.properties && feature.properties.name) {
        //   layer.bindTooltip(feature.properties.name, {
        //     direction: 'top',
        //     offset: [0, -10],
        //     className: 'map-tooltip'
        //   });
        // }
      }
    }).addTo(this._map);

    // 添加城市标注
    this._addCityMarkers();

    // 调整视图以适应 GeoJSON 范围
    if (this._geoJsonLayer) {
      this._map.fitBounds(this._geoJsonLayer.getBounds());
    }
  }

  /**
   * 添加主要城市标注
   */
  _addCityMarkers() {
    // 中国主要城市数据（省会+重要城市）
    const cities = [
      { name: '北京', lat: 39.9042, lon: 116.4074 },
      { name: '上海', lat: 31.2304, lon: 121.4737 },
      { name: '广州', lat: 23.1291, lon: 113.2644 },
      { name: '深圳', lat: 22.5431, lon: 114.0579 },
      { name: '成都', lat: 30.5728, lon: 104.0668 },
      { name: '杭州', lat: 30.2741, lon: 120.1551 },
      { name: '武汉', lat: 30.5928, lon: 114.3055 },
      { name: '西安', lat: 34.3416, lon: 108.9398 },
      { name: '重庆', lat: 29.5630, lon: 106.5516 },
      { name: '南京', lat: 32.0603, lon: 118.7969 },
      { name: '天津', lat: 39.0842, lon: 117.2010 },
      { name: '苏州', lat: 31.2989, lon: 120.5853 },
      { name: '长沙', lat: 28.2280, lon: 112.9388 },
      { name: '郑州', lat: 34.7466, lon: 113.6253 },
      { name: '沈阳', lat: 41.8057, lon: 123.4315 },
      { name: '青岛', lat: 36.0671, lon: 120.3826 },
      { name: '宁波', lat: 29.8683, lon: 121.5440 },
      { name: '东莞', lat: 23.0489, lon: 113.7447 },
      { name: '佛山', lat: 23.0218, lon: 113.1219 },
      { name: '合肥', lat: 31.8206, lon: 117.2272 },
      { name: '厦门', lat: 24.4798, lon: 118.0894 },
      { name: '昆明', lat: 25.0389, lon: 102.7183 },
      { name: '济南', lat: 36.6512, lon: 117.1201 },
      { name: '福州', lat: 26.0745, lon: 119.2965 },
      { name: '大连', lat: 38.9140, lon: 121.6147 },
      { name: '哈尔滨', lat: 45.8038, lon: 126.5349 },
      { name: '长春', lat: 43.8171, lon: 125.3235 },
      { name: '石家庄', lat: 38.0428, lon: 114.5149 },
      { name: '南宁', lat: 22.8170, lon: 108.3665 },
      { name: '贵阳', lat: 26.6470, lon: 106.6302 },
      { name: '南昌', lat: 28.6820, lon: 115.8579 },
      { name: '乌鲁木齐', lat: 43.8256, lon: 87.6168 },
      { name: '兰州', lat: 36.0611, lon: 103.8343 },
      { name: '海口', lat: 20.0440, lon: 110.1999 },
      { name: '太原', lat: 37.8706, lon: 112.5489 }
    ];

    const isDark = document.body.classList.contains('theme-dark');
    const textColor = isDark ? '#fff' : '#333';

    cities.forEach(city => {
      // 创建城市标记（小圆点+文字）
      const marker = window.L.circleMarker([city.lat, city.lon], {
        radius: 3,
        fillColor: isDark ? 'rgba(255,120,0,0.8)' : 'rgba(0,0,0,0.6)',
        color: isDark ? 'rgba(255,120,0,1)' : 'rgba(0,0,0,0.8)',
        weight: 1,
        opacity: 1,
        fillOpacity: 0.8
      }).addTo(this._map);

      // 添加城市名称标签
      const icon = window.L.divIcon({
        className: 'city-label',
        html: `<span style="
          font-size: 11px;
          font-weight: 500;
          color: ${textColor};
          text-shadow: ${isDark ? '0 1px 2px rgba(0,0,0,0.8)' : '0 1px 2px rgba(255,255,255,0.8)'};
          white-space: nowrap;
          pointer-events: none;
          margin-left: 6px;
        ">${city.name}</span>`,
        iconSize: null,
        iconAnchor: [0, 5]
      });

      window.L.marker([city.lat, city.lon], { icon, interactive: false }).addTo(this._map);
    });

    console.log('[ChinaMapCanvas] 已添加', cities.length, '个城市标注');
  }

  /**
   * 应用地图样式
   */
  _applyStyle() {
    const isDark = document.body.classList.contains('theme-dark');
    const isLightStyle = this._options.style === 'light';

    if (isDark && !isLightStyle) {
      // 暗色主题
      this._applyDarkTheme();
    } else {
      // 亮色主题
      this._applyLightTheme();
    }
  }

  /**
   * 应用暗色主题
   */
  _applyDarkTheme() {
    if (!this._map) return;

    // 地图容器背景
    this._map.getContainer().style.backgroundColor = '#1a1f35';

    // GeoJSON 样式
    if (this._geoJsonLayer) {
      this._geoJsonLayer.setStyle({
        color: 'rgba(255, 120, 0, 0.4)',  // 边界线：橙色
        fillColor: 'rgba(255, 120, 0, 0.05)',
        weight: 1.5,
        opacity: 0.6,
        dashArray: '3',
        fillOpacity: 0.1
      });
    }
  }

  /**
   * 应用亮色主题
   */
  _applyLightTheme() {
    if (!this._map) return;

    // 地图容器背景
    this._map.getContainer().style.backgroundColor = '#f0f0f0';

    // GeoJSON 样式
    if (this._geoJsonLayer) {
      this._geoJsonLayer.setStyle({
        color: 'rgba(0, 0, 0, 0.3)',  // 边界线：深灰色
        fillColor: 'rgba(0, 0, 0, 0.02)',
        weight: 1.5,
        opacity: 0.5,
        dashArray: '3',
        fillOpacity: 0.1
      });
    }
  }

  /**
   * 切换主题
   * @param {string} theme - 'dark' 或 'light'
   */
  setTheme(theme) {
    this._options.style = theme;
    this._applyStyle();
  }
}

export default ChinaMapCanvas;
