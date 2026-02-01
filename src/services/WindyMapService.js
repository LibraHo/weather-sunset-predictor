/**
 * WindyMapService - Windy地图服务
 *
 * 使用Windy iframe嵌入方式显示地图（无需API密钥）
 * 需求：18.1, 18.4
 */

class WindyMapService {
  constructor(apiKey) {
    this.apiKey = apiKey; // 不再使用，保留用于向后兼容
    this.container = null;
    this.iframe = null;
    this.isInitialized = false;
    this.currentOptions = {};
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

    try {
      console.log('[WindyMapService] 正在初始化地图 (iframe嵌入模式)...');

      // 清空容器
      this.container.innerHTML = '';

      // 创建iframe嵌入Windy地图
      this.iframe = document.createElement('iframe');
      this.iframe.style.width = '100%';
      this.iframe.style.height = '100%';
      this.iframe.style.border = 'none';
      this.iframe.style.borderRadius = '8px';

      // Windy embed URL格式: https://embed.windy.com/?lat,lat,lon,zoom
      const embedUrl = `https://embed.windy.com/?${this.currentOptions.lat},${this.currentOptions.lon},${this.currentOptions.zoom}`;

      this.iframe.src = embedUrl;
      this.iframe.allowFullscreen = true;

      this.container.appendChild(this.iframe);
      this.isInitialized = true;

      console.log('[WindyMapService] 地图初始化成功 (iframe)');

      // 触发地图初始化完成事件
      window.dispatchEvent(new CustomEvent('mapInitialized', {
        detail: { iframe: this.iframe, options: this.currentOptions }
      }));

    } catch (error) {
      console.error('[WindyMapService] 地图初始化失败:', error);
      throw error;
    }
  }

  /**
   * 移动地图到指定位置 (iframe模式需要重新加载)
   * @param {number} lat - 纬度
   * @param {number} lon - 经度
   * @param {number} zoom - 缩放级别（可选）
   *
   * 需求：18.1
   */
  moveTo(lat, lon, zoom) {
    if (!this.isInitialized || !this.iframe) {
      console.warn('[WindyMapService] 地图未初始化');
      return;
    }

    // 更新当前位置
    this.currentOptions.lat = lat;
    this.currentOptions.lon = lon;
    if (zoom !== undefined) {
      this.currentOptions.zoom = zoom;
    }

    // iframe模式下需要重新加载
    const embedUrl = `https://embed.windy.com/?${this.currentOptions.lat},${this.currentOptions.lon},${this.currentOptions.zoom}`;
    this.iframe.src = embedUrl;

    console.log('[WindyMapService] 地图已移动到:', lat, lon);
  }

  /**
   * 更改地图叠加层 (iframe模式不支持此功能)
   * @param {string} overlay - 叠加层类型 ('wind', 'temp', 'rain', 'clouds', etc.)
   *
   * 需求：18.1
   */
  changeOverlay(overlay) {
    // iframe嵌入模式下，用户可以在Windy界面中手动切换图层
    console.log('[WindyMapService] iframe模式：请手动在地图界面切换图层');
  }

  /**
   * 任务18.3.3：设置地图时间 (iframe模式不支持此功能)
   * @param {number} timestamp - Unix时间戳（毫秒）
   */
  setTimestamp(timestamp) {
    // iframe嵌入模式下，用户可以在Windy界面中手动切换时间
    console.log('[WindyMapService] iframe模式：请手动在地图界面切换时间');
    return false;
  }

  /**
   * 任务18.3.3：获取当前时间戳 (iframe模式不支持此功能)
   * @returns {number|null} 当前时间戳（毫秒）
   */
  getTimestamp() {
    // iframe模式下无法获取时间戳
    return Date.now();
  }

  /**
   * 任务18.3.3：获取允许的时间戳范围 (iframe模式不支持此功能)
   * @returns {Object|null} 包含min和max时间戳的对象
   */
  getAllowedTimestampRange() {
    // iframe模式下无法获取时间范围
    return null;
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
      mode: 'iframe'
    };
  }

  /**
   * 销毁地图
   *
   * 需求：18.1
   */
  destroy() {
    if (this.iframe) {
      this.iframe.remove();
      this.iframe = null;
    }

    if (this.container) {
      this.container.innerHTML = '';
    }

    this.isInitialized = false;

    console.log('[WindyMapService] 地图已销毁');
  }
}

export default WindyMapService;
