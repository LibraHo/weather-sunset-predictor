/**
 * CacheService - 缓存服务（后端版）
 *
 * 提供内存缓存功能，支持过期时间管理
 * 用于周边预测数据的缓存（1小时TTL）
 *
 * 需求：22 (前后端分离 - Phase 2)
 * @author Backend Migration v1.0
 */

// ========== 服务类定义 ==========

class CacheService {
  /**
   * 创建缓存服务实例
   *
   * @param {Object} options - 配置选项
   * @param {number} options.defaultTTL - 默认过期时间（秒），默认3600（1小时）
   * @param {number} options.maxEntries - 最大缓存条目数，默认1000
   */
  constructor(options = {}) {
    this.cache = new Map();
    this.defaultTTL = options.defaultTTL || 3600; // 默认1小时
    this.maxEntries = options.maxEntries || 1000;

    // 启动定期清理过期缓存的定时器（每5分钟执行一次）
    this.cleanupInterval = setInterval(() => {
      this._cleanupExpired();
    }, 5 * 60 * 1000);

    console.log('[CacheService] 缓存服务已初始化，默认TTL: ' + this.defaultTTL + '秒');
  }

  /**
   * 获取缓存值
   *
   * @param {string} key - 缓存键
   * @returns {Promise<any|null>} 缓存值，如果不存在或已过期则返回 null
   *
   * 需求：22.9 - 缓存键生成和读取
   */
  async get(key) {
    if (!key || typeof key !== 'string') {
      return null;
    }

    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // 检查是否过期
    if (this._isExpired(entry)) {
      this.cache.delete(key);
      return null;
    }

    console.log(`[CacheService] 缓存命中: ${key}`);
    return entry.value;
  }

  /**
   * 设置缓存值
   *
   * @param {string} key - 缓存键
   * @param {any} value - 缓存值
   * @param {number} ttl - 过期时间（秒），可选，默认使用配置的 defaultTTL
   * @returns {Promise<boolean>} 是否设置成功
   *
   * 需求：22.9 - 缓存写入和TTL管理
   */
  async set(key, value, ttl) {
    if (!key || typeof key !== 'string') {
      return false;
    }

    // 检查缓存大小限制
    if (this.cache.size >= this.maxEntries && !this.cache.has(key)) {
      // 缓存已满，删除最旧的条目（FIFO）
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    const ttlSeconds = ttl !== undefined ? ttl : this.defaultTTL;
    const expiryTime = Date.now() + (ttlSeconds * 1000);

    this.cache.set(key, {
      value: value,
      expiryTime: expiryTime,
      createdAt: Date.now()
    });

    console.log(`[CacheService] 缓存写入: ${key}, TTL: ${ttlSeconds}秒`);
    return true;
  }

  /**
   * 删除缓存值
   *
   * @param {string} key - 缓存键
   * @returns {Promise<boolean>} 是否删除成功
   */
  async delete(key) {
    if (!key) {
      return false;
    }

    const deleted = this.cache.delete(key);
    if (deleted) {
      console.log(`[CacheService] 缓存删除: ${key}`);
    }
    return deleted;
  }

  /**
   * 清空所有缓存
   *
   * @returns {Promise<boolean>} 是否清空成功
   */
  async clear() {
    this.cache.clear();
    console.log('[CacheService] 缓存已清空');
    return true;
  }

  /**
   * 检查缓存键是否存在且未过期
   *
   * @param {string} key - 缓存键
   * @returns {Promise<boolean>} 是否存在
   */
  async has(key) {
    if (!key) {
      return false;
    }

    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    // 检查是否过期
    if (this._isExpired(entry)) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * 获取缓存统计信息
   *
   * @returns {Object} 统计信息对象
   */
  getStats() {
    let expiredCount = 0;
    let totalSize = this.cache.size;

    for (const [key, entry] of this.cache.entries()) {
      if (this._isExpired(entry)) {
        expiredCount++;
      }
    }

    return {
      totalEntries: totalSize,
      activeEntries: totalSize - expiredCount,
      expiredEntries: expiredCount,
      maxEntries: this.maxEntries
    };
  }

  /**
   * 清理过期缓存
   *
   * @returns {number} 清理的条目数
   * @private
   */
  _cleanupExpired() {
    let cleanedCount = 0;
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiryTime && now >= entry.expiryTime) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`[CacheService] 清理了 ${cleanedCount} 个过期缓存条目`);
    }

    return cleanedCount;
  }

  /**
   * 检查缓存条目是否过期
   *
   * @param {Object} entry - 缓存条目
   * @returns {boolean} 是否过期
   * @private
   */
  _isExpired(entry) {
    if (!entry || !entry.expiryTime) {
      return false;
    }
    return Date.now() >= entry.expiryTime;
  }

  /**
   * 销毁缓存服务，停止定时器
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
    console.log('[CacheService] 缓存服务已销毁');
  }
}

// ========== 导出 ==========

module.exports = CacheService;
