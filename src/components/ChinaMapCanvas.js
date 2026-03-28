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
    // 定义不同级别的城市数据
    const cityLevels = {
      // 级别1：全部省会/直辖市/自治区首府（缩放 < 6）
      level1: [
        // 直辖市
        { name: '北京', lat: 39.9042, lon: 116.4074 },
        { name: '上海', lat: 31.2304, lon: 121.4737 },
        { name: '天津', lat: 39.0842, lon: 117.2010 },
        { name: '重庆', lat: 29.5630, lon: 106.5516 },
        // 华东
        { name: '南京', lat: 32.0603, lon: 118.7969 },
        { name: '杭州', lat: 30.2741, lon: 120.1551 },
        { name: '合肥', lat: 31.8206, lon: 117.2272 },
        { name: '福州', lat: 26.0745, lon: 119.2965 },
        { name: '南昌', lat: 28.6820, lon: 115.8579 },
        { name: '济南', lat: 36.6512, lon: 117.1201 },
        // 华北
        { name: '石家庄', lat: 38.0428, lon: 114.5149 },
        { name: '太原', lat: 37.8706, lon: 112.5489 },
        { name: '呼和浩特', lat: 40.8426, lon: 111.7500 },
        // 东北
        { name: '沈阳', lat: 41.8057, lon: 123.4315 },
        { name: '长春', lat: 43.8171, lon: 125.3235 },
        { name: '哈尔滨', lat: 45.8038, lon: 126.5349 },
        // 华中
        { name: '郑州', lat: 34.7466, lon: 113.6253 },
        { name: '武汉', lat: 30.5928, lon: 114.3055 },
        { name: '长沙', lat: 28.2280, lon: 112.9388 },
        // 华南
        { name: '广州', lat: 23.1291, lon: 113.2644 },
        { name: '深圳', lat: 22.5431, lon: 114.0579 },
        { name: '南宁', lat: 22.8170, lon: 108.3665 },
        { name: '海口', lat: 20.0440, lon: 110.1999 },
        // 西南
        { name: '成都', lat: 30.5728, lon: 104.0668 },
        { name: '贵阳', lat: 26.6470, lon: 106.6302 },
        { name: '昆明', lat: 25.0389, lon: 102.7183 },
        { name: '拉萨', lat: 29.6522, lon: 91.1323 },
        // 西北
        { name: '西安', lat: 34.3416, lon: 108.9398 },
        { name: '兰州', lat: 36.0611, lon: 103.8343 },
        { name: '西宁', lat: 36.6171, lon: 101.7782 },
        { name: '银川', lat: 38.4872, lon: 106.2309 },
        { name: '乌鲁木齐', lat: 43.8256, lon: 87.6168 },
        // 重要非省会大城市
        { name: '苏州', lat: 31.2989, lon: 120.5853 },
        { name: '宁波', lat: 29.8683, lon: 121.5440 },
        { name: '青岛', lat: 36.0671, lon: 120.3826 },
        { name: '大连', lat: 38.9140, lon: 121.6147 },
        { name: '厦门', lat: 24.4798, lon: 118.0894 },
        { name: '东莞', lat: 23.0489, lon: 113.7447 },
        { name: '佛山', lat: 23.0218, lon: 113.1219 },
      ],
      // 级别2：主要地级市（缩放 6-8）
      level2: [
        { name: '无锡', lat: 31.4912, lon: 120.3119 },
        { name: '常州', lat: 31.8112, lon: 119.9741 },
        { name: '南通', lat: 31.9802, lon: 120.8953 },
        { name: '徐州', lat: 34.2058, lon: 117.2841 },
        { name: '温州', lat: 28.0009, lon: 120.6551 },
        { name: '嘉兴', lat: 30.7469, lon: 120.7555 },
        { name: '绍兴', lat: 30.0021, lon: 120.5792 },
        { name: '金华', lat: 29.0782, lon: 119.6420 },
        { name: '台州', lat: 28.6564, lon: 121.4208 },
        { name: '扬州', lat: 32.3942, lon: 119.4316 },
        { name: '镇江', lat: 32.1871, lon: 119.4230 },
        { name: '泰州', lat: 32.4559, lon: 119.9255 },
        { name: '盐城', lat: 33.3799, lon: 120.1208 },
        { name: '淮安', lat: 33.5890, lon: 119.0193 },
        { name: '连云港', lat: 34.6004, lon: 119.1794 },
        { name: '宿迁', lat: 33.9417, lon: 118.2752 },
        { name: '烟台', lat: 37.4638, lon: 121.4481 },
        { name: '威海', lat: 37.5091, lon: 122.1206 },
        { name: '潍坊', lat: 36.7089, lon: 119.1619 },
        { name: '淄博', lat: 36.8135, lon: 118.0550 },
        { name: '临沂', lat: 35.0535, lon: 118.3264 },
        { name: '济宁', lat: 35.4021, lon: 116.4075 },
        { name: '菏泽', lat: 35.2333, lon: 115.4810 },
        { name: '聊城', lat: 36.4570, lon: 115.9803 },
        { name: '德州', lat: 37.4504, lon: 116.3575 },
        { name: '滨州', lat: 37.3835, lon: 117.9714 },
        { name: '东营', lat: 37.4341, lon: 118.6747 },
        { name: '泰安', lat: 36.2001, lon: 117.0876 },
        { name: '枣庄', lat: 34.8107, lon: 117.3237 },
        { name: '日照', lat: 35.4260, lon: 119.5269 },
        { name: '洛阳', lat: 34.6185, lon: 112.4540 },
        { name: '南阳', lat: 33.0040, lon: 112.5283 },
        { name: '新乡', lat: 35.3030, lon: 113.9268 },
        { name: '许昌', lat: 34.0357, lon: 113.8529 },
        { name: '平顶山', lat: 33.7663, lon: 113.1928 },
        { name: '安阳', lat: 36.0980, lon: 114.3924 },
        { name: '焦作', lat: 35.2159, lon: 113.2420 },
        { name: '商丘', lat: 34.4146, lon: 115.6564 },
        { name: '开封', lat: 34.7972, lon: 114.3077 },
        { name: '信阳', lat: 32.1470, lon: 114.0913 },
        { name: '周口', lat: 33.6261, lon: 114.6970 },
        { name: '驻马店', lat: 33.0114, lon: 114.0248 },
        { name: '珠海', lat: 22.2707, lon: 113.5677 },
        { name: '汕头', lat: 23.3541, lon: 116.7320 },
        { name: '佛山', lat: 23.0218, lon: 113.1219 },
        { name: '江门', lat: 22.5787, lon: 113.0819 },
        { name: '湛江', lat: 21.2707, lon: 110.3594 },
        { name: '茂名', lat: 21.6629, lon: 110.9252 },
        { name: '肇庆', lat: 23.0471, lon: 112.4648 },
        { name: '惠州', lat: 23.1115, lon: 114.4152 },
        { name: '梅州', lat: 24.2899, lon: 116.1222 },
        { name: '汕尾', lat: 22.7862, lon: 115.3752 },
        { name: '河源', lat: 23.7436, lon: 114.7004 },
        { name: '阳江', lat: 21.8583, lon: 111.9826 },
        { name: '清远', lat: 23.6820, lon: 113.0560 },
        { name: '中山', lat: 22.5170, lon: 113.3927 },
        { name: '潮州', lat: 23.6567, lon: 116.6229 },
        { name: '揭阳', lat: 23.5497, lon: 116.3727 },
        { name: '云浮', lat: 22.9157, lon: 112.0444 }
      ],
      // 级别3：更多城市（缩放 > 8）
      level3: [
        { name: '昆山', lat: 31.3886, lon: 120.9537 },
        { name: '常熟', lat: 31.6535, lon: 120.7523 },
        { name: '张家港', lat: 31.8756, lon: 120.5555 },
        { name: '江阴', lat: 31.9111, lon: 120.2860 },
        { name: '宜兴', lat: 31.3403, lon: 119.8235 },
        { name: '溧阳', lat: 31.4168, lon: 119.4846 },
        { name: '丹阳', lat: 32.0101, lon: 119.6062 },
        { name: '扬中', lat: 32.2356, lon: 119.7974 },
        { name: '句容', lat: 31.9457, lon: 119.1671 },
        { name: '靖江', lat: 32.0181, lon: 120.2735 },
        { name: '泰兴', lat: 32.1723, lon: 120.0519 },
        { name: '兴化', lat: 32.9118, lon: 119.8407 },
        { name: '如皋', lat: 32.3770, lon: 120.5748 },
        { name: '海门', lat: 31.8967, lon: 121.1824 },
        { name: '启东', lat: 31.8082, lon: 121.6576 },
        { name: '如东', lat: 32.3306, lon: 121.1869 },
        { name: '海安', lat: 32.5345, lon: 120.4672 },
        { name: '东台', lat: 32.8671, lon: 120.3206 },
        { name: '大丰', lat: 33.1996, lon: 120.4653 },
        { name: '射阳', lat: 33.7782, lon: 120.2581 },
        { name: '阜宁', lat: 33.7596, lon: 119.8030 },
        { name: '滨海', lat: 33.9896, lon: 119.8282 },
        { name: '响水', lat: 34.1996, lon: 119.5785 },
        { name: '建湖', lat: 33.4640, lon: 119.7931 },
        { name: '宝应', lat: 33.2403, lon: 119.3605 },
        { name: '高邮', lat: 32.7811, lon: 119.4557 },
        { name: '仪征', lat: 32.2725, lon: 119.1834 },
        { name: '江都', lat: 32.4357, lon: 119.5672 }
      ]
    };

    // 创建城市图层组
    this._cityMarkersLayer = window.L.layerGroup().addTo(this._map);

    // 根据缩放级别更新城市显示
    const updateCityVisibility = () => {
      const zoom = this._map.getZoom();
      this._cityMarkersLayer.clearLayers();

      let citiesToShow = [];
      if (zoom < 6) {
        citiesToShow = cityLevels.level1;
      } else if (zoom <= 8) {
        citiesToShow = [...cityLevels.level1, ...cityLevels.level2];
      } else {
        citiesToShow = [...cityLevels.level1, ...cityLevels.level2, ...cityLevels.level3];
      }

      const isDark = document.body.classList.contains('theme-dark');
      const textColor = isDark ? '#fff' : '#333';

      citiesToShow.forEach(city => {
        // 创建城市标记（小圆点）
        const marker = window.L.circleMarker([city.lat, city.lon], {
          radius: zoom > 8 ? 2 : 3,
          fillColor: isDark ? 'rgba(255,120,0,0.8)' : 'rgba(0,0,0,0.6)',
          color: isDark ? 'rgba(255,120,0,1)' : 'rgba(0,0,0,0.8)',
          weight: 1,
          opacity: 1,
          fillOpacity: 0.8
        });

        // 添加城市名称标签
        const icon = window.L.divIcon({
          className: 'city-label',
          html: `<span style="
            font-size: ${zoom > 8 ? '9px' : '11px'};
            font-weight: 500;
            color: ${textColor};
            text-shadow: ${isDark ? '0 1px 2px rgba(0,0,0,0.8)' : '0 1px 2px rgba(255,255,255,0.8)'};
            white-space: nowrap;
            pointer-events: none;
            margin-left: 4px;
          ">${city.name}</span>`,
          iconSize: null,
          iconAnchor: [0, zoom > 8 ? 3 : 5]
        });

        const label = window.L.marker([city.lat, city.lon], { icon, interactive: false });

        this._cityMarkersLayer.addLayer(marker);
        this._cityMarkersLayer.addLayer(label);
      });

      console.log(`[ChinaMapCanvas] 缩放级别 ${zoom}，显示 ${citiesToShow.length} 个城市`);
    };

    // 初始显示
    updateCityVisibility();

    // 监听缩放事件
    this._map.on('zoomend', updateCityVisibility);
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
