/**
 * FireCloudOverlayService - 火烧云地图覆盖层服务
 *
 * 生成并管理火烧云预测的地理热力图覆盖层
 * 需求：20.1, 20.4, 20.7, 20.9, 20.10, 20.11, 20.14
 */

class FireCloudOverlayService {
  constructor() {
    this.overlay = null;
    this.mapService = null;
    this.currentData = null;
    this.isLoading = false;
    this.cache = new Map();
    this.CACHE_DURATION = 30 * 60 * 1000; // 30分钟

    // 覆盖层配置
    this.config = {
      gridSize: 50, // 网格大小（像素）
      opacity: 0.6, // 不透明度
      colors: {
        high: [255, 69, 0],    // 红橙色 - 高概率
        medium: [255, 215, 0], // 金色 - 中等概率
        low: [128, 128, 128]   // 灰色 - 低概率
      }
    };
  }

  /**
   * 生成缓存键
   * @param {number} lat - 纬度
   * @param {number} lon - 经度
   * @param {number} radius - 半径（公里）
   * @param {string} type - 类型 (sunrise/sunset)
   * @returns {string} 缓存键
   * @private
   */
  _getCacheKey(lat, lon, radius, type) {
    return `firecloud_${lat.toFixed(2)}_${lon.toFixed(2)}_${radius}_${type}`;
  }

  /**
   * 检查缓存是否有效
   * @param {Object} cacheItem - 缓存项
   * @returns {boolean} 是否有效
   * @private
   */
  _isCacheValid(cacheItem) {
    if (!cacheItem || !cacheItem.timestamp) {
      return false;
    }
    const now = Date.now();
    return (now - cacheItem.timestamp) < this.CACHE_DURATION;
  }

  /**
   * 生成熟力图覆盖层
   * @param {Object} centerLocation - 中心位置 {lat, lon, name}
   * @param {Object[]} surroundingData - 周边点数据（来自SurroundingPointsService）
   * @param {number} radius - 半径（公里）
   * @param {string} type - 类型 ('sunrise' | 'sunset')
   * @returns {Promise<Object>} 覆盖层数据 { dataUrl, bounds, metadata }
   *
   * 需求：20.4, 20.5
   */
  async generateOverlay(centerLocation, surroundingData, radius = 200, type = 'sunset') {
    const { lat, lon } = centerLocation;
    const cacheKey = this._getCacheKey(lat, lon, radius, type);

    // 检查缓存
    const cached = this.cache.get(cacheKey);
    if (cached && this._isCacheValid(cached)) {
      console.log('[FireCloudOverlayService] 使用缓存覆盖层');
      return cached.data;
    }

    this.isLoading = true;
    console.log('[FireCloudOverlayService] 生成覆盖层...');

    try {
      // 计算地理边界
      const bounds = this._calculateBounds(lat, lon, radius);

      // 创建Canvas并生成热力图
      const canvas = await this._createHeatmapCanvas(
        surroundingData,
        bounds,
        centerLocation
      );

      // 转换为DataURL
      const dataUrl = canvas.toDataURL('image/png');

      // 组装结果
      const result = {
        dataUrl,
        bounds,
        metadata: {
          center: { lat, lon },
          radius,
          type,
          timestamp: Date.now(),
          gridSize: this.config.gridSize,
          points: surroundingData.length
        }
      };

      // 缓存结果
      this.cache.set(cacheKey, {
        timestamp: Date.now(),
        data: result
      });

      this.isLoading = false;
      console.log('[FireCloudOverlayService] 覆盖层生成完成');
      return result;

    } catch (error) {
      this.isLoading = false;
      console.error('[FireCloudOverlayService] 生成覆盖层失败:', error);
      throw error;
    }
  }

  /**
   * 计算覆盖层的地理边界
   * @param {number} centerLat - 中心纬度
   * @param {number} centerLon - 中心经度
   * @param {number} radius - 半径（公里）
   * @returns {Object} 边界 { north, south, east, west }
   * @private
   */
  _calculateBounds(centerLat, centerLon, radius) {
    // 地球半径（公里）
    const EARTH_RADIUS = 6371;

    // 计算纬度范围
    const latDelta = (radius / EARTH_RADIUS) * (180 / Math.PI);

    // 计算经度范围（考虑纬度影响）
    const latRad = (centerLat * Math.PI) / 180;
    const lonDelta = (radius / (EARTH_RADIUS * Math.cos(latRad))) * (180 / Math.PI);

    return {
      north: centerLat + latDelta,
      south: centerLat - latDelta,
      east: centerLon + lonDelta,
      west: centerLon - lonDelta
    };
  }

  /**
   * 创建热力图Canvas
   * @param {Object[]} points - 周边点数据
   * @param {Object} bounds - 地理边界
   * @param {Object} centerLocation - 中心位置
   * @returns {Promise<HTMLCanvasElement>} Canvas元素
   * @private
   */
  async _createHeatmapCanvas(points, bounds, centerLocation) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // 设置Canvas尺寸
    const size = 512;
    canvas.width = size;
    canvas.height = size;

    // 清空Canvas（透明背景）
    ctx.clearRect(0, 0, size, size);

    // 为每个点绘制热力图效果
    points.forEach(point => {
      if (!point.score || point.score === 0) return;

      // 将经纬度转换为Canvas坐标
      const x = this._lonToX(point.lon, bounds, size);
      const y = this._latToY(point.lat, bounds, size);

      // 根据评分确定颜色和大小
      const normalizedScore = point.score / 100;
      const color = this._getColorForScore(normalizedScore);
      const radius = 30 + normalizedScore * 20; // 30-50像素半径

      // 绘制径向渐变
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);

      const [r, g, b] = color;
      const alpha = this.config.opacity * normalizedScore;

      gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha})`);
      gradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${alpha * 0.5})`);
      gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    });

    // 在中心点添加标记
    const centerX = size / 2;
    const centerY = size / 2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 8, 0, Math.PI * 2);
    ctx.stroke();

    return canvas;
  }

  /**
   * 将经度转换为Canvas X坐标
   * @param {number} lon - 经度
   * @param {Object} bounds - 边界
   * @param {number} size - Canvas尺寸
   * @returns {number} X坐标
   * @private
   */
  _lonToX(lon, bounds, size) {
    const lonRange = bounds.east - bounds.west;
    const normalizedLon = (lon - bounds.west) / lonRange;
    return normalizedLon * size;
  }

  /**
   * 将纬度转换为Canvas Y坐标
   * @param {number} lat - 纬度
   * @param {Object} bounds - 边界
   * @param {number} size - Canvas尺寸
   * @returns {number} Y坐标
   * @private
   */
  _latToY(lat, bounds, size) {
    const latRange = bounds.north - bounds.south;
    // 注意：Canvas Y轴向下，纬度向上
    const normalizedLat = 1 - (lat - bounds.south) / latRange;
    return normalizedLat * size;
  }

  /**
   * 根据评分获取颜色
   * @param {number} normalizedScore - 标准化评分（0-1）
   * @returns {number[]} RGB颜色数组
   * @private
   */
  _getColorForScore(normalizedScore) {
    if (normalizedScore >= 0.7) {
      return this.config.colors.high; // 红橙色
    } else if (normalizedScore >= 0.4) {
      return this.config.colors.medium; // 金色
    } else {
      return this.config.colors.low; // 灰色
    }
  }

  /**
   * 在地图上显示覆盖层
   * @param {Object} mapService - WindyMapService实例
   * @param {Object} overlayData - 覆盖层数据
   * @param {HTMLElement} container - 地图容器元素
   * @returns {boolean} 是否成功
   *
   * 需求：20.7, 20.9
   */
  displayOnMap(mapService, overlayData, container) {
    if (!mapService || !overlayData || !container) {
      console.error('[FireCloudOverlayService] 缺少必要参数');
      return false;
    }

    try {
      // 移除旧的覆盖层
      this.removeOverlay();

      // 创建覆盖层元素
      const overlayDiv = document.createElement('div');
      overlayDiv.id = 'firecloud-overlay';
      overlayDiv.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 1000;
        opacity: 0;
        transition: opacity 0.3s ease;
      `;

      // 创建图像元素
      const img = document.createElement('img');
      img.src = overlayData.dataUrl;
      img.style.cssText = `
        width: 100%;
        height: 100%;
        object-fit: cover;
      `;

      overlayDiv.appendChild(img);
      container.appendChild(overlayDiv);

      // 淡入效果
      requestAnimationFrame(() => {
        overlayDiv.style.opacity = '1';
      });

      this.overlay = overlayDiv;
      this.mapService = mapService;

      console.log('[FireCloudOverlayService] 覆盖层已显示');
      return true;

    } catch (error) {
      console.error('[FireCloudOverlayService] 显示覆盖层失败:', error);
      return false;
    }
  }

  /**
   * 移除覆盖层
   *
   * 需求：20.7
   */
  removeOverlay() {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
      console.log('[FireCloudOverlayService] 覆盖层已移除');
    }
  }

  /**
   * 刷新覆盖层
   * @param {Object} centerLocation - 中心位置
   * @param {Object[]} surroundingData - 周边点数据
   * @param {number} radius - 半径
   * @param {string} type - 类型
   * @returns {Promise<boolean>} 是否成功
   *
   * 需求：20.13
   */
  async refresh(centerLocation, surroundingData, radius, type) {
    try {
      // 移除旧覆盖层
      this.removeOverlay();

      // 生成新覆盖层
      const overlayData = await this.generateOverlay(
        centerLocation,
        surroundingData,
        radius,
        type
      );

      // 如果有地图服务，重新显示
      if (this.mapService) {
        const container = document.getElementById('map-container');
        if (container) {
          return this.displayOnMap(this.mapService, overlayData, container);
        }
      }

      return true;

    } catch (error) {
      console.error('[FireCloudOverlayService] 刷新覆盖层失败:', error);
      return false;
    }
  }

  /**
   * 清除所有缓存
   */
  clearCache() {
    this.cache.clear();
    console.log('[FireCloudOverlayService] 缓存已清除');
  }

  /**
   * 清除过期缓存
   */
  clearExpiredCache() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (!this._isCacheValid(value)) {
        this.cache.delete(key);
      }
    }
    console.log('[FireCloudOverlayService] 过期缓存已清除');
  }

  /**
   * 获取当前状态
   * @returns {Object} 状态信息
   */
  getStatus() {
    return {
      isLoading: this.isLoading,
      hasOverlay: !!this.overlay,
      cacheSize: this.cache.size
    };
  }
}

export default FireCloudOverlayService;
