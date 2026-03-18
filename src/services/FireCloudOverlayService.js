/**
 * FireCloudOverlayService - 火烧云地图覆盖层服务
 *
 * Phase 6 重构：使用 Leaflet L.imageOverlay() 替代 DOM 覆盖层
 * Phase 12 重构：新增 L.tileLayer 模式，拖动/缩放与底图完全同步
 * Phase 17 重构：新增 canvas-native 模式（NativeFireCloudRenderer），拖动实时跟手
 *
 * 渲染模式（localStorage: firecloud_render_mode）：
 *   canvas-native  — 推荐，原生 Canvas 实时跟手（默认）
 *   tile-layer     — Leaflet tileLayer，兼容
 *   image-overlay  — 单图覆盖，已弃用
 *
 * 需求：20.1, 20.4, 20.7, 20.9, 20.10, 20.11, 20.14, 38
 */

import NativeFireCloudRenderer from './NativeFireCloudRenderer.js';

class FireCloudOverlayService {
  constructor() {
    this.leafletOverlay = null; // Leaflet L.imageOverlay 或 L.tileLayer 实例
    this.mapService = null;
    this._tileLayerMode = false; // 当前是否使用 tileLayer 模式
    this._nativeMode = false;    // 当前是否使用 canvas-native 模式
    this._nativeRenderer = null; // NativeFireCloudRenderer 实例
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

    // 后端 API 配置
    this.useBackendOverlay = true; // 优先使用后端 GFS 数据
    this.backendURL = 'http://localhost:3000';
  }

  /**
   * 设置后端 API 基础 URL
   * @param {string} url - 后端 URL
   */
  setBackendURL(url) {
    this.backendURL = url;
    if (this._nativeRenderer) this._nativeRenderer.proxyURL = url;
  }

  getRenderMode() {
    try { return localStorage.getItem('firecloud_render_mode') || 'canvas-native'; }
    catch (_) { return 'canvas-native'; }
  }

  setRenderMode(mode) {
    try { localStorage.setItem('firecloud_render_mode', mode); } catch (_) {}
  }

  /**
   * 生成缓存键
   * @private
   */
  _getCacheKey(lat, lon, radius, type) {
    return `firecloud_${lat.toFixed(2)}_${lon.toFixed(2)}_${radius}_${type}`;
  }

  /**
   * 检查缓存是否有效
   * @private
   */
  _isCacheValid(cacheItem) {
    if (!cacheItem || !cacheItem.timestamp) {
      return false;
    }
    return (Date.now() - cacheItem.timestamp) < this.CACHE_DURATION;
  }

  /**
   * 从后端 GFS API 获取覆盖层数据
   * @param {Object} centerLocation - 中心位置 {lat, lon}
   * @param {number} radius - 半径（公里）
   * @param {string} type - 类型 ('sunrise' | 'sunset')
   * @returns {Promise<Object>} 覆盖层数据 { dataUrl, bounds, metadata }
   *
   * 需求：20.4, 20.11
   */
  async fetchBackendOverlay(centerLocation, radius = 200, type = 'sunset') {
    const { lat, lon } = centerLocation;

    console.log(`[FireCloudOverlayService] 从后端获取 GFS 覆盖层: lat=${lat}, lon=${lon}, radius=${radius}`);

    const url = `${this.backendURL}/api/firecloud/overlay?lat=${lat}&lon=${lon}&radius=${radius}&type=${type}`;

    const response = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(30000) // 30秒超时
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `后端 API 错误: HTTP ${response.status}`);
    }

    const data = await response.json();

    return {
      dataUrl: data.image,
      bounds: data.bounds,
      metadata: {
        center: { lat, lon },
        radius,
        type,
        timestamp: data.timestamp,
        source: 'gfs'
      }
    };
  }

  /**
   * 生成覆盖层（前端 Canvas 或后端 GFS）
   * @param {Object} centerLocation - 中心位置 {lat, lon, name}
   * @param {Object[]} surroundingData - 周边点数据
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
      let result;

      // 优先尝试后端 GFS 数据
      if (this.useBackendOverlay) {
        try {
          result = await this.fetchBackendOverlay(centerLocation, radius, type);
          console.log('[FireCloudOverlayService] 后端 GFS 覆盖层获取成功');
        } catch (backendError) {
          console.warn('[FireCloudOverlayService] 后端不可用，回退到前端生成:', backendError.message);
          result = await this._generateFrontendOverlay(centerLocation, surroundingData, radius, type);
        }
      } else {
        result = await this._generateFrontendOverlay(centerLocation, surroundingData, radius, type);
      }

      // 缓存结果
      this.cache.set(cacheKey, {
        timestamp: Date.now(),
        data: result
      });

      this.isLoading = false;
      this.currentData = result;
      console.log('[FireCloudOverlayService] 覆盖层生成完成');
      return result;

    } catch (error) {
      this.isLoading = false;
      console.error('[FireCloudOverlayService] 生成覆盖层失败:', error);
      throw error;
    }
  }

  /**
   * 前端 Canvas 生成覆盖层（回退方案）
   * @private
   */
  async _generateFrontendOverlay(centerLocation, surroundingData, radius, type) {
    const { lat, lon } = centerLocation;
    const bounds = this._calculateBounds(lat, lon, radius);
    const canvas = await this._createHeatmapCanvas(surroundingData, bounds, centerLocation);
    const dataUrl = canvas.toDataURL('image/png');

    return {
      dataUrl,
      bounds,
      metadata: {
        center: { lat, lon },
        radius,
        type,
        timestamp: Date.now(),
        gridSize: this.config.gridSize,
        points: surroundingData.length,
        source: 'frontend'
      }
    };
  }

  /**
   * 计算覆盖层的地理边界
   * @private
   */
  _calculateBounds(centerLat, centerLon, radius) {
    const EARTH_RADIUS = 6371;
    const latDelta = (radius / EARTH_RADIUS) * (180 / Math.PI);
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
   * @private
   */
  async _createHeatmapCanvas(points, bounds, centerLocation) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const size = 512;
    canvas.width = size;
    canvas.height = size;

    ctx.clearRect(0, 0, size, size);

    // 为每个点绘制热力图效果
    points.forEach(point => {
      if (!point.score || point.score === 0) return;

      const x = this._lonToX(point.lon, bounds, size);
      const y = this._latToY(point.lat, bounds, size);
      const normalizedScore = point.score / 100;
      const color = this._getColorForScore(normalizedScore);
      const radius = 30 + normalizedScore * 20;

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

  /** @private */
  _lonToX(lon, bounds, size) {
    const lonRange = bounds.east - bounds.west;
    return ((lon - bounds.west) / lonRange) * size;
  }

  /** @private */
  _latToY(lat, bounds, size) {
    const latRange = bounds.north - bounds.south;
    return (1 - (lat - bounds.south) / latRange) * size;
  }

  /** @private */
  _getColorForScore(normalizedScore) {
    if (normalizedScore >= 0.7) return this.config.colors.high;
    if (normalizedScore >= 0.4) return this.config.colors.medium;
    return this.config.colors.low;
  }

  /**
   * 在地图上以 L.tileLayer 模式显示火烧云覆盖层
   * 拖动/缩放时由 Leaflet 自动补瓦片，与底图完全同步
   *
   * @param {Object} mapService - WindyMapService 实例
   * @param {string} type - 预测类型 'sunset' | 'sunrise'
   * @returns {boolean} 是否成功
   */
  displayTileLayer(mapService, type = 'sunset') {
    const map = mapService && mapService.getMap ? mapService.getMap() : null;
    if (!map || typeof L === 'undefined') {
      console.error('[FireCloudOverlayService] 无法获取 Leaflet map 实例');
      return false;
    }

    try {
      this.removeOverlay();
      this.mapService = mapService;

      const tileUrl = `${this.backendURL}/api/firecloud/tiles/{z}/{x}/{y}.png?type=${type}&time=${Date.now()}`;

      this.leafletOverlay = L.tileLayer(tileUrl, {
        opacity: this.config.opacity,
        zIndex: 400,
        tileSize: 256,
        maxZoom: 12,
        minZoom: 2,
        attribution: '火烧云预测 · 霞客',
        // 瓦片加载失败时静默（不显示破图标）
        errorTileUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
      }).addTo(map);

      this._tileLayerMode = true;
      console.log('[FireCloudOverlayService] TileLayer 覆盖层已挂载，type=' + type);
      return true;
    } catch (error) {
      console.error('[FireCloudOverlayService] TileLayer 挂载失败:', error);
      return false;
    }
  }

  /**
   * 在地图上显示覆盖层
   * 渲染模式由 localStorage(firecloud_render_mode) 决定：
   *   canvas-native → NativeFireCloudRenderer（默认，拖动实时跟手）
   *   tile-layer    → L.tileLayer
   *   image-overlay → L.imageOverlay（降级）
   *
   * @param {Object} mapService - WindyMapService 实例（Leaflet 版本）
   * @param {Object} overlayData - 覆盖层数据 { dataUrl, bounds, metadata }
   * @param {HTMLElement} container - 兼容性参数
   * @returns {boolean} 是否成功
   *
   * 需求：20.7, 20.9, 38
   */
  displayOnMap(mapService, overlayData, container) {
    if (!mapService) {
      console.error('[FireCloudOverlayService] 缺少 mapService');
      return false;
    }

    const mode = this.getRenderMode();
    const type = overlayData?.metadata?.type || 'sunset';

    if (mode === 'canvas-native') {
      const map = mapService.getMap ? mapService.getMap() : null;
      if (map) {
        try {
          this.removeOverlay();
          this.mapService = mapService;
          if (!this._nativeRenderer) {
            this._nativeRenderer = new NativeFireCloudRenderer({
              proxyURL: this.backendURL, type, opacity: this.config.opacity
            });
            this._nativeRenderer.init(map);
          } else {
            this._nativeRenderer.setType(type);
          }
          this._nativeRenderer.show();
          this._nativeMode = true;
          console.log('[FireCloudOverlayService] canvas-native 渲染器已启动');
          return true;
        } catch (err) {
          console.error('[FireCloudOverlayService] canvas-native 启动失败，降级:', err);
        }
      }
    }

    // tile-layer（含 canvas-native 降级）
    if (mode !== 'image-overlay') {
      return this.displayTileLayer(mapService, type);
    }

    // image-overlay
    if (!overlayData) {
      console.warn('[FireCloudOverlayService] image-overlay 无 overlayData，降级 tile-layer');
      return this.displayTileLayer(mapService, type);
    }

    try {
      this.removeOverlay();
      this.mapService = mapService;

      if (mapService.addImageOverlay) {
        this.leafletOverlay = mapService.addImageOverlay(
          overlayData.dataUrl, overlayData.bounds,
          { opacity: this.config.opacity, interactive: false, zIndex: 400 }
        );
        if (this.leafletOverlay) {
          this._tileLayerMode = false;
          console.log('[FireCloudOverlayService] imageOverlay 已显示');
          return true;
        }
      }

      const map = mapService.getMap ? mapService.getMap() : null;
      if (map && typeof L !== 'undefined') {
        const bounds = L.latLngBounds(
          [overlayData.bounds.south, overlayData.bounds.west],
          [overlayData.bounds.north, overlayData.bounds.east]
        );
        this.leafletOverlay = L.imageOverlay(overlayData.dataUrl, bounds, {
          opacity: this.config.opacity, interactive: false, zIndex: 400
        }).addTo(map);
        this._tileLayerMode = false;
        return true;
      }

      console.error('[FireCloudOverlayService] 无法添加覆盖层');
      return false;
    } catch (error) {
      console.error('[FireCloudOverlayService] 显示覆盖层失败:', error);
      return false;
    }
  }

  /**
   * 移除覆盖层（支持 canvas-native / tileLayer / imageOverlay）
   *
   * 需求：20.7
   */
  removeOverlay() {
    if (this._nativeMode && this._nativeRenderer) {
      this._nativeRenderer.hide();
      this._nativeMode = false;
    }

    if (this.leafletOverlay) {
      const overlayRef = this.leafletOverlay;
      const wasTileLayer = this._tileLayerMode;
      this.leafletOverlay.remove();
      this.leafletOverlay = null;
      this._tileLayerMode = false;
      console.log('[FireCloudOverlayService] 覆盖层已移除');

      if (!wasTileLayer && this.mapService && this.mapService.removeImageOverlay) {
        this.mapService.removeImageOverlay(overlayRef);
      }
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
      // 清除相关缓存
      const cacheKey = this._getCacheKey(centerLocation.lat, centerLocation.lon, radius, type);
      this.cache.delete(cacheKey);

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
      hasOverlay: !!this.leafletOverlay || this._nativeMode,
      renderMode: this.getRenderMode(),
      tileLayerMode: this._tileLayerMode,
      nativeMode: this._nativeMode,
      cacheSize: this.cache.size,
      useBackendOverlay: this.useBackendOverlay,
      source: this._nativeMode ? 'canvas-native'
            : this._tileLayerMode ? 'tile-service'
            : (this.currentData?.metadata?.source || null),
      ...(this._nativeMode && this._nativeRenderer ? this._nativeRenderer.getStatus() : {})
    };
  }
}

export default FireCloudOverlayService;
