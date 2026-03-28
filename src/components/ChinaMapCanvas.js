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

        // 华东（补充）
,
        { name: '湖州', lat: 30.8943, lon: 120.0868 },
        { name: '衢州', lat: 28.9702, lon: 118.8597 },
        { name: '丽水', lat: 28.4675, lon: 119.9228 },
        { name: '蚌埠', lat: 32.9165, lon: 117.3632 },
        { name: '芜湖', lat: 31.3527, lon: 118.3764 },
        { name: '马鞍山', lat: 31.6704, lon: 118.5079 },
        { name: '泉州', lat: 24.8741, lon: 118.6757 },
        { name: '漳州', lat: 24.5131, lon: 117.6472 },
        { name: '龙岩', lat: 25.0613, lon: 117.0176 },
        { name: '三明', lat: 26.2654, lon: 117.6389 },
        { name: '九江', lat: 29.7050, lon: 116.0019 },
        { name: '赣州', lat: 25.8317, lon: 114.9350 },
        { name: '上饶', lat: 28.4576, lon: 117.9434 },
        { name: '宜春', lat: 27.7967, lon: 114.3915 },
        { name: '吉安', lat: 27.1117, lon: 114.9926 },
        { name: '景德镇', lat: 29.2687, lon: 117.1784 },
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
        // 华中（补充）
,
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
        { name: '株洲', lat: 27.8274, lon: 113.1339 },
        { name: '湘潭', lat: 27.8299, lon: 112.9440 },
        { name: '衡阳', lat: 26.8972, lon: 112.5718 },
        { name: '邵阳', lat: 27.2368, lon: 111.4677 },
        { name: '岳阳', lat: 29.3571, lon: 113.0943 },
        { name: '常德', lat: 29.0375, lon: 111.6984 },
        { name: '张家界', lat: 29.1274, lon: 110.4793 },
        { name: '益阳', lat: 28.5540, lon: 112.3550 },
        { name: '郴州', lat: 25.7706, lon: 113.0149 },
        { name: '永州', lat: 26.4201, lon: 111.6132 },
        { name: '怀化', lat: 27.5699, lon: 109.9783 },
        { name: '娄底', lat: 27.7008, lon: 111.9934 },
        { name: '襄阳', lat: 32.0091, lon: 112.1225 },
        { name: '宜昌', lat: 30.6927, lon: 111.2865 },
        { name: '荆州', lat: 30.3352, lon: 112.2416 },
        { name: '黄冈', lat: 30.4461, lon: 114.8725 },
        { name: '十堰', lat: 32.6475, lon: 110.7876 },
        { name: '孝感', lat: 30.9269, lon: 113.9168 },
        { name: '黄石', lat: 30.2001, lon: 115.0389 },
        { name: '鄂州', lat: 30.3844, lon: 114.8954 },
        { name: '荆门', lat: 31.0354, lon: 112.1992 },
        // 华南（补充）
,
        { name: '珠海', lat: 22.2707, lon: 113.5677 },
        { name: '汕头', lat: 23.3541, lon: 116.7320 },
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
        { name: '云浮', lat: 22.9157, lon: 112.0444 },
        { name: '柳州', lat: 24.3295, lon: 109.4160 },
        { name: '桂林', lat: 25.2742, lon: 110.2992 },
        { name: '梧州', lat: 23.4769, lon: 111.2791 },
        { name: '北海', lat: 21.4813, lon: 109.1192 },
        { name: '防城港', lat: 21.6146, lon: 108.3452 },
        { name: '钦州', lat: 21.9730, lon: 108.6538 },
        { name: '贵港', lat: 23.1115, lon: 109.5989 },
        { name: '玉林', lat: 22.6437, lon: 110.1805 },
        { name: '百色', lat: 23.9025, lon: 106.6186 },
        { name: '贺州', lat: 24.4039, lon: 111.5672 },
        { name: '河池', lat: 24.6929, lon: 108.0852 },
        { name: '来宾', lat: 23.7338, lon: 109.2297 },
        { name: '崇左', lat: 22.4041, lon: 107.3648 },
        // 西南（补充）
,
        { name: '绵阳', lat: 31.4678, lon: 104.6794 },
        { name: '自贡', lat: 29.3388, lon: 104.7784 },
        { name: '攀枝花', lat: 26.5823, lon: 101.7189 },
        { name: '泸州', lat: 28.8718, lon: 105.4423 },
        { name: '德阳', lat: 31.1270, lon: 104.3979 },
        { name: '广元', lat: 32.4354, lon: 105.8431 },
        { name: '遂宁', lat: 30.5333, lon: 105.5929 },
        { name: '内江', lat: 29.5870, lon: 105.0584 },
        { name: '乐山', lat: 29.5870, lon: 103.7663 },
        { name: '南充', lat: 30.8378, lon: 106.1106 },
        { name: '眉山', lat: 30.0756, lon: 103.8485 },
        { name: '宜宾', lat: 28.7696, lon: 104.6445 },
        { name: '广安', lat: 30.4564, lon: 106.6333 },
        { name: '达州', lat: 31.2092, lon: 107.4680 },
        { name: '雅安', lat: 29.9877, lon: 103.0010 },
        { name: '巴中', lat: 31.8588, lon: 106.7475 },
        { name: '资阳', lat: 30.1288, lon: 104.6308 },
        { name: '六盘水', lat: 26.5918, lon: 104.8304 },
        { name: '遵义', lat: 27.7257, lon: 106.9273 },
        { name: '安顺', lat: 26.2455, lon: 105.9322 },
        { name: '毕节', lat: 27.3021, lon: 105.2840 },
        { name: '铜仁', lat: 27.7312, lon: 109.1895 },
        { name: '曲靖', lat: 25.4998, lon: 103.7962 },
        { name: '玉溪', lat: 24.3521, lon: 102.5433 },
        { name: '保山', lat: 25.1120, lon: 99.1611 },
        { name: '昭通', lat: 27.3378, lon: 103.7172 },
        { name: '丽江', lat: 26.8556, lon: 100.2277 },
        { name: '普洱', lat: 22.8250, lon: 100.9661 },
        { name: '临沧', lat: 23.8878, lon: 100.0926 },
        // 西北（补充）
,
        { name: '咸阳', lat: 34.3296, lon: 108.7090 },
        { name: '宝鸡', lat: 34.3610, lon: 107.2393 },
        { name: '渭南', lat: 34.5194, lon: 109.5100 },
        { name: '延安', lat: 36.5853, lon: 109.4897 },
        { name: '汉中', lat: 33.0677, lon: 107.0234 },
        { name: '榆林', lat: 38.2884, lon: 109.7341 },
        { name: '安康', lat: 32.6849, lon: 109.0289 },
        { name: '商洛', lat: 33.8688, lon: 109.9404 },
        { name: '嘉峪关', lat: 39.7727, lon: 98.2894 },
        { name: '金昌', lat: 38.5204, lon: 102.1879 },
        { name: '白银', lat: 36.5448, lon: 104.1382 },
        { name: '天水', lat: 34.5808, lon: 105.7249 },
        { name: '武威', lat: 37.9283, lon: 102.6381 },
        { name: '张掖', lat: 38.9324, lon: 100.4496 },
        { name: '平凉', lat: 35.5428, lon: 106.6849 },
        { name: '酒泉', lat: 39.7320, lon: 98.4941 },
        { name: '庆阳', lat: 35.7090, lon: 107.6441 },
        { name: '定西', lat: 35.5805, lon: 104.6263 },
        { name: '陇南', lat: 33.4007, lon: 104.9206 },
        { name: '海东', lat: 36.5029, lon: 102.1026 },
        { name: '海北', lat: 36.9596, lon: 100.9010 },
        { name: '黄南', lat: 35.5175, lon: 102.0148 },
        { name: '海南', lat: 36.2841, lon: 100.6196 },
        { name: '果洛', lat: 34.4716, lon: 100.2436 },
        { name: '玉树', lat: 33.0040, lon: 97.0085 },
        { name: '海西', lat: 37.3776, lon: 97.3709 },
        { name: '石嘴山', lat: 39.0133, lon: 106.3792 },
        { name: '吴忠', lat: 37.9978, lon: 106.1989 },
        { name: '固原', lat: 36.0155, lon: 106.2428 },
        { name: '中卫', lat: 37.5149, lon: 105.1965 },
        { name: '克拉玛依', lat: 45.5798, lon: 84.8893 },
        { name: '吐鲁番', lat: 42.9513, lon: 89.1895 },
        { name: '哈密', lat: 42.8185, lon: 93.5140 },
        { name: '昌吉', lat: 44.0118, lon: 87.3079 },
        { name: '博尔塔拉', lat: 44.9053, lon: 82.0748 },
        { name: '巴音郭楞', lat: 41.7713, lon: 86.1500 },
        { name: '阿克苏', lat: 41.1674, lon: 80.2609 },
        { name: '克孜勒苏', lat: 39.7133, lon: 75.9899 },
        { name: '喀什', lat: 39.4706, lon: 75.9899 },
        { name: '和田', lat: 37.1099, lon: 79.9269 },
        { name: '伊犁', lat: 43.9217, lon: 81.3173 },
        { name: '塔城', lat: 46.7454, lon: 82.9878 },
        { name: '阿勒泰', lat: 47.8485, lon: 88.1397 },
        { name: '内蒙古主要盟市', lat: 40.8426, lon: 111.7500 },
        { name: '呼伦贝尔', lat: 49.2016, lon: 119.7658 },
        { name: '兴安盟', lat: 46.0763, lon: 122.0378 },
        { name: '通辽', lat: 43.6175, lon: 122.2603 },
        { name: '赤峰', lat: 42.2574, lon: 118.8869 },
        { name: '锡林郭勒', lat: 43.9333, lon: 116.0469 },
        { name: '乌兰察布', lat: 40.9944, lon: 113.1325 },
        { name: '鄂尔多斯', lat: 39.6086, lon: 109.7813 },
        { name: '巴彦淖尔', lat: 40.7574, lon: 107.4166 },
        { name: '乌海', lat: 39.6554, lon: 106.7931 },
        { name: '阿拉善盟', lat: 38.8444, lon: 105.7356 },
        // 东北主要地级市（补充）
,
        { name: '鞍山', lat: 41.1106, lon: 122.9946 },
        { name: '抚顺', lat: 41.8773, lon: 123.9572 },
        { name: '本溪', lat: 41.2886, lon: 123.7675 },
        { name: '丹东', lat: 40.1290, lon: 124.3831 },
        { name: '锦州', lat: 41.1301, lon: 121.1247 },
        { name: '营口', lat: 40.6674, lon: 122.2350 },
        { name: '阜新', lat: 42.0217, lon: 121.6709 },
        { name: '辽阳', lat: 41.2694, lon: 123.1725 },
        { name: '盘锦', lat: 41.1191, lon: 122.0707 },
        { name: '铁岭', lat: 42.2929, lon: 123.8419 },
        { name: '朝阳', lat: 41.5762, lon: 120.4506 },
        { name: '葫芦岛', lat: 40.7555, lon: 120.8564 },
        { name: '吉林市', lat: 43.8379, lon: 126.5484 },
        { name: '四平', lat: 43.1702, lon: 124.3508 },
        { name: '辽源', lat: 42.9028, lon: 125.1435 },
        { name: '通化', lat: 41.7286, lon: 125.9396 },
        { name: '白山', lat: 41.9375, lon: 126.4158 },
        { name: '松原', lat: 45.1414, lon: 124.8251 },
        { name: '白城', lat: 45.6196, lon: 122.8389 },
        { name: '延边', lat: 42.8911, lon: 129.5089 },
        { name: '齐齐哈尔', lat: 47.3543, lon: 123.9180 },
        { name: '鸡西', lat: 45.2956, lon: 130.9693 },
        { name: '鹤岗', lat: 47.3499, lon: 130.2979 },
        { name: '双鸭山', lat: 46.6434, lon: 131.1591 },
        { name: '大庆', lat: 46.5907, lon: 125.1033 },
        { name: '伊春', lat: 47.7279, lon: 128.8994 },
        { name: '佳木斯', lat: 46.7992, lon: 130.3189 },
        { name: '七台河', lat: 45.7751, lon: 131.0020 },
        { name: '牡丹江', lat: 44.5527, lon: 129.6334 },
        { name: '黑河', lat: 50.2451, lon: 127.5284 },
        { name: '绥化', lat: 46.6374, lon: 126.9691 },
        { name: '大兴安岭', lat: 50.4178, lon: 124.7125 },
      ],
      // 级别3：更多城市（缩放 > 8）
      level3: [
,
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
