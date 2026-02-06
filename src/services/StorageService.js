/**
 * StorageService - 本地存储服务
 * 
 * 管理浏览器LocalStorage中的数据，包括API密钥、位置信息和天气数据缓存
 * 
 * 需求：1.2 - API密钥存储
 * 需求：9.4, 9.5 - 数据缓存管理
 */

class StorageService {
  constructor() {
    this.STORAGE_KEYS = {
      API_KEY: 'windy_api_key',
      LAST_LOCATION: 'last_location',
      WEATHER_CACHE: 'weather_cache'
    };
    
    // 缓存有效期：30分钟（毫秒）
    this.CACHE_DURATION = 30 * 60 * 1000;
  }

  /**
   * 保存API密钥到本地存储
   * 
   * @param {string} apiKey - Windy API密钥
   * @throws {Error} 如果存储失败
   * 
   * 需求：1.2 - 将API密钥存储在浏览器本地存储中
   */
  saveAPIKey(apiKey) {
    if (!apiKey || typeof apiKey !== 'string') {
      throw new Error('API密钥必须是非空字符串');
    }

    try {
      localStorage.setItem(this.STORAGE_KEYS.API_KEY, apiKey);
    } catch (error) {
      // LocalStorage可能因为配额满或隐私模式而失败
      console.error('保存API密钥失败:', error);
      throw new Error('无法保存API密钥，请检查浏览器存储设置');
    }
  }

  /**
   * 从本地存储获取API密钥
   * 
   * @returns {string|null} API密钥，如果未设置则返回null
   * 
   * 需求：1.2 - 从本地存储读取API密钥
   */
  getAPIKey() {
    try {
      return localStorage.getItem(this.STORAGE_KEYS.API_KEY);
    } catch (error) {
      console.error('读取API密钥失败:', error);
      return null;
    }
  }

  /**
   * 删除API密钥
   */
  removeAPIKey() {
    try {
      localStorage.removeItem(this.STORAGE_KEYS.API_KEY);
    } catch (error) {
      console.error('删除API密钥失败:', error);
    }
  }

  /**
   * 保存上次使用的位置
   * 
   * @param {Location} location - 位置对象
   */
  saveLastLocation(location) {
    if (!location) {
      return;
    }

    try {
      const locationData = {
        lat: location.lat,
        lon: location.lon,
        name: location.name
      };
      localStorage.setItem(
        this.STORAGE_KEYS.LAST_LOCATION,
        JSON.stringify(locationData)
      );
    } catch (error) {
      console.error('保存位置失败:', error);
    }
  }

  /**
   * 获取上次使用的位置
   * 
   * @returns {Location|null} 位置对象，如果未设置则返回null
   */
  getLastLocation() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEYS.LAST_LOCATION);
      if (!data) {
        return null;
      }
      const locationData = JSON.parse(data);
      
      // 动态导入 Location 类并创建实例
      // 注意：这里需要返回一个有 isValid() 方法的对象
      return {
        lat: locationData.lat,
        lon: locationData.lon,
        name: locationData.name,
        isValid: function() {
          return this.lat >= -90 && this.lat <= 90 &&
                 this.lon >= -180 && this.lon <= 180;
        }
      };
    } catch (error) {
      console.error('读取位置失败:', error);
      return null;
    }
  }

  /**
   * 缓存天气数据
   * 
   * @param {Location} location - 位置对象
   * @param {Array} data - 天气数据数组
   * @param {number} timestamp - 缓存时间戳（可选，默认为当前时间）
   * 
   * 需求：9.4 - 缓存数据30分钟
   */
  cacheWeatherData(location, data, timestamp = Date.now()) {
    if (!location || !data) {
      return;
    }

    try {
      // 使用位置坐标作为缓存键
      const cacheKey = this.getLocationCacheKey(location);
      
      const cacheEntry = {
        data: data,
        timestamp: timestamp,
        location: {
          lat: location.lat,
          lon: location.lon,
          name: location.name
        }
      };

      // 获取现有缓存
      const cache = this.getWeatherCache();
      cache[cacheKey] = cacheEntry;

      // 保存更新后的缓存
      localStorage.setItem(
        this.STORAGE_KEYS.WEATHER_CACHE,
        JSON.stringify(cache)
      );

    } catch (error) {
      console.error('缓存天气数据失败:', error);
      // 缓存失败不应影响主流程
    }
  }

  /**
   * 获取缓存的天气数据
   * 
   * @param {Location} location - 位置对象
   * @returns {Array|null} 天气数据数组，如果缓存不存在或已过期则返回null
   * 
   * 需求：9.5 - 如果缓存数据未过期，优先使用缓存数据
   */
  getCachedWeatherData(location) {
    if (!location) {
      return null;
    }

    try {
      const cacheKey = this.getLocationCacheKey(location);
      const cache = this.getWeatherCache();
      const cacheEntry = cache[cacheKey];

      if (!cacheEntry) {
        return null;
      }

      // 检查缓存是否过期（30分钟）
      const now = Date.now();
      const age = now - cacheEntry.timestamp;

      if (age >= this.CACHE_DURATION) {
        // 缓存已过期，删除它
        delete cache[cacheKey];
        localStorage.setItem(
          this.STORAGE_KEYS.WEATHER_CACHE,
          JSON.stringify(cache)
        );
        return null;
      }

      // 缓存有效，返回数据
      return cacheEntry.data;

    } catch (error) {
      console.error('读取缓存数据失败:', error);
      return null;
    }
  }

  /**
   * 清除特定位置的天气缓存
   * 
   * @param {Location} location - 位置对象
   */
  clearWeatherCache(location) {
    if (!location) {
      return;
    }

    try {
      const cacheKey = this.getLocationCacheKey(location);
      const cache = this.getWeatherCache();
      
      if (cache[cacheKey]) {
        delete cache[cacheKey];
        localStorage.setItem(
          this.STORAGE_KEYS.WEATHER_CACHE,
          JSON.stringify(cache)
        );
      }
    } catch (error) {
      console.error('清除缓存失败:', error);
    }
  }

  /**
   * 清除所有天气缓存
   */
  clearAllWeatherCache() {
    try {
      localStorage.removeItem(this.STORAGE_KEYS.WEATHER_CACHE);
    } catch (error) {
      console.error('清除所有缓存失败:', error);
    }
  }

  /**
   * 获取所有天气缓存
   * 
   * @returns {Object} 缓存对象
   * @private
   */
  getWeatherCache() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEYS.WEATHER_CACHE);
      if (!data) {
        return {};
      }
      return JSON.parse(data);
    } catch (error) {
      console.error('读取缓存失败:', error);
      return {};
    }
  }

  /**
   * 生成位置的缓存键
   * 
   * @param {Location} location - 位置对象
   * @returns {string} 缓存键
   * @private
   */
  getLocationCacheKey(location) {
    // 使用坐标的字符串表示作为键，保留4位小数
    return `${location.lat.toFixed(4)}_${location.lon.toFixed(4)}`;
  }

  /**
   * 清除所有存储数据
   */
  clearAll() {
    try {
      localStorage.removeItem(this.STORAGE_KEYS.API_KEY);
      localStorage.removeItem(this.STORAGE_KEYS.LAST_LOCATION);
      localStorage.removeItem(this.STORAGE_KEYS.WEATHER_CACHE);
    } catch (error) {
      console.error('清除所有数据失败:', error);
    }
  }

  /**
   * 检查LocalStorage是否可用
   * 
   * @returns {boolean} 如果可用返回true，否则返回false
   */
  isStorageAvailable() {
    try {
      const testKey = '__storage_test__';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      return true;
    } catch (error) {
      return false;
    }
  }

  // ========== 需求12：收藏位置管理 ==========

  /**
   * 保存收藏位置
   * 
   * @param {Location} location - 位置对象
   * @returns {boolean} 是否成功保存
   * 
   * 需求：12.9, 12.10 - 支持用户收藏多个位置
   */
  saveFavoriteLocation(location) {
    if (!location || !location.lat || !location.lon) {
      console.error('[StorageService] 无效的位置对象');
      return false;
    }

    try {
      const favorites = this.getFavoriteLocations();
      
      // 检查是否已存在（基于坐标）
      const exists = favorites.some(fav =>
        fav.lat === location.lat &&
        fav.lon === location.lon
      );

      if (exists) {
        console.log('[StorageService] 位置已在收藏列表中');
        return false;
      }

      // 添加新收藏
      favorites.push({
        lat: location.lat,
        lon: location.lon,
        name: location.name || '未命名位置',
        timestamp: Date.now()
      });

      localStorage.setItem('favorite_locations', JSON.stringify(favorites));
      console.log('[StorageService] 收藏位置已保存');
      return true;
    } catch (error) {
      console.error('[StorageService] 保存收藏位置失败:', error);
      return false;
    }
  }

  /**
   * 获取所有收藏位置
   * 
   * @returns {Array} 收藏位置数组
   * 
   * 需求：12.9, 12.10 - 获取收藏位置列表
   */
  getFavoriteLocations() {
    try {
      const data = localStorage.getItem('favorite_locations');
      if (!data) {
        return [];
      }
      return JSON.parse(data);
    } catch (error) {
      console.error('[StorageService] 读取收藏位置失败:', error);
      return [];
    }
  }

  /**
   * 删除收藏位置
   * 
   * @param {string} locationKey - 位置键（格式：lat_lon）
   * @returns {boolean} 是否成功删除
   * 
   * 需求：12.9, 12.10 - 删除收藏位置
   */
  removeFavoriteLocation(locationKey) {
    if (!locationKey) {
      return false;
    }

    try {
      const favorites = this.getFavoriteLocations();
      const [lat, lon] = locationKey.split('_').map(parseFloat);
      
      const filtered = favorites.filter(fav =>
        Math.abs(fav.lat - lat) >= 0.001 ||
        Math.abs(fav.lon - lon) >= 0.001
      );

      if (filtered.length === favorites.length) {
        console.log('[StorageService] 未找到要删除的收藏位置');
        return false;
      }

      localStorage.setItem('favorite_locations', JSON.stringify(filtered));
      console.log('[StorageService] 收藏位置已删除');
      return true;
    } catch (error) {
      console.error('[StorageService] 删除收藏位置失败:', error);
      return false;
    }
  }

  /**
   * 清除所有收藏位置
   */
  clearFavoriteLocations() {
    try {
      localStorage.removeItem('favorite_locations');
      console.log('[StorageService] 所有收藏位置已清除');
    } catch (error) {
      console.error('[StorageService] 清除收藏位置失败:', error);
    }
  }

  // ========== 需求12：通知设置管理 ==========

  /**
   * 保存通知设置
   * 
   * @param {Object} settings - 通知设置对象 {enabled: boolean, threshold: number}
   * @returns {boolean} 是否成功保存
   * 
   * 需求：12.6, 12.7 - 保存通知设置
   */
  saveNotificationSettings(settings) {
    if (!settings || typeof settings !== 'object') {
      console.error('[StorageService] 无效的通知设置对象');
      return false;
    }

    try {
      const validSettings = {
        enabled: settings.enabled === true || settings.enabled === 'true',
        threshold: Math.max(0, Math.min(100, settings.threshold || 70))
      };

      localStorage.setItem('notification_settings', JSON.stringify(validSettings));
      console.log('[StorageService] 通知设置已保存:', validSettings);
      return true;
    } catch (error) {
      console.error('[StorageService] 保存通知设置失败:', error);
      return false;
    }
  }

  /**
   * 获取通知设置
   * 
   * @returns {Object} 通知设置对象 {enabled: boolean, threshold: number}
   * 
   * 需求：12.6, 12.7 - 获取通知设置
   */
  getNotificationSettings() {
    try {
      const data = localStorage.getItem('notification_settings');
      if (!data) {
        // 返回默认设置
        return {
          enabled: false,
          threshold: 70
        };
      }
      return JSON.parse(data);
    } catch (error) {
      console.error('[StorageService] 读取通知设置失败:', error);
      return {
        enabled: false,
        threshold: 70
      };
    }
  }

  /**
   * 清除通知设置
   */
  clearNotificationSettings() {
    try {
      localStorage.removeItem('notification_settings');
      console.log('[StorageService] 通知设置已清除');
    } catch (error) {
      console.error('[StorageService] 清除通知设置失败:', error);
    }
  }

  // ========== 需求13：搜索历史管理 ==========

  /**
   * 保存搜索历史（使用LRU策略，限制为5个）
   * 
   * @param {Location} location - 位置对象
   * @returns {boolean} 是否成功保存
   * 
   * 需求：13.1, 13.2, 13.3, 13.6, 13.9 - 保存搜索历史，使用LRU策略
   */
  saveSearchHistory(location) {
    if (!location || !location.lat || !location.lon) {
      console.error('[StorageService] 无效的位置对象');
      return false;
    }

    try {
      let history = this.getSearchHistory();
      
      // 检查是否已存在（基于坐标）
      const existingIndex = history.findIndex(item =>
        Math.abs(item.lat - location.lat) < 0.001 &&
        Math.abs(item.lon - location.lon) < 0.001
      );

      // 如果已存在，删除旧记录（稍后会添加到最前面）
      if (existingIndex !== -1) {
        history.splice(existingIndex, 1);
      }

      // 添加到最前面（最新的）
      history.unshift({
        lat: location.lat,
        lon: location.lon,
        name: location.name || '未命名位置',
        timestamp: Date.now()
      });

      // LRU策略：限制为5个
      if (history.length > 5) {
        history = history.slice(0, 5);
      }

      localStorage.setItem('search_history', JSON.stringify(history));
      console.log('[StorageService] 搜索历史已保存');
      return true;
    } catch (error) {
      console.error('[StorageService] 保存搜索历史失败:', error);
      return false;
    }
  }

  /**
   * 获取搜索历史（按时间倒序返回）
   * 
   * @returns {Array} 搜索历史数组
   * 
   * 需求：13.1, 13.2, 13.3, 13.6, 13.9 - 获取搜索历史，按时间倒序
   */
  getSearchHistory() {
    try {
      const data = localStorage.getItem('search_history');
      if (!data) {
        return [];
      }
      const history = JSON.parse(data);
      
      // 按时间戳倒序排序（最新的在前面）
      return history.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error('[StorageService] 读取搜索历史失败:', error);
      return [];
    }
  }

  /**
   * 删除单个历史记录
   * 
   * @param {string} locationKey - 位置键（格式：lat_lon）
   * @returns {boolean} 是否成功删除
   * 
   * 需求：13.1, 13.2, 13.3, 13.6, 13.9 - 删除单个历史记录
   */
  removeSearchHistoryItem(locationKey) {
    if (!locationKey) {
      return false;
    }

    try {
      const history = this.getSearchHistory();
      const [lat, lon] = locationKey.split('_').map(parseFloat);
      
      const filtered = history.filter(item =>
        Math.abs(item.lat - lat) >= 0.001 ||
        Math.abs(item.lon - lon) >= 0.001
      );

      if (filtered.length === history.length) {
        console.log('[StorageService] 未找到要删除的历史记录');
        return false;
      }

      localStorage.setItem('search_history', JSON.stringify(filtered));
      console.log('[StorageService] 历史记录已删除');
      return true;
    } catch (error) {
      console.error('[StorageService] 删除历史记录失败:', error);
      return false;
    }
  }

  /**
   * 清除全部历史记录
   *
   * @returns {boolean} 是否成功清除
   *
   * 需求：13.1, 13.2, 13.3, 13.6, 13.9 - 清除全部历史记录
   */
  clearSearchHistory() {
    try {
      localStorage.removeItem('search_history');
      console.log('[StorageService] 所有搜索历史已清除');
      return true;
    } catch (error) {
      console.error('[StorageService] 清除搜索历史失败:', error);
      return false;
    }
  }

  // ========== 任务17.3：默认位置管理 ==========

  /**
   * 保存默认位置
   *
   * @param {Location} location - 位置对象
   * @returns {boolean} 是否成功保存
   *
   * 需求：17.7, 17.8 - 保存用户默认位置
   */
  saveDefaultLocation(location) {
    if (!location || !location.lat || !location.lon) {
      console.error('[StorageService] 无效的位置对象');
      return false;
    }

    try {
      const locationData = {
        lat: location.lat,
        lon: location.lon,
        name: location.name || '未命名位置'
      };

      localStorage.setItem('default_location', JSON.stringify(locationData));
      console.log('[StorageService] 默认位置已保存:', locationData.name);
      return true;
    } catch (error) {
      console.error('[StorageService] 保存默认位置失败:', error);
      return false;
    }
  }

  /**
   * 获取默认位置
   *
   * @returns {Location|null} 默认位置对象，如果未设置则返回null
   *
   * 需求：17.7, 17.8 - 获取用户默认位置
   */
  getDefaultLocation() {
    try {
      const data = localStorage.getItem('default_location');
      if (!data) {
        return null;
      }

      const locationData = JSON.parse(data);

      return {
        lat: locationData.lat,
        lon: locationData.lon,
        name: locationData.name,
        isValid: function() {
          return this.lat >= -90 && this.lat <= 90 &&
                 this.lon >= -180 && this.lon <= 180;
        }
      };
    } catch (error) {
      console.error('[StorageService] 读取默认位置失败:', error);
      return null;
    }
  }

  /**
   * 清除默认位置
   *
   * @returns {boolean} 是否成功清除
   */
  clearDefaultLocation() {
    try {
      localStorage.removeItem('default_location');
      console.log('[StorageService] 默认位置已清除');
      return true;
    } catch (error) {
      console.error('[StorageService] 清除默认位置失败:', error);
      return false;
    }
  }
}

export default StorageService;
