/**
 * WindyMapService - Windy地图服务
 *
 * 封装Windy Map Forecast API，提供地图初始化和交互功能
 * 需求：18.1, 18.4
 */

class WindyMapService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.map = null;
    this.windyAPI = null;
    this.isInitialized = false;
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
      overlay: 'wind',
      level: 'surface',
      forecast: 'ECMWF'
    };

    const mapOptions = { ...defaultOptions, ...options };

    try {
      console.log('[WindyMapService] 正在初始化地图...');

      // 检查Windy API是否可用
      if (typeof window.W === 'undefined') {
        throw new Error('Windy API 未加载。请确保已引入Windy API库。');
      }

      // 初始化Windy API
      this.windyAPI = await window.W.init({
        key: this.apiKey,
        verbose: true,
        picker: true,
        orient: true,
        hourFormat: '24h',
        container: containerId,
        ...mapOptions
      });

      this.map = this.windyAPI.map;
      this.isInitialized = true;

      console.log('[WindyMapService] 地图初始化成功');

      // 触发地图初始化完成事件
      window.dispatchEvent(new CustomEvent('mapInitialized', {
        detail: { map: this.map, windyAPI: this.windyAPI }
      }));

    } catch (error) {
      console.error('[WindyMapService] 地图初始化失败:', error);
      throw error;
    }
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

    if (zoom !== undefined) {
      this.map.setView([lat, lon], zoom);
    } else {
      this.map.setView([lat, lon]);
    }

    console.log('[WindyMapService] 地图已移动到:', lat, lon);
  }

  /**
   * 更改地图叠加层
   * @param {string} overlay - 叠加层类型 ('wind', 'temp', 'rain', 'clouds', etc.)
   *
   * 需求：18.1
   */
  changeOverlay(overlay) {
    if (!this.isInitialized || !this.windyAPI) {
      console.warn('[WindyMapService] 地图未初始化');
      return;
    }

    this.windyAPI.setOverlay(overlay);
    console.log('[WindyMapService] 叠加层已更改为:', overlay);
  }

  /**
   * 任务18.3.3：设置地图时间
   * @param {number} timestamp - Unix时间戳（毫秒）
   */
  setTimestamp(timestamp) {
    if (!this.isInitialized || !this.windyAPI) {
      console.warn('[WindyMapService] 地图未初始化');
      return;
    }

    // 检查时间戳是否在允许范围内
    const allowedRange = this.getAllowedTimestampRange();
    if (allowedRange && (timestamp < allowedRange.min || timestamp > allowedRange.max)) {
      console.warn('[WindyMapService] 时间戳超出允许范围:', allowedRange);
      return false;
    }

    this.windyAPI.store.set('timestamp', timestamp);
    console.log('[WindyMapService] 时间戳已设置为:', new Date(timestamp).toISOString());
    return true;
  }

  /**
   * 任务18.3.3：获取当前时间戳
   * @returns {number|null} 当前时间戳（毫秒）
   */
  getTimestamp() {
    if (!this.isInitialized || !this.windyAPI) {
      return null;
    }
    return this.windyAPI.store.get('timestamp');
  }

  /**
   * 任务18.3.3：获取允许的时间戳范围
   * @returns {Object|null} 包含min和max时间戳的对象
   */
  getAllowedTimestampRange() {
    if (!this.isInitialized || !this.windyAPI) {
      return null;
    }
    return this.windyAPI.store.getAllowed('timestamp');
  }

  /**
   * 获取当前地图状态
   * @returns {Object|null} 地图状态信息
   */
  getStatus() {
    if (!this.isInitialized) {
      return null;
    }

    const center = this.map.getCenter();
    return {
      isInitialized: this.isInitialized,
      center: {
        lat: center.lat,
        lon: center.lng
      },
      zoom: this.map.getZoom(),
      overlay: this.windyAPI.getOverlay ? this.windyAPI.getOverlay() : null,
      timestamp: this.getTimestamp()
    };
  }

  /**
   * 销毁地图
   *
   * 需求：18.1
   */
  destroy() {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }

    this.windyAPI = null;
    this.isInitialized = false;

    console.log('[WindyMapService] 地图已销毁');
  }
}

export default WindyMapService;
