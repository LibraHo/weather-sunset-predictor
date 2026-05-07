/**
 * ChinaSpotsOverlayManager.js - 朝霞/晚霞独立叠加层管理器（任务 64.8）
 *
 * - 管理两个独立的 ChinaSpotsOverlay 实例（sunrise / sunset）
 * - 提供切换 UI（tab 按钮）
 * - 确保两个叠加层互不干扰
 */

import ChinaSpotsOverlay from './ChinaSpotsOverlay.js';

export const SUPPORTED_PERIODS = ['sunrise', 'sunset'];

export default class ChinaSpotsOverlayManager {
  constructor() {
    this._map = null;
    this._sunriseOverlay = null;
    this._sunsetOverlay = null;
    this._activePeriod = 'sunset'; // 默认显示晚霞
    this._tabContainer = null;
    this._tabButtons = {};
    this._healthTimer = null;
    this._healthCheckIntervalMs = 45000;
    this._healthCheckRunning = false;
  }

  /**
   * 初始化管理器
   * @param {Object} leafletMap - Leaflet 地图实例
   * @param {HTMLElement} container - tab 按钮容器（可选）
   */
  init(leafletMap, container = null) {
    if (!leafletMap) {
      console.warn('[ChinaSpotsOverlayManager] 地图实例为空，无法初始化');
      return;
    }

    this._map = leafletMap;

    // 创建两个独立的叠加层实例
    this._sunriseOverlay = new ChinaSpotsOverlay();
    this._sunsetOverlay = new ChinaSpotsOverlay();

    // 初始化叠加层
    this._sunriseOverlay.init(leafletMap);
    this._sunsetOverlay.init(leafletMap);

    // 隐藏叠加层内部按钮（由管理器统一管理）
    this._sunriseOverlay.hide();
    this._sunsetOverlay.hide();

    // 创建 tab UI
    if (container) {
      this._createTabs(container);
    }

    console.log('[ChinaSpotsOverlayManager] 已初始化 sunrise/sunset 叠加层');
  }

  /**
   * 创建切换 tab UI
   * @param {HTMLElement} container
   */
  _createTabs(container) {
    this._tabContainer = document.createElement('div');
    this._tabContainer.className = 'china-spots-tabs xiake-toggle';

    const tabs = [
      { period: 'sunrise', label: '明天朝霞' },
      { period: 'sunset', label: '今天晚霞' }
    ];

    tabs.forEach(tab => {
      const btn = document.createElement('button');
      btn.textContent = tab.label;
      btn.dataset.period = tab.period;
      btn.className = 'china-spots-tab xiake-toggle-btn';
      btn.addEventListener('click', () => this.switchPeriod(tab.period));
      this._tabContainer.appendChild(btn);
      this._tabButtons[tab.period] = btn;
    });

    // 插入到容器开头
    if (container.firstChild) {
      container.insertBefore(this._tabContainer, container.firstChild);
    } else {
      container.appendChild(this._tabContainer);
    }

    // 更新初始状态
    this._updateTabUI();
  }

  /**
   * 切换当前激活的时段
   * @param {'sunrise'|'sunset'} period
   */
  switchPeriod(period) {
    if (!SUPPORTED_PERIODS.includes(period)) {
      console.warn(`[ChinaSpotsOverlayManager] 不支持的时段: ${period}`);
      return;
    }

    if (this._activePeriod === period) return;

    // 隐藏当前叠加层
    this._getActiveOverlay().hide();

    // 切换到新时段
    this._activePeriod = period;

    // 显示新叠加层
    this._getActiveOverlay().show();

    // 更新 tab UI
    this._updateTabUI();

    console.log(`[ChinaSpotsOverlayManager] 已切换到 ${period}`);
  }

  /**
   * 获取当前激活的叠加层实例
   * @returns {ChinaSpotsOverlay}
   */
  _getActiveOverlay() {
    return this._activePeriod === 'sunrise' ? this._sunriseOverlay : this._sunsetOverlay;
  }

  /**
   * 更新 tab UI 状态
   */
  _updateTabUI() {
    Object.entries(this._tabButtons).forEach(([period, btn]) => {
      const isActive = period === this._activePeriod;
      btn.classList.toggle('is-active', isActive);
      btn.classList.toggle('active', isActive);
    });
  }

  /**
   * 加载并渲染指定时段的数据
   * @param {'sunrise'|'sunset'} period
   */
  async loadAndRender(period = this._activePeriod) {
    if (!SUPPORTED_PERIODS.includes(period)) {
      console.warn(`[ChinaSpotsOverlayManager] 不支持的时段: ${period}`);
      return;
    }

    const overlay = period === 'sunrise' ? this._sunriseOverlay : this._sunsetOverlay;
    overlay.setPeriod(period);
    await overlay.loadAndRender(period);
  }

  /**
   * 加载所有时段的数据
   */
  async loadAllPeriods() {
    console.log('[ChinaSpotsOverlayManager] 开始加载所有时段数据...');
    await Promise.all([
      this.loadAndRender('sunrise'),
      this.loadAndRender('sunset')
    ]);
    console.log('[ChinaSpotsOverlayManager] 所有时段数据加载完成');

    // 若当前时段无点位而另一个时段有点位，自动切换到有数据的时段，避免用户看到空图
    const activeCount = this.getSpotCount(this._activePeriod);
    const fallbackPeriod = this._activePeriod === 'sunrise' ? 'sunset' : 'sunrise';
    const fallbackCount = this.getSpotCount(fallbackPeriod);

    if (activeCount === 0 && fallbackCount > 0) {
      console.warn(`[ChinaSpotsOverlayManager] ${this._activePeriod} 无可视点位，自动切换到 ${fallbackPeriod}`);
      this._activePeriod = fallbackPeriod;
      this._updateTabUI();
    }

    // 确保只显示当前激活的叠加层
    this._getActiveOverlay().show();
    this._getInactiveOverlay().hide();

    // 启动自检，兜底修复偶发渲染失效
    this.startHealthMonitor();
  }

  /**
   * 执行一次渲染健康检查，必要时自动修复
   */
  async runHealthCheck() {
    if (this._healthCheckRunning) return;
    if (!this._map || !this._sunriseOverlay || !this._sunsetOverlay) return;

    this._healthCheckRunning = true;
    try {
      // 仅在地图容器可见时检查
      const mapEl = this._map?.getContainer?.();
      if (!mapEl || mapEl.offsetWidth <= 0 || mapEl.offsetHeight <= 0) return;

      const activePeriod = this._activePeriod;
      const activeOverlay = this._getActiveOverlay();
      const health = activeOverlay?.getRenderHealth?.() || { ok: true, reason: 'no_health_api' };

      if (health.ok) return;

      console.warn(`[ChinaSpotsOverlayManager] 检测到渲染异常（${activePeriod}）: ${health.reason}，尝试自动修复`);

      // 自动修复：重新加载并重绘当前时段
      await this.loadAndRender(activePeriod);
      this._getActiveOverlay()?.show?.();
      this._getInactiveOverlay()?.hide?.();

      const after = this._getActiveOverlay()?.getRenderHealth?.() || { ok: true, reason: 'no_health_api' };
      if (!after.ok) {
        console.error(`[ChinaSpotsOverlayManager] 自动修复后仍异常（${activePeriod}）: ${after.reason}`);
      }
    } catch (err) {
      console.error('[ChinaSpotsOverlayManager] 渲染健康检查失败:', err);
    } finally {
      this._healthCheckRunning = false;
    }
  }

  startHealthMonitor() {
    if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test') {
      return;
    }
    this.stopHealthMonitor();
    this._healthTimer = setInterval(() => {
      this.runHealthCheck().catch(() => {});
    }, this._healthCheckIntervalMs);
  }

  stopHealthMonitor() {
    if (this._healthTimer) {
      clearInterval(this._healthTimer);
      this._healthTimer = null;
    }
  }

  /**
   * 获取非激活的叠加层实例
   * @returns {ChinaSpotsOverlay}
   */
  _getInactiveOverlay() {
    return this._activePeriod === 'sunrise' ? this._sunsetOverlay : this._sunriseOverlay;
  }

  /**
   * 获取当前激活的时段
   * @returns {'sunrise'|'sunset'}
   */
  getActivePeriod() {
    return this._activePeriod;
  }

  /**
   * 获取指定时段的叠加层实例
   * @param {'sunrise'|'sunset'} period
   * @returns {ChinaSpotsOverlay}
   */
  getOverlay(period) {
    return period === 'sunrise' ? this._sunriseOverlay : this._sunsetOverlay;
  }

  /**
   * 获取指定时段的点位数量
   * @param {'sunrise'|'sunset'} period
   * @returns {number}
   */
  getSpotCount(period) {
    const overlay = this.getOverlay(period);
    return overlay ? overlay.getSpotCount() : 0;
  }

  /**
   * 获取指定时段的最高评分（用于朝/晚双卡片并排展示）
   * @param {'sunrise'|'sunset'} period
   * @returns {number|null}
   */
  getMaxScore(period) {
    const overlay = this.getOverlay(period);
    return overlay ? overlay.getMaxScore?.() ?? null : null;
  }

  /**
   * 获取指定时段的更新时间
   * @param {'sunrise'|'sunset'} period
   * @returns {string|null}
   */
  getUpdatedAt(period) {
    const overlay = this.getOverlay(period);
    return overlay ? overlay.getUpdatedAt() : null;
  }

  /**
   * 显示当前激活的叠加层
   */
  show() {
    this._getActiveOverlay().show();
  }

  /**
   * 隐藏所有叠加层
   */
  hide() {
    this._sunriseOverlay.hide();
    this._sunsetOverlay.hide();
  }

  /**
   * 切换当前叠加层的显示状态
   */
  toggle() {
    this._getActiveOverlay().toggle();
  }

  /**
   * 清理所有叠加层
   */
  clear() {
    this._sunriseOverlay.clear();
    this._sunsetOverlay.clear();

    if (this._tabContainer) {
      this._tabContainer.remove();
      this._tabContainer = null;
    }
    this._tabButtons = {};
  }

  /**
   * 销毁管理器，释放资源
   */
  destroy() {
    this.stopHealthMonitor();
    this.clear();
    this._map = null;
    this._sunriseOverlay = null;
    this._sunsetOverlay = null;
  }
}
