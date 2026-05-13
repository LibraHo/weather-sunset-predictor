/**
 * ChinaMapCanvas.js - 亚洲太平洋地图底层组件（GeoJSON + Canvas）
 *
 * 基于 Leaflet + GeoJSON 渲染中国/日韩朝/亚洲太平洋边界，不依赖外部瓦片 API
 * GeoJSON 通过 fetch 懒加载，避免首屏阻塞 569KB 的模块解析
 *
 * feat: 全量地级行政单位标注 + 图例 + 点击查询 + 缩放分级显示
 */

// 模块级缓存，避免重复下载
import i18n from '../i18n.js';
import { getLocalizedMapCityName } from '../data/mapCityNames.js';

let _cachedChinaGeoJSON = null;
let _cachedEastAsiaGeoJSON = null;

const MAP_UI_TEXT = {
  'zh-CN': {
    sunriseScore: '朝霞分数', sunsetScore: '晚霞分数', loading: '查询中…', noData: '暂无数据', scoreUnit: '分',
    highCloud: '高', midCloud: '中', lowCloud: '低', humidity: '湿度', currentPeriod: '当前时段', queryFailed: '查询失败'
  },
  'zh-TW': {
    sunriseScore: '朝霞分數', sunsetScore: '晚霞分數', loading: '查詢中…', noData: '暫無資料', scoreUnit: '分',
    highCloud: '高', midCloud: '中', lowCloud: '低', humidity: '濕度', currentPeriod: '目前時段', queryFailed: '查詢失敗'
  },
  'en-US': {
    sunriseScore: 'Sunrise glow score', sunsetScore: 'Sunset glow score', loading: 'Querying…', noData: 'No data', scoreUnit: 'pts',
    highCloud: 'High', midCloud: 'Mid', lowCloud: 'Low', humidity: 'Humidity', currentPeriod: 'Current period', queryFailed: 'Query failed'
  },
  'ja-JP': {
    sunriseScore: '朝焼けスコア', sunsetScore: '夕焼けスコア', loading: '検索中…', noData: 'データなし', scoreUnit: '点',
    highCloud: '高', midCloud: '中', lowCloud: '低', humidity: '湿度', currentPeriod: '現在の時間帯', queryFailed: '検索失敗'
  },
  'ko-KR': {
    sunriseScore: '일출 노을 점수', sunsetScore: '일몰 노을 점수', loading: '조회 중…', noData: '데이터 없음', scoreUnit: '점',
    highCloud: '상층', midCloud: '중층', lowCloud: '하층', humidity: '습도', currentPeriod: '현재 시간대', queryFailed: '조회 실패'
  },
  'es-ES': {
    sunriseScore: 'Puntuación del amanecer', sunsetScore: 'Puntuación del atardecer', loading: 'Consultando…', noData: 'Sin datos', scoreUnit: 'pts',
    highCloud: 'Alta', midCloud: 'Media', lowCloud: 'Baja', humidity: 'Humedad', currentPeriod: 'Periodo actual', queryFailed: 'Error de consulta'
  },
  'fr-FR': {
    sunriseScore: 'Score de l’aube', sunsetScore: 'Score du coucher', loading: 'Recherche…', noData: 'Aucune donnée', scoreUnit: 'pts',
    highCloud: 'Haut', midCloud: 'Moyen', lowCloud: 'Bas', humidity: 'Humidité', currentPeriod: 'Période actuelle', queryFailed: 'Échec de la requête'
  },
  'vi-VN': {
    sunriseScore: 'Điểm ráng bình minh', sunsetScore: 'Điểm ráng hoàng hôn', loading: 'Đang tra cứu…', noData: 'Không có dữ liệu', scoreUnit: 'điểm',
    highCloud: 'Cao', midCloud: 'Trung', lowCloud: 'Thấp', humidity: 'Độ ẩm', currentPeriod: 'Khung giờ hiện tại', queryFailed: 'Tra cứu thất bại'
  },
  'it-IT': {
    sunriseScore: 'Punteggio alba', sunsetScore: 'Punteggio tramonto', loading: 'Ricerca…', noData: 'Nessun dato', scoreUnit: 'pti',
    highCloud: 'Alte', midCloud: 'Medie', lowCloud: 'Basse', humidity: 'Umidità', currentPeriod: 'Periodo attuale', queryFailed: 'Ricerca non riuscita'
  },
  'ar-SA': {
    sunriseScore: 'درجة شفق الشروق', sunsetScore: 'درجة شفق الغروب', loading: 'جارٍ الاستعلام…', noData: 'لا توجد بيانات', scoreUnit: 'نقطة',
    highCloud: 'عالية', midCloud: 'متوسطة', lowCloud: 'منخفضة', humidity: 'الرطوبة', currentPeriod: 'الفترة الحالية', queryFailed: 'فشل الاستعلام'
  }
};

function getCurrentMapLanguage() {
  return i18n?.getCurrentLanguage?.() || i18n?.currentLanguage || 'zh-CN';
}

function mapUiText(key) {
  const lang = getCurrentMapLanguage();
  return MAP_UI_TEXT[lang]?.[key] || MAP_UI_TEXT['en-US'][key] || key;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const MOBILE_CORE_CITY_NAMES = new Set([
  '北京', '上海', '广州', '深圳', '成都', '重庆', '武汉', '西安', '杭州', '南京'
]);

const MOBILE_OVERVIEW_CITY_NAMES = new Set([
  '北京', '上海', '广州', '成都', '西安',
  '东京', '首尔', '乌兰巴托', '曼谷', '雅加达',
  '塔什干', '新德里', '莫斯科', '悉尼'
]);

const OVERVIEW_CITY_NAMES = new Set([
  '北京', '上海', '广州', '成都', '西安', '乌鲁木齐', '拉萨',
  '台北', '首尔', '东京', '乌兰巴托', '曼谷', '河内', '雅加达',
  '阿斯塔纳', '塔什干', '新德里', '孟买', '卡拉奇', '达卡', '莫斯科', '新西伯利亚', '悉尼', '墨尔本'
]);

const LOW_ZOOM_REGIONAL_CITY_NAMES = new Set([
  ...MOBILE_CORE_CITY_NAMES,
  '台北', '首尔', '东京', '大阪', '乌兰巴托',
  '曼谷', '河内', '胡志明市', '金边', '万象', '仰光', '吉隆坡', '雅加达',
  '阿斯塔纳', '阿拉木图', '塔什干', '比什凯克', '杜尚别', '阿什哈巴德',
  '新德里', '孟买', '加尔各答', '卡拉奇', '拉合尔', '达卡', '加德满都', '科伦坡',
  '莫斯科', '圣彼得堡', '新西伯利亚', '符拉迪沃斯托克',
  '悉尼', '墨尔本', '布里斯班', '珀斯'
]);

const INITIAL_FIT_BASEMAP_COUNTRY_NAMES = new Set([
  'China', 'Japan', 'South Korea', 'North Korea', 'Mongolia',
  'Myanmar', 'Thailand', 'Laos', 'Cambodia', 'Vietnam', 'Malaysia', 'Indonesia',
  'Kazakhstan', 'Kyrgyzstan', 'Tajikistan', 'Uzbekistan', 'Turkmenistan',
  'Afghanistan', 'Pakistan', 'India', 'Nepal', 'Bhutan', 'Bangladesh', 'Sri Lanka', 'Maldives'
]);

const CHINA_SECONDARY_MAJOR_CITY_NAMES = new Set([
  '深圳', '苏州', '宁波', '青岛', '大连', '厦门', '东莞', '佛山'
]);

const DENSE_REGION_SECONDARY_CITY_NAMES = new Set([
  // 岛屿 / 半岛 / 都市圈面积小，低 zoom 下先只留区域锚点，避免文字混叠
  '新北', '桃园', '台中', '台南', '高雄', '基隆', '花莲',
  '釜山', '仁川', '大邱', '大田', '光州', '蔚山', '济州',
  '横滨', '名古屋', '京都', '神户', '札幌', '仙台', '广岛', '福冈'
]);

function mergeUniqueCities(...groups) {
  const merged = new Map();
  for (const group of groups) {
    for (const city of group || []) {
      if (city?.name && !merged.has(city.name)) merged.set(city.name, city);
    }
  }
  return [...merged.values()];
}

function filterCitiesByName(cities, names) {
  return (cities || []).filter(city => names.has(city.name));
}

function filterLowZoomCityDensity(cities) {
  return (cities || []).filter(city => !DENSE_REGION_SECONDARY_CITY_NAMES.has(city.name));
}

function filterMidZoomCityDensity(cities) {
  return filterLowZoomCityDensity(cities)
    .filter(city => !CHINA_SECONDARY_MAJOR_CITY_NAMES.has(city.name));
}

function selectCitiesForZoom(levels, zoom, isMobile = false) {
  const L1 = levels.level1 || [];
  const L2 = levels.level2 || [];
  const L3 = levels.level3 || [];

  if (isMobile) {
    if (zoom < 5.5) return filterCitiesByName(L1, MOBILE_OVERVIEW_CITY_NAMES);
    if (zoom < 7.2) return filterCitiesByName(L1, OVERVIEW_CITY_NAMES);
    if (zoom < 9.5) return filterCitiesByName(L1, LOW_ZOOM_REGIONAL_CITY_NAMES);
    if (zoom < 11.5) return filterMidZoomCityDensity(L1);
    if (zoom < 13) return mergeUniqueCities(L1, L2);
    return mergeUniqueCities(L1, L2, L3);
  }

  if (zoom < 5) return filterCitiesByName(L1, OVERVIEW_CITY_NAMES);
  if (zoom < 6.5) return filterCitiesByName(L1, LOW_ZOOM_REGIONAL_CITY_NAMES);
  if (zoom < 8.8) return filterMidZoomCityDensity(L1);
  if (zoom < 10.2) return filterLowZoomCityDensity(L1);
  if (zoom < 11.5) return mergeUniqueCities(L1, L2);
  return mergeUniqueCities(L1, L2, L3);
}

function isMobileMapViewport() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(max-width: 640px)').matches || window.innerWidth <= 640;
}

function isDarkMapTheme() {
  if (typeof document === 'undefined') return false;
  return document.body?.dataset?.actualTheme === 'dark'
    || document.documentElement?.dataset?.actualTheme === 'dark'
    || document.body?.classList?.contains('theme-dark')
    || document.body?.classList?.contains('theme-actual-dark')
    || document.documentElement?.classList?.contains('theme-dark')
    || document.documentElement?.classList?.contains('theme-actual-dark');
}

function getMapUiTokens() {
  if (typeof window === 'undefined') {
    return {
      mapBg: '#f0f0f0',
      mapBgDark: '#1a1f35',
      boundaryStroke: 'rgba(0, 0, 0, 0.30)',
      boundaryFill: 'rgba(0, 0, 0, 0.02)',
      boundaryStrokeDark: 'rgba(255, 120, 0, 0.4)',
      boundaryFillDark: 'rgba(255, 120, 0, 0.05)',
      cityFill: 'rgba(0, 0, 0, 0.6)',
      cityFillDark: 'rgba(255, 120, 0, 0.8)',
      cityStroke: 'rgba(0, 0, 0, 0.8)',
      cityStrokeDark: 'rgba(255, 120, 0, 1)',
      cityText: '#333',
      cityTextDark: '#fff',
      textShadowLight: '0 1px 2px rgba(255,255,255,0.8)',
      textShadowDark: '0 1px 2px rgba(0,0,0,0.8)',
      legendBg: 'rgba(30,30,40,0.88)',
      legendText: '#eee',
      legendBorder: 'rgba(255,255,255,0.15)',
      legendTitle: '🎨 晚霞分数',
      focusFill: 'rgba(255,140,0,0.95)',
      focusStroke: 'rgba(255,255,255,0.9)',
      scoreTextHigh: '#ff8c00',
      scoreTextMid: '#ffc107',
      scoreTextLow: '#aaa',
      scoreTextError: '#f66',
      popupBg: 'rgba(20,24,36,0.9)',
      popupText: '#fff',
      popupMutedText: '#b5b5b5',
      popupHintText: '#888',
      popupLoadingText: '#aaa',
      popupPeriodText: '#ddd',
      popupBorder: 'rgba(255,255,255,0.2)',
    };
  }

  const cs = getComputedStyle(document.body);
  const token = (name, fallback) => (cs.getPropertyValue(name).trim() || fallback);
  return {
    mapBg: token('--map-bg', '#f0f0f0'),
    mapBgDark: token('--map-bg-dark', '#1a1f35'),
    boundaryStroke: token('--map-boundary-stroke', 'rgba(0, 0, 0, 0.30)'),
    boundaryFill: token('--map-boundary-fill', 'rgba(0, 0, 0, 0.02)'),
    boundaryStrokeDark: token('--map-boundary-stroke-dark', 'rgba(255, 120, 0, 0.4)'),
    boundaryFillDark: token('--map-boundary-fill-dark', 'rgba(255, 120, 0, 0.05)'),
    cityFill: token('--map-city-fill', 'rgba(0, 0, 0, 0.6)'),
    cityFillDark: token('--map-city-fill-dark', 'rgba(255, 120, 0, 0.8)'),
    cityStroke: token('--map-city-stroke', 'rgba(0, 0, 0, 0.8)'),
    cityStrokeDark: token('--map-city-stroke-dark', 'rgba(255, 120, 0, 1)'),
    cityText: token('--map-city-text', '#333'),
    cityTextDark: token('--map-city-text-dark', '#fff'),
    textShadowLight: token('--map-city-text-shadow', '0 1px 2px rgba(255,255,255,0.8)'),
    textShadowDark: token('--map-city-text-shadow-dark', '0 1px 2px rgba(0,0,0,0.8)'),
    legendBg: token('--map-legend-bg', 'rgba(30,30,40,0.88)'),
    legendText: token('--map-legend-text', '#eee'),
    legendBorder: token('--map-legend-border', 'rgba(255,255,255,0.15)'),
    legendTitle: token('--map-legend-title', '🎨 晚霞分数'),
    focusFill: token('--map-focus-fill', 'rgba(255,140,0,0.95)'),
    focusStroke: token('--map-focus-stroke', 'rgba(255,255,255,0.9)'),
    scoreTextHigh: token('--map-score-text-high', '#ff8c00'),
    scoreTextMid: token('--map-score-text-mid', '#ffc107'),
    scoreTextLow: token('--map-score-text-low', '#aaa'),
    scoreTextError: token('--map-score-text-error', '#f66'),
    popupBg: token('--map-popup-bg', 'rgba(20,24,36,0.9)'),
    popupText: token('--map-popup-text', '#fff'),
    popupMutedText: token('--map-popup-muted-text', '#b5b5b5'),
    popupHintText: token('--map-popup-hint-text', '#888'),
    popupLoadingText: token('--map-popup-loading-text', '#aaa'),
    popupPeriodText: token('--map-popup-period-text', '#ddd'),
    popupBorder: token('--map-popup-border', 'rgba(255,255,255,0.2)'),
  };
}

class ChinaMapCanvas {
  constructor(options = {}) {
    this._options = {
      style: options.style || 'dark',
      defaultZoom: options.defaultZoom || 4,
      defaultCenter: options.defaultCenter || [35, 105],
      showScoreLegend: options.showScoreLegend !== false,
      enableScoreQuery: options.enableScoreQuery !== false
    };
    
    this._map = null;
    this._geoJsonLayer = null;
    this._container = null;
    this._cityMarkersLayer = null;
    this._legendControl = null;
    this._clickPopup = null;
    this._currentPeriod = 'sunset'; // 'sunrise' | 'sunset'
    this._focusMarker = null;
    this._cityVisibilityUpdater = null;
    this._languageChangeHandler = () => this.refreshLanguage();
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

    // 添加评分图例
    if (this._options.showScoreLegend) {
      this._addLegend();
    }

    // 添加点击查分
    if (this._options.enableScoreQuery) {
      this._addClickHandler();
    }

    window.addEventListener?.('languageChanged', this._languageChangeHandler);

    console.log('[ChinaMapCanvas] 地图初始化完成');
  }

  /**
   * 懒加载 GeoJSON 数据（带模块级缓存）
   * 中国用完整省级数据（含台湾/港澳/南海），日韩朝与中南半岛用 east-asia 数据
   */
  async _loadGeoJSON() {
    if (!_cachedChinaGeoJSON) {
      const resp = await fetch('/data/china-geojson.json?v=2');
      if (!resp.ok) throw new Error(`China GeoJSON fetch failed: ${resp.status}`);
      _cachedChinaGeoJSON = await resp.json();
    }
    if (!_cachedEastAsiaGeoJSON) {
      const resp = await fetch('/data/east-asia-basemap-geojson.json?v=3');
      if (!resp.ok) throw new Error(`EastAsia GeoJSON fetch failed: ${resp.status}`);
      _cachedEastAsiaGeoJSON = await resp.json();
    }
  }

  /**
   * 清理资源
   */
  destroy() {
    if (typeof window !== 'undefined') {
      window.removeEventListener?.('languageChanged', this._languageChangeHandler);
    }
    if (this._map) {
      this._map.remove();
      this._map = null;
    }
    this._focusMarker = null;
    this._geoJsonLayer = null;
    this._container = null;
    this._cityVisibilityUpdater = null;
  }

  refreshLanguage() {
    this._updateLegend();
    if (typeof this._cityVisibilityUpdater === 'function') {
      this._cityVisibilityUpdater();
    }
  }

  _getLocalizedCityName(cityOrName) {
    const name = typeof cityOrName === 'string' ? cityOrName : cityOrName?.name;
    return getLocalizedMapCityName(name, getCurrentMapLanguage());
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
   * 聚焦到定位地点附近（任务：地图只显示定位地点附近）
   * @param {number} lat
   * @param {number} lon
   * @param {Object} options
   * @param {number} options.radiusKm - 视窗半径（公里）
   * @param {number} options.maxZoom - 最大缩放
   */
  focusOnLocation(lat, lon, options = {}) {
    if (!this._map || !Number.isFinite(lat) || !Number.isFinite(lon)) return;

    const radiusKm = Number.isFinite(options.radiusKm) ? options.radiusKm : 280;
    const maxZoom = Number.isFinite(options.maxZoom) ? options.maxZoom : 8;

    const latDelta = radiusKm / 111;
    const safeCos = Math.max(0.25, Math.cos((lat * Math.PI) / 180));
    const lonDelta = radiusKm / (111 * safeCos);

    const southWest = window.L.latLng(lat - latDelta, lon - lonDelta);
    const northEast = window.L.latLng(lat + latDelta, lon + lonDelta);
    const bounds = window.L.latLngBounds(southWest, northEast);

    this._map.fitBounds(bounds, {
      animate: false,
      padding: [24, 24],
      maxZoom,
    });

    this._setFocusMarker(lat, lon);
  }

  _setFocusMarker(lat, lon) {
    if (!this._map) return;

    const theme = getMapUiTokens();
    const isDark = isDarkMapTheme();

    if (this._focusMarker) {
      this._map.removeLayer(this._focusMarker);
      this._focusMarker = null;
    }

    this._focusMarker = window.L.circleMarker([lat, lon], {
      radius: 6,
      weight: 2,
      color: isDark ? theme.focusStroke : theme.focusStroke,
      fillColor: isDark ? theme.focusFill : theme.focusFill,
      fillOpacity: 1,
      interactive: false,
    }).addTo(this._map);
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
    const chinaGeoJSON = _cachedChinaGeoJSON;
    const eastAsiaGeoJSON = _cachedEastAsiaGeoJSON;

    if (!chinaGeoJSON || !chinaGeoJSON.features) {
      console.warn('[ChinaMapCanvas] 中国 GeoJSON 数据为空');
      return;
    }

    const commonStyle = {
      weight: 1.5,
      opacity: 0.6,
      dashArray: '3',
      fillOpacity: 0.05,
      lineJoin: 'round',
      lineCap: 'round'
    };

    // 外围国家边界使用更细实线，降低“锯齿/粗糙感”
    const eastAsiaStyle = {
      ...commonStyle,
      weight: 1.05,
      opacity: 0.5,
      dashArray: null
    };

    // 1. 中国完整省级边界（含台湾、港澳、南海诸岛）
    const chinaLayer = window.L.geoJSON(chinaGeoJSON, {
      style: () => commonStyle,
      onEachFeature: () => {}
    }).addTo(this._map);

    // 2. 外围国家边界（从 basemap 数据中过滤掉不完整的 China）
    let eastAsiaLayer = null;
    let initialFitLayer = null;
    if (eastAsiaGeoJSON && eastAsiaGeoJSON.features) {
      const filtered = {
        ...eastAsiaGeoJSON,
        features: eastAsiaGeoJSON.features.filter(
          f => f.properties?.name !== 'China'
        )
      };
      eastAsiaLayer = window.L.geoJSON(filtered, {
        style: () => eastAsiaStyle,
        smoothFactor: 1.2,
        onEachFeature: () => {}
      }).addTo(this._map);

      const initialFitGeoJSON = {
        ...eastAsiaGeoJSON,
        features: eastAsiaGeoJSON.features.filter(
          f => f.properties?.name !== 'China' && INITIAL_FIT_BASEMAP_COUNTRY_NAMES.has(f.properties?.name)
        )
      };
      initialFitLayer = window.L.geoJSON(initialFitGeoJSON);
    }

    // 合并初始视野 bounds。俄罗斯/澳大利亚边界可平移查看，但不参与初始 fit，避免地图首屏被缩得过小。
    const bounds = chinaLayer.getBounds();
    if (initialFitLayer) {
      bounds.extend(initialFitLayer.getBounds());
    }
    this._geoJsonLayer = chinaLayer;
    this._eastAsiaLayer = eastAsiaLayer;

    // 添加城市标注
    this._addCityMarkers();

    // 调整视图以适应完整中国范围
    this._map.fitBounds(bounds);
  }

  /**
   * 全量地级行政单位城市数据（去重、按级别分层）
   *
   * level1（~40个）：全部省会/直辖市/自治区首府 + 重要副省级
   * level2（~300个）：全部地级行政单位（含地区/自治州/盟）
   * level3（~30个）：重要县级市（缩放>9才显示）
   *
   * 覆盖统计（地级行政单位）：
   *   西藏 7/7 ✓  新疆 14/14 ✓  青海 8/8 ✓  内蒙古 12/12 ✓
   */
  _getCityData() {
    // ─── level1: 省会/直辖市/首府 + 副省级 ────────────────────────
    const level1 = [
      // 直辖市
      { name: '北京', lat: 39.9042, lon: 116.4074 },
      { name: '上海', lat: 31.2304, lon: 121.4737 },
      { name: '天津', lat: 39.0842, lon: 117.2010 },
      { name: '重庆', lat: 29.5630, lon: 106.5516 },
      // 华东省会
      { name: '南京', lat: 32.0603, lon: 118.7969 },
      { name: '杭州', lat: 30.2741, lon: 120.1551 },
      { name: '合肥', lat: 31.8206, lon: 117.2272 },
      { name: '福州', lat: 26.0745, lon: 119.2965 },
      { name: '南昌', lat: 28.6820, lon: 115.8579 },
      { name: '济南', lat: 36.6512, lon: 117.1201 },
      // 华北省会
      { name: '石家庄', lat: 38.0428, lon: 114.5149 },
      { name: '太原', lat: 37.8706, lon: 112.5489 },
      { name: '呼和浩特', lat: 40.8426, lon: 111.7500 },
      // 东北省会
      { name: '沈阳', lat: 41.8057, lon: 123.4315 },
      { name: '长春', lat: 43.8171, lon: 125.3235 },
      { name: '哈尔滨', lat: 45.8038, lon: 126.5349 },
      // 华中省会
      { name: '郑州', lat: 34.7466, lon: 113.6253 },
      { name: '武汉', lat: 30.5928, lon: 114.3055 },
      { name: '长沙', lat: 28.2280, lon: 112.9388 },
      // 华南省会
      { name: '广州', lat: 23.1291, lon: 113.2644 },
      { name: '南宁', lat: 22.8170, lon: 108.3665 },
      { name: '海口', lat: 20.0440, lon: 110.1999 },
      // 西南省会
      { name: '成都', lat: 30.5728, lon: 104.0668 },
      { name: '贵阳', lat: 26.6470, lon: 106.6302 },
      { name: '昆明', lat: 25.0389, lon: 102.7183 },
      { name: '拉萨', lat: 29.6522, lon: 91.1323 },
      // 西北省会
      { name: '西安', lat: 34.3416, lon: 108.9398 },
      { name: '兰州', lat: 36.0611, lon: 103.8343 },
      { name: '西宁', lat: 36.6171, lon: 101.7782 },
      { name: '银川', lat: 38.4872, lon: 106.2309 },
      { name: '乌鲁木齐', lat: 43.8256, lon: 87.6168 },
      // 重要副省级/大城市
      { name: '深圳', lat: 22.5431, lon: 114.0579 },
      { name: '苏州', lat: 31.2989, lon: 120.5853 },
      { name: '宁波', lat: 29.8683, lon: 121.5440 },
      { name: '青岛', lat: 36.0671, lon: 120.3826 },
      { name: '大连', lat: 38.9140, lon: 121.6147 },
      { name: '厦门', lat: 24.4798, lon: 118.0894 },
      { name: '东莞', lat: 23.0489, lon: 113.7447 },
      { name: '佛山', lat: 23.0218, lon: 113.1219 },
      // 台湾（中国台湾省）
      { name: '台北', lat: 25.0330, lon: 121.5654 },
      { name: '新北', lat: 25.0120, lon: 121.4657 },
      { name: '桃园', lat: 24.9937, lon: 121.3010 },
      { name: '台中', lat: 24.1477, lon: 120.6736 },
      { name: '台南', lat: 22.9999, lon: 120.2270 },
      { name: '高雄', lat: 22.6273, lon: 120.3014 },
      { name: '基隆', lat: 25.1276, lon: 121.7392 },
      { name: '花莲', lat: 23.9872, lon: 121.6015 },
      // 韩国
      { name: '首尔', lat: 37.5665, lon: 126.9780 },
      { name: '釜山', lat: 35.1796, lon: 129.0756 },
      { name: '仁川', lat: 37.4563, lon: 126.7052 },
      { name: '大邱', lat: 35.8714, lon: 128.6014 },
      { name: '大田', lat: 36.3504, lon: 127.3845 },
      { name: '光州', lat: 35.1595, lon: 126.8526 },
      { name: '蔚山', lat: 35.5384, lon: 129.3114 },
      { name: '济州', lat: 33.4996, lon: 126.5312 },
      // 朝鲜
      { name: '平壤', lat: 39.0392, lon: 125.7625 },
      { name: '咸兴', lat: 39.9144, lon: 127.5364 },
      { name: '元山', lat: 39.1528, lon: 127.4433 },
      { name: '清津', lat: 41.7840, lon: 129.7758 },
      { name: '新义州', lat: 40.1000, lon: 124.4000 },
      // 日本
      { name: '东京', lat: 35.6762, lon: 139.6503 },
      { name: '横滨', lat: 35.4437, lon: 139.6380 },
      { name: '大阪', lat: 34.6937, lon: 135.5023 },
      { name: '名古屋', lat: 35.1815, lon: 136.9066 },
      { name: '京都', lat: 35.0116, lon: 135.7681 },
      { name: '神户', lat: 34.6901, lon: 135.1955 },
      { name: '札幌', lat: 43.0618, lon: 141.3545 },
      { name: '仙台', lat: 38.2682, lon: 140.8694 },
      { name: '广岛', lat: 34.3853, lon: 132.4553 },
      { name: '福冈', lat: 33.5902, lon: 130.4017 },
      // 蒙古国
      { name: '乌兰巴托', lat: 47.8864, lon: 106.9057 },
      // 东南亚主要城市（仅底图标注，不扩展火烧云热力/栅格渲染范围）
      { name: '曼谷', lat: 13.7563, lon: 100.5018 },
      { name: '河内', lat: 21.0278, lon: 105.8342 },
      { name: '胡志明市', lat: 10.8231, lon: 106.6297 },
      { name: '金边', lat: 11.5564, lon: 104.9282 },
      { name: '万象', lat: 17.9757, lon: 102.6331 },
      { name: '仰光', lat: 16.8409, lon: 96.1735 },
      { name: '吉隆坡', lat: 3.1390, lon: 101.6869 },
      { name: '雅加达', lat: -6.2088, lon: 106.8456 },
      // 中亚主要城市
      { name: '阿斯塔纳', lat: 51.1694, lon: 71.4491 },
      { name: '阿拉木图', lat: 43.2389, lon: 76.8897 },
      { name: '塔什干', lat: 41.2995, lon: 69.2401 },
      { name: '比什凯克', lat: 42.8746, lon: 74.5698 },
      { name: '杜尚别', lat: 38.5598, lon: 68.7870 },
      { name: '阿什哈巴德', lat: 37.9601, lon: 58.3261 },
      // 南亚主要城市
      { name: '新德里', lat: 28.6139, lon: 77.2090 },
      { name: '孟买', lat: 19.0760, lon: 72.8777 },
      { name: '加尔各答', lat: 22.5726, lon: 88.3639 },
      { name: '卡拉奇', lat: 24.8607, lon: 67.0011 },
      { name: '达卡', lat: 23.8103, lon: 90.4125 },
      { name: '加德满都', lat: 27.7172, lon: 85.3240 },
      { name: '科伦坡', lat: 6.9271, lon: 79.8612 },
      // 俄罗斯与澳大利亚区域锚点
      { name: '莫斯科', lat: 55.7558, lon: 37.6173 },
      { name: '圣彼得堡', lat: 59.9311, lon: 30.3609 },
      { name: '新西伯利亚', lat: 55.0084, lon: 82.9357 },
      { name: '符拉迪沃斯托克', lat: 43.1155, lon: 131.8855 },
      { name: '悉尼', lat: -33.8688, lon: 151.2093 },
      { name: '墨尔本', lat: -37.8136, lon: 144.9631 },
      { name: '布里斯班', lat: -27.4698, lon: 153.0251 },
      { name: '珀斯', lat: -31.9523, lon: 115.8613 },
    ];

    // ─── level2: 全部地级行政单位 ──────────────────────────────────
    const level2 = [
      // ── 河北（11市）──────────────────────────────────
      { name: '唐山', lat: 39.6309, lon: 118.1802 },
      { name: '秦皇岛', lat: 39.9354, lon: 119.5994 },
      { name: '邯郸', lat: 36.6258, lon: 114.5391 },
      { name: '邢台', lat: 37.0682, lon: 114.5048 },
      { name: '保定', lat: 38.8739, lon: 115.4646 },
      { name: '张家口', lat: 40.7675, lon: 114.8865 },
      { name: '承德', lat: 40.9510, lon: 117.9632 },
      { name: '沧州', lat: 38.3037, lon: 116.8386 },
      { name: '廊坊', lat: 39.5246, lon: 116.6839 },
      { name: '衡水', lat: 37.7392, lon: 115.6658 },
      // ── 山西（11市）──────────────────────────────────
      { name: '大同', lat: 40.0763, lon: 113.3001 },
      { name: '阳泉', lat: 37.8570, lon: 113.5803 },
      { name: '长治', lat: 36.1954, lon: 113.1163 },
      { name: '晋城', lat: 35.4908, lon: 112.8513 },
      { name: '朔州', lat: 39.3313, lon: 112.4331 },
      { name: '晋中', lat: 37.6872, lon: 112.7530 },
      { name: '运城', lat: 35.0264, lon: 111.0071 },
      { name: '忻州', lat: 38.4167, lon: 112.7340 },
      { name: '临汾', lat: 36.0880, lon: 111.5190 },
      { name: '吕梁', lat: 37.5186, lon: 111.1443 },
      // ── 内蒙古（12盟市）──────────────────────────────
      { name: '包头', lat: 40.6571, lon: 109.8403 },
      { name: '乌海', lat: 39.6554, lon: 106.7931 },
      { name: '赤峰', lat: 42.2574, lon: 118.8869 },
      { name: '通辽', lat: 43.6175, lon: 122.2603 },
      { name: '鄂尔多斯', lat: 39.6086, lon: 109.7813 },
      { name: '呼伦贝尔', lat: 49.2016, lon: 119.7658 },
      { name: '巴彦淖尔', lat: 40.7574, lon: 107.4166 },
      { name: '乌兰察布', lat: 40.9944, lon: 113.1325 },
      { name: '兴安盟', lat: 46.0763, lon: 122.0378 },
      { name: '锡林郭勒', lat: 43.9333, lon: 116.0469 },
      { name: '阿拉善盟', lat: 38.8444, lon: 105.7356 },
      // ── 辽宁（14市）──────────────────────────────────
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
      // ── 吉林（9市州）─────────────────────────────────
      { name: '吉林市', lat: 43.8379, lon: 126.5484 },
      { name: '四平', lat: 43.1702, lon: 124.3508 },
      { name: '辽源', lat: 42.9028, lon: 125.1435 },
      { name: '通化', lat: 41.7286, lon: 125.9396 },
      { name: '白山', lat: 41.9375, lon: 126.4158 },
      { name: '松原', lat: 45.1414, lon: 124.8251 },
      { name: '白城', lat: 45.6196, lon: 122.8389 },
      { name: '延边', lat: 42.8911, lon: 129.5089 },
      // ── 黑龙江（13市地）─────────────────────────────
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
      // ── 江苏（13市）──────────────────────────────────
      { name: '无锡', lat: 31.4912, lon: 120.3119 },
      { name: '常州', lat: 31.8112, lon: 119.9741 },
      { name: '南通', lat: 31.9802, lon: 120.8953 },
      { name: '徐州', lat: 34.2058, lon: 117.2841 },
      { name: '扬州', lat: 32.3942, lon: 119.4316 },
      { name: '镇江', lat: 32.1871, lon: 119.4230 },
      { name: '泰州', lat: 32.4559, lon: 119.9255 },
      { name: '盐城', lat: 33.3799, lon: 120.1208 },
      { name: '淮安', lat: 33.5890, lon: 119.0193 },
      { name: '连云港', lat: 34.6004, lon: 119.1794 },
      { name: '宿迁', lat: 33.9417, lon: 118.2752 },
      // ── 浙江（11市）──────────────────────────────────
      { name: '温州', lat: 28.0009, lon: 120.6551 },
      { name: '嘉兴', lat: 30.7469, lon: 120.7555 },
      { name: '绍兴', lat: 30.0021, lon: 120.5792 },
      { name: '金华', lat: 29.0782, lon: 119.6420 },
      { name: '台州', lat: 28.6564, lon: 121.4208 },
      { name: '湖州', lat: 30.8943, lon: 120.0868 },
      { name: '衢州', lat: 28.9702, lon: 118.8597 },
      { name: '丽水', lat: 28.4675, lon: 119.9228 },
      // ── 安徽（16市）──────────────────────────────────
      { name: '蚌埠', lat: 32.9165, lon: 117.3632 },
      { name: '芜湖', lat: 31.3527, lon: 118.3764 },
      { name: '马鞍山', lat: 31.6704, lon: 118.5079 },
      { name: '淮南', lat: 32.6264, lon: 116.9998 },
      { name: '淮北', lat: 33.9717, lon: 116.7945 },
      { name: '铜陵', lat: 30.9446, lon: 117.8122 },
      { name: '安庆', lat: 30.5430, lon: 117.0631 },
      { name: '黄山', lat: 29.7147, lon: 118.3376 },
      { name: '滁州', lat: 32.3018, lon: 118.3170 },
      { name: '阜阳', lat: 32.8908, lon: 115.8142 },
      { name: '宿州', lat: 33.6461, lon: 116.9641 },
      { name: '六安', lat: 31.7350, lon: 116.5231 },
      { name: '亳州', lat: 33.8693, lon: 115.7785 },
      { name: '池州', lat: 30.6650, lon: 117.4912 },
      { name: '宣城', lat: 30.9457, lon: 118.7590 },
      // ── 福建（9市）───────────────────────────────────
      { name: '泉州', lat: 24.8741, lon: 118.6757 },
      { name: '漳州', lat: 24.5131, lon: 117.6472 },
      { name: '龙岩', lat: 25.0613, lon: 117.0176 },
      { name: '三明', lat: 26.2654, lon: 117.6389 },
      { name: '莆田', lat: 25.4309, lon: 119.0078 },
      { name: '南平', lat: 26.6418, lon: 118.1778 },
      { name: '宁德', lat: 26.6566, lon: 119.5479 },
      // ── 江西（11市）──────────────────────────────────
      { name: '景德镇', lat: 29.2687, lon: 117.1784 },
      { name: '萍乡', lat: 27.6229, lon: 113.8546 },
      { name: '九江', lat: 29.7050, lon: 116.0019 },
      { name: '新余', lat: 27.8176, lon: 114.9173 },
      { name: '鹰潭', lat: 28.2600, lon: 117.0694 },
      { name: '赣州', lat: 25.8317, lon: 114.9350 },
      { name: '吉安', lat: 27.1117, lon: 114.9926 },
      { name: '宜春', lat: 27.7967, lon: 114.3915 },
      { name: '抚州', lat: 27.9538, lon: 116.3583 },
      { name: '上饶', lat: 28.4576, lon: 117.9434 },
      // ── 山东（16市）──────────────────────────────────
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
      // ── 河南（17市）──────────────────────────────────
      { name: '洛阳', lat: 34.6185, lon: 112.4540 },
      { name: '开封', lat: 34.7972, lon: 114.3077 },
      { name: '南阳', lat: 33.0040, lon: 112.5283 },
      { name: '新乡', lat: 35.3030, lon: 113.9268 },
      { name: '许昌', lat: 34.0357, lon: 113.8529 },
      { name: '平顶山', lat: 33.7663, lon: 113.1928 },
      { name: '安阳', lat: 36.0980, lon: 114.3924 },
      { name: '焦作', lat: 35.2159, lon: 113.2420 },
      { name: '鹤壁', lat: 35.7475, lon: 114.2973 },
      { name: '濮阳', lat: 35.7627, lon: 115.0296 },
      { name: '漯河', lat: 33.5817, lon: 114.0166 },
      { name: '三门峡', lat: 34.7734, lon: 111.2005 },
      { name: '商丘', lat: 34.4146, lon: 115.6564 },
      { name: '信阳', lat: 32.1470, lon: 114.0913 },
      { name: '周口', lat: 33.6261, lon: 114.6970 },
      { name: '驻马店', lat: 33.0114, lon: 114.0248 },
      // ── 湖北（14市州）────────────────────────────────
      { name: '黄石', lat: 30.2001, lon: 115.0389 },
      { name: '十堰', lat: 32.6475, lon: 110.7876 },
      { name: '宜昌', lat: 30.6927, lon: 111.2865 },
      { name: '襄阳', lat: 32.0091, lon: 112.1225 },
      { name: '鄂州', lat: 30.3844, lon: 114.8954 },
      { name: '荆门', lat: 31.0354, lon: 112.1992 },
      { name: '孝感', lat: 30.9269, lon: 113.9168 },
      { name: '荆州', lat: 30.3352, lon: 112.2416 },
      { name: '黄冈', lat: 30.4461, lon: 114.8725 },
      { name: '咸宁', lat: 29.8413, lon: 114.3224 },
      { name: '随州', lat: 31.6904, lon: 113.3826 },
      { name: '恩施', lat: 30.2720, lon: 109.4880 },
      // ── 湖南（14市州）────────────────────────────────
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
      { name: '湘西', lat: 28.3119, lon: 109.7391 },
      // ── 广东（19市，东莞/佛山已在 level1）──────────
      { name: '珠海', lat: 22.2707, lon: 113.5677 },
      { name: '汕头', lat: 23.3541, lon: 116.7320 },
      { name: '韶关', lat: 24.8107, lon: 113.5975 },
      { name: '湛江', lat: 21.2707, lon: 110.3594 },
      { name: '肇庆', lat: 23.0471, lon: 112.4648 },
      { name: '江门', lat: 22.5787, lon: 113.0819 },
      { name: '茂名', lat: 21.6629, lon: 110.9252 },
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
      // ── 广西（14市）──────────────────────────────────
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
      // ── 海南（4市）───────────────────────────────────
      { name: '三亚', lat: 18.2528, lon: 109.5120 },
      { name: '三沙', lat: 16.8338, lon: 112.3325 },
      { name: '儋州', lat: 19.5211, lon: 109.5769 },
      // ── 四川（21市州）────────────────────────────────
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
      { name: '阿坝', lat: 31.8990, lon: 102.2214 },
      { name: '甘孜', lat: 30.0486, lon: 101.9625 },
      { name: '凉山', lat: 27.8868, lon: 102.2645 },
      // ── 贵州（6市）───────────────────────────────────
      { name: '六盘水', lat: 26.5918, lon: 104.8304 },
      { name: '遵义', lat: 27.7257, lon: 106.9273 },
      { name: '安顺', lat: 26.2455, lon: 105.9322 },
      { name: '毕节', lat: 27.3021, lon: 105.2840 },
      { name: '铜仁', lat: 27.7312, lon: 109.1895 },
      // ── 云南（16市州）────────────────────────────────
      { name: '曲靖', lat: 25.4998, lon: 103.7962 },
      { name: '玉溪', lat: 24.3521, lon: 102.5433 },
      { name: '保山', lat: 25.1120, lon: 99.1611 },
      { name: '昭通', lat: 27.3378, lon: 103.7172 },
      { name: '丽江', lat: 26.8556, lon: 100.2277 },
      { name: '普洱', lat: 22.8250, lon: 100.9661 },
      { name: '临沧', lat: 23.8878, lon: 100.0926 },
      { name: '楚雄', lat: 25.0292, lon: 101.5280 },
      { name: '红河', lat: 23.3640, lon: 103.3756 },
      { name: '文山', lat: 23.3694, lon: 104.2446 },
      { name: '西双版纳', lat: 22.0074, lon: 100.7971 },
      { name: '大理', lat: 25.6065, lon: 100.2676 },
      { name: '德宏', lat: 24.4366, lon: 98.5854 },
      { name: '怒江', lat: 25.8170, lon: 98.8543 },
      { name: '迪庆', lat: 27.8190, lon: 99.7063 },
      // ── 西藏（7市地）─────────────────────────────────
      { name: '日喀则', lat: 29.2671, lon: 88.8808 },
      { name: '昌都', lat: 31.1369, lon: 97.1786 },
      { name: '林芝', lat: 29.6491, lon: 94.3623 },
      { name: '山南', lat: 29.2360, lon: 91.7730 },
      { name: '那曲', lat: 31.4762, lon: 92.0513 },
      { name: '阿里', lat: 32.5017, lon: 80.1055 },
      // ── 陕西（10市）──────────────────────────────────
      { name: '铜川', lat: 34.8966, lon: 108.9451 },
      { name: '宝鸡', lat: 34.3610, lon: 107.2393 },
      { name: '咸阳', lat: 34.3296, lon: 108.7090 },
      { name: '渭南', lat: 34.5194, lon: 109.5100 },
      { name: '延安', lat: 36.5853, lon: 109.4897 },
      { name: '汉中', lat: 33.0677, lon: 107.0234 },
      { name: '榆林', lat: 38.2884, lon: 109.7341 },
      { name: '安康', lat: 32.6849, lon: 109.0289 },
      { name: '商洛', lat: 33.8688, lon: 109.9404 },
      // ── 甘肃（12市）──────────────────────────────────
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
      // ── 青海（8市州）─────────────────────────────────
      { name: '海东', lat: 36.5029, lon: 102.1026 },
      { name: '海北', lat: 36.9596, lon: 100.9010 },
      { name: '黄南', lat: 35.5175, lon: 102.0148 },
      { name: '海南', lat: 36.2841, lon: 100.6196 },
      { name: '果洛', lat: 34.4716, lon: 100.2436 },
      { name: '玉树', lat: 33.0040, lon: 97.0085 },
      { name: '海西', lat: 37.3776, lon: 97.3709 },
      // ── 宁夏（5市）───────────────────────────────────
      { name: '石嘴山', lat: 39.0133, lon: 106.3792 },
      { name: '吴忠', lat: 37.9978, lon: 106.1989 },
      { name: '固原', lat: 36.0155, lon: 106.2428 },
      { name: '中卫', lat: 37.5149, lon: 105.1965 },
      // ── 新疆（14地州市）─────────────────────────────
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
      // ── 东南亚主要城市（高缩放显示，仅底图标注）──────────
      { name: '清迈', lat: 18.7883, lon: 98.9853 },
      { name: '普吉', lat: 7.8804, lon: 98.3923 },
      { name: '海防', lat: 20.8449, lon: 106.6881 },
      { name: '岘港', lat: 16.0544, lon: 108.2022 },
      { name: '暹粒', lat: 13.3633, lon: 103.8564 },
      { name: '琅勃拉邦', lat: 19.8834, lon: 102.1347 },
      { name: '曼德勒', lat: 21.9588, lon: 96.0891 },
      { name: '内比都', lat: 19.7633, lon: 96.0785 },
      { name: '槟城', lat: 5.4141, lon: 100.3288 },
      { name: '新山', lat: 1.4927, lon: 103.7414 },
      { name: '哥打基纳巴卢', lat: 5.9804, lon: 116.0735 },
      { name: '泗水', lat: -7.2575, lon: 112.7521 },
      { name: '万隆', lat: -6.9175, lon: 107.6191 },
      { name: '棉兰', lat: 3.5952, lon: 98.6722 },
      { name: '登巴萨', lat: -8.6705, lon: 115.2126 },
      // ── 中亚/南亚/俄罗斯/澳大利亚主要城市（高缩放显示，仅底图标注）──
      { name: '撒马尔罕', lat: 39.6542, lon: 66.9597 },
      { name: '奥什', lat: 40.5283, lon: 72.7985 },
      { name: '土库曼纳巴德', lat: 39.0833, lon: 63.5667 },
      { name: '班加罗尔', lat: 12.9716, lon: 77.5946 },
      { name: '金奈', lat: 13.0827, lon: 80.2707 },
      { name: '海得拉巴', lat: 17.3850, lon: 78.4867 },
      { name: '拉合尔', lat: 31.5204, lon: 74.3587 },
      { name: '伊斯兰堡', lat: 33.6844, lon: 73.0479 },
      { name: '吉大港', lat: 22.3569, lon: 91.7832 },
      { name: '廷布', lat: 27.4728, lon: 89.6390 },
      { name: '马累', lat: 4.1755, lon: 73.5093 },
      { name: '喀布尔', lat: 34.5553, lon: 69.2075 },
      { name: '叶卡捷琳堡', lat: 56.8389, lon: 60.6057 },
      { name: '伊尔库茨克', lat: 52.2869, lon: 104.3050 },
      { name: '哈巴罗夫斯克', lat: 48.4802, lon: 135.0719 },
      { name: '堪培拉', lat: -35.2809, lon: 149.1300 },
      { name: '阿德莱德', lat: -34.9285, lon: 138.6007 },
      { name: '达尔文', lat: -12.4634, lon: 130.8456 },
    ];

    // ─── level3: 重要县级市（缩放>9）────────────────────────────
    const level3 = [
      { name: '昆山', lat: 31.3886, lon: 120.9537 },
      { name: '常熟', lat: 31.6535, lon: 120.7523 },
      { name: '张家港', lat: 31.8756, lon: 120.5555 },
      { name: '江阴', lat: 31.9111, lon: 120.2860 },
      { name: '宜兴', lat: 31.3403, lon: 119.8235 },
      { name: '溧阳', lat: 31.4168, lon: 119.4846 },
      { name: '丹阳', lat: 32.0101, lon: 119.6062 },
      { name: '靖江', lat: 32.0181, lon: 120.2735 },
      { name: '泰兴', lat: 32.1723, lon: 120.0519 },
      { name: '启东', lat: 31.8082, lon: 121.6576 },
      { name: '海安', lat: 32.5345, lon: 120.4672 },
      { name: '高邮', lat: 32.7811, lon: 119.4557 },
      { name: '仪征', lat: 32.2725, lon: 119.1834 },
      { name: '义乌', lat: 29.3056, lon: 120.0750 },
      { name: '余姚', lat: 30.0392, lon: 121.1535 },
      { name: '慈溪', lat: 30.1697, lon: 121.2663 },
      { name: '海宁', lat: 30.5097, lon: 120.6807 },
      { name: '桐乡', lat: 30.6301, lon: 120.5648 },
      { name: '诸暨', lat: 29.7070, lon: 120.2363 },
      { name: '乐清', lat: 28.1075, lon: 120.9821 },
      { name: '瑞安', lat: 27.7784, lon: 120.6279 },
      { name: '晋江', lat: 24.7817, lon: 118.5530 },
      { name: '石狮', lat: 24.7328, lon: 118.6481 },
      { name: '福清', lat: 25.4183, lon: 119.2278 },
      { name: '浏阳', lat: 28.1628, lon: 113.6332 },
      { name: '仙桃', lat: 30.3620, lon: 113.4540 },
      { name: '天门', lat: 30.6534, lon: 113.1660 },
      { name: '潜江', lat: 30.4020, lon: 112.8990 },
    ];

    return { level1, level2, level3 };
  }

  /**
   * 去重校验：过滤重复 name 城市条目
   */
  _deduplicateCities(cities) {
    const seen = new Set();
    return cities.filter(c => {
      if (seen.has(c.name)) return false;
      seen.add(c.name);
      return true;
    });
  }

  /**
   * 添加城市标注（缩放分级：低缩放不拥挤，高缩放全量显示）
   */
  _addCityMarkers() {
    const { level1, level2, level3 } = this._getCityData();

    // 去重
    const L1 = this._deduplicateCities(level1);
    const L2 = this._deduplicateCities(level2);
    const L3 = this._deduplicateCities(level3);

    // 创建城市图层组
    this._cityMarkersLayer = window.L.layerGroup().addTo(this._map);

    const updateCityVisibility = () => {
      const zoom = this._map.getZoom();
      this._cityMarkersLayer.clearLayers();

      const isMobile = isMobileMapViewport();
      const citiesToShow = selectCitiesForZoom({ level1: L1, level2: L2, level3: L3 }, zoom, isMobile);

      const mapTheme = getMapUiTokens();
      const isDark = isDarkMapTheme();
      const textColor = isDark ? mapTheme.cityTextDark : mapTheme.cityText;
      const fontSize = isMobile
        ? (zoom < 6 ? '9px' : (zoom < 8 ? '10px' : (zoom < 10 ? '11px' : '12px')))
        : (zoom < 5 ? '10px' : (zoom < 7 ? '11px' : (zoom < 9 ? '12px' : '13px')));
      const dotRadius = isMobile
        ? (zoom < 6 ? 2.2 : (zoom < 8 ? 2.6 : (zoom < 10 ? 3 : 3.5)))
        : (zoom < 5 ? 3 : (zoom < 7 ? 3 : (zoom < 9 ? 3.5 : 4)));

      citiesToShow.forEach(city => {
        const cityLabel = escapeHtml(this._getLocalizedCityName(city));
        // 城市圆点
        const marker = window.L.circleMarker([city.lat, city.lon], {
          radius: dotRadius,
          fillColor: isDark ? mapTheme.cityFillDark : mapTheme.cityFill,
          color: isDark ? mapTheme.cityStrokeDark : mapTheme.cityStroke,
          weight: 1,
          opacity: 1,
          fillOpacity: 0.8
        });

        // 城市名称标签
        const icon = window.L.divIcon({
          className: 'city-label',
          html: `<span style="
            font-size: ${fontSize};
            font-weight: 500;
            color: ${textColor};
            text-shadow: ${isDark ? mapTheme.textShadowDark : mapTheme.textShadowLight};
            white-space: nowrap;
            pointer-events: none;
            margin-left: 3px;
          ">${cityLabel}</span>`,
          iconSize: null,
          iconAnchor: [0, zoom < 5 ? 4 : (zoom < 7 ? 5 : 6)]
        });

        const label = window.L.marker([city.lat, city.lon], { icon, interactive: false });

        this._cityMarkersLayer.addLayer(marker);
        this._cityMarkersLayer.addLayer(label);
      });

      console.log(`[ChinaMapCanvas] zoom=${zoom}，显示 ${citiesToShow.length} 个城市`);
    };

    // 初始显示
    this._cityVisibilityUpdater = updateCityVisibility;
    updateCityVisibility();

    // 监听缩放事件
    this._map.on('zoomend', updateCityVisibility);
  }

  /**
   * 应用地图样式
   */
  _applyStyle() {
    const isDark = this._options.style === 'dark' || (this._options.style !== 'light' && isDarkMapTheme());

    if (isDark) {
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

    const theme = getMapUiTokens();

    // 地图容器背景
    this._map.getContainer().style.backgroundColor = theme.mapBgDark;

    // GeoJSON 样式
    const darkStyle = {
      color: theme.boundaryStrokeDark,  // 边界线：橙色
      fillColor: theme.boundaryFillDark,
      weight: 1.5,
      opacity: 0.6,
      dashArray: '3',
      fillOpacity: 0.1,
      lineJoin: 'round',
      lineCap: 'round'
    };

    const eastAsiaDarkStyle = {
      ...darkStyle,
      weight: 1.05,
      opacity: 0.5,
      dashArray: null
    };

    if (this._geoJsonLayer) {
      this._geoJsonLayer.setStyle(darkStyle);
    }
    if (this._eastAsiaLayer) {
      this._eastAsiaLayer.setStyle(eastAsiaDarkStyle);
    }
  }

  /**
   * 应用亮色主题
   */
  _applyLightTheme() {
    if (!this._map) return;

    const theme = getMapUiTokens();

    // 地图容器背景
    this._map.getContainer().style.backgroundColor = theme.mapBg;

    // GeoJSON 样式
    const lightStyle = {
      color: theme.boundaryStroke,  // 边界线：深灰色
      fillColor: theme.boundaryFill,
      weight: 1.5,
      opacity: 0.5,
      dashArray: '3',
      fillOpacity: 0.1,
      lineJoin: 'round',
      lineCap: 'round'
    };

    const eastAsiaLightStyle = {
      ...lightStyle,
      weight: 1.05,
      opacity: 0.45,
      dashArray: null
    };

    if (this._geoJsonLayer) {
      this._geoJsonLayer.setStyle(lightStyle);
    }
    if (this._eastAsiaLayer) {
      this._eastAsiaLayer.setStyle(eastAsiaLightStyle);
    }
  }

  /**
   * 添加地图图例（分数→颜色，朝霞/晚霞色系跟随）
   */
  _addLegend() {
    if (!this._map) return;

    const theme = getMapUiTokens();
    const Legend = window.L.Control.extend({
      options: { position: 'bottomright' },
      onAdd: () => {
        const div = document.createElement('div');
        div.id = 'china-map-legend';
        div.className = 'china-map-legend';
        div.style.setProperty('--map-legend-bg', theme.legendBg);
        div.style.setProperty('--map-legend-text', theme.legendText);
        div.style.setProperty('--map-legend-border', theme.legendBorder);
        return div;
      }
    });

    this._legendControl = new Legend();
    this._legendControl.addTo(this._map);
    this._updateLegend();
  }

  /**
   * 更新图例内容（根据当前 period 切换色系）
   */
  _updateLegend() {
    const el = document.getElementById('china-map-legend');
    if (!el) return;

    const isSunrise = this._currentPeriod === 'sunrise';

    const colorMode = (() => {
      try { return localStorage.getItem('firecloud_raster_color_mode') || 'compact'; } catch (_) { return 'compact'; }
    })();

    // 使用与 ChinaRasterOverlay 一致的色阶采样
    const compactItems = [
      { score: 0, label: '<40', color: 'rgba(255,255,255,0.08)' },
      { score: 40, label: '40', color: isSunrise ? 'rgba(255,230,210,0.18)' : 'rgba(255,230,210,0.14)' },
      { score: 50, label: '50', color: isSunrise ? 'rgba(255,185,150,0.30)' : 'rgba(255,185,150,0.22)' },
      { score: 60, label: '60', color: isSunrise ? 'rgba(248,132,82,0.46)' : 'rgba(248,132,54,0.36)' },
      { score: 70, label: '70+', color: isSunrise ? 'rgba(218,78,28,0.65)' : 'rgba(218,78,28,0.55)' },
    ];
    const fullItems = [
      { score: 0, label: '<30', color: 'rgba(255,255,255,0.08)' },
      { score: 30, label: '30', color: isSunrise ? 'rgba(255,230,210,0.14)' : 'rgba(255,230,210,0.11)' },
      { score: 40, label: '40', color: isSunrise ? 'rgba(255,184,126,0.28)' : 'rgba(255,184,126,0.22)' },
      { score: 55, label: '55', color: isSunrise ? 'rgba(238,120,90,0.44)' : 'rgba(238,120,90,0.34)' },
      { score: 70, label: '70+', color: isSunrise ? 'rgba(218,78,28,0.65)' : 'rgba(218,78,28,0.55)' },
    ];
    const legendItems = colorMode === 'full' ? fullItems : compactItems;

    const theme = getMapUiTokens();
    const rows = legendItems.map(item => {
      return `<div class="china-map-legend-row"><span class="china-map-legend-swatch" style="background:${item.color};"></span><span class="china-map-legend-value">${item.label}</span></div>`;
    }).join('');

    const titleText = isSunrise ? mapUiText('sunriseScore') : mapUiText('sunsetScore');
    el.innerHTML = `<div class="china-map-legend-title">${escapeHtml(titleText)}</div>${rows}`;
    el.style.setProperty('--map-legend-title-text', theme.legendText);
  }

  /**
   * 切换当前时段（供外部调用更新图例色系）
   */
  setPeriod(period) {
    this._currentPeriod = period;
    this._updateLegend();
  }

  /**
   * 添加点击地图查询分数功能（移动端 tap 兼容）
   */
  _addClickHandler() {
    if (!this._map) return;

    this._map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      this._showClickPopup(lat, lng);
    });
  }

  async _fetchPointCloudHumidity(lat, lon) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 5000);

      const res = await fetch(`/api/weather/forecast?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}&hours=24`, {
        signal: ctrl.signal,
      });

      clearTimeout(timer);
      if (!res.ok) return null;

      const json = await res.json();
      const point = Array.isArray(json?.data) ? json.data[0] : null;
      if (!point) return null;

      return {
        highClouds: Number.isFinite(point.highClouds) ? `${Math.round(point.highClouds)}%` : '--',
        midClouds: Number.isFinite(point.midClouds) ? `${Math.round(point.midClouds)}%` : '--',
        lowClouds: Number.isFinite(point.lowClouds) ? `${Math.round(point.lowClouds)}%` : '--',
        humidity: Number.isFinite(point.humidity) ? `${Math.round(point.humidity)}%` : '--',
      };
    } catch (_) {
      return null;
    }
  }

  _getScoreQueryPeriod() {
    return this._currentPeriod === 'test' ? 'sunset' : this._currentPeriod;
  }

  async _fetchExactPointScore(lat, lon) {
    const period = this._getScoreQueryPeriod();
    const date = new Date().toISOString().slice(0, 10);

    try {
      const res = await fetch('/api/prediction/enhanced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lon, date, type: period })
      });

      if (res.ok) {
        const data = await res.json();
        const score = Number(data?.data?.score);
        if (Number.isFinite(score)) return score;
      }
    } catch (_) {
      // Fall back to the raster sample below.
    }

    try {
      const res = await fetch(`/api/spots/china/raster?period=${period}&resolution=0.5&lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`);
      if (res.ok) {
        const data = await res.json();
        const score = Number(data?.score);
        if (Number.isFinite(score)) return score;
      }
    } catch (_) {
      // API unavailable: caller will render no-data.
    }

    return null;
  }

  /**
   * 在点击位置显示 popup：地点名 + 分数
   * 尝试反向解析城市名，失败则显示经纬度
   */
  async _showClickPopup(lat, lon) {
    if (!this._map) return;

    // 关闭之前的 popup
    if (this._clickPopup) {
      this._map.closePopup(this._clickPopup);
    }

    const popupTheme = getMapUiTokens();
    // 临时 loading popup
    const loadingPopup = window.L.popup({
      closeButton: true,
      className: 'china-click-popup',
      maxWidth: 220,
    })
      .setLatLng([lat, lon])
      .setContent(`<span style="color:${popupTheme.popupLoadingText};">${escapeHtml(mapUiText('loading'))}</span>`)
      .openOn(this._map);

    this._clickPopup = loadingPopup;

    try {
      // 尝试从城市列表中匹配最近的城市
      const cityName = this._findNearestCityName(lat, lon);

      const score = await this._fetchExactPointScore(lat, lon);

      const cloudHumidity = await this._fetchPointCloudHumidity(lat, lon);

      const locationText = cityName || `${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E`;
      const scoreText = score !== null ? `${Math.round(score)} ${mapUiText('scoreUnit')}` : mapUiText('noData');
      const isHigh = score !== null && score >= 60;
      const scoreColor = isHigh ? popupTheme.scoreTextHigh : (score !== null && score >= 30 ? popupTheme.scoreTextMid : popupTheme.scoreTextLow);
      const cloudHumidityLine = cloudHumidity
        ? `${mapUiText('highCloud')} ${cloudHumidity.highClouds} · ${mapUiText('midCloud')} ${cloudHumidity.midClouds} · ${mapUiText('lowCloud')} ${cloudHumidity.lowClouds} · ${mapUiText('humidity')} ${cloudHumidity.humidity}`
        : '';
      const periodText = this._currentPeriod === 'sunrise' ? mapUiText('sunriseScore') : mapUiText('sunsetScore');

      loadingPopup.setContent(`
        <div style="font-size:13px;line-height:1.6;color:${popupTheme.popupText};">
          <div style="font-weight:600;margin-bottom:2px;">${escapeHtml(locationText)}</div>
          <div style="color:${scoreColor};font-size:15px;font-weight:700;">${escapeHtml(scoreText)}</div>
          ${cloudHumidityLine ? `<div style="color:${popupTheme.popupMutedText};font-size:11px;">${escapeHtml(cloudHumidityLine)}</div>` : ''}
          <div style="color:${popupTheme.popupHintText};font-size:10px;margin-top:2px;">${escapeHtml(periodText)} · ${escapeHtml(mapUiText('currentPeriod'))}</div>
        </div>
      `);
    } catch (err) {
      loadingPopup.setContent(`<span style="color:${popupTheme.scoreTextError};">${escapeHtml(mapUiText('queryFailed'))}: ${escapeHtml(err.message)}</span>`);
    }

  }

  /**
   * 查找最近的城市名（简单距离比较）
   */
  _findNearestCityName(lat, lon) {
    const { level1, level2 } = this._getCityData();
    const allCities = this._deduplicateCities([...level1, ...level2]);

    let minDist = Infinity;
    let nearest = null;

    for (const city of allCities) {
      const dLat = city.lat - lat;
      const dLon = (city.lon - lon) * Math.cos(lat * Math.PI / 180);
      const dist = dLat * dLat + dLon * dLon;
      if (dist < minDist) {
        minDist = dist;
        nearest = city;
      }
    }

    // 仅在 0.5 度（约 50km）内认为"附近"
    if (nearest && minDist < 0.25) {
      return this._getLocalizedCityName(nearest);
    }
    return null;
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
export { selectCitiesForZoom, mergeUniqueCities, isMobileMapViewport };
