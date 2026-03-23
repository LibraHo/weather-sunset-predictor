/**
 * ChinaMapCanvas.js - 中国地图底层组件（GeoJSON + Canvas）
 *
 * 基于 Leaflet + GeoJSON 渲染中国省界，不依赖外部瓦片 API
 */

import chinaGeoJSON from '../data/china-geojson.js';

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
   * 初始化地图到 DOM 容器
   * @param {HTMLElement|string} container - DOM 元素或选择器
   */
  init(container) {
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
      // 拖拽平移
      dragging: true,
      // 滚轮缩放
      scrollWheelZoom: true,
      // 双击缩放
      doubleClickZoom: true,
      // 框选缩放
      boxZoom: true,
      // 触摸缩放（移动端）
      touchZoom: true,
      // 键盘控制
      keyboard: true,
      // 平滑惯性拖拽
      inertia: true,
      // 惯性最大速度
      inertiaMaxSpeed: 1500,
      // 惯性减速
      inertiaDeceleration: 3000
    });

    // 添加 GeoJSON 图层
    this._addGeoJsonLayer();

    // 应用初始样式
    this._applyStyle();

    console.log('[ChinaMapCanvas] 地图初始化完成');
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
        // 鼠标交互
        if (feature.properties && feature.properties.name) {
          layer.bindTooltip(feature.properties.name, {
            direction: 'top',
            offset: [0, -10],
            className: 'map-tooltip'
          });
        }
      }
    }).addTo(this._map);

    // 调整视图以适应 GeoJSON 范围
    if (this._geoJsonLayer) {
      this._map.fitBounds(this._geoJsonLayer.getBounds());
    }
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
