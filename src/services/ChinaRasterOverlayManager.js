/**
 * ChinaRasterOverlayManager.js - 栅格火烧云叠加层管理器（任务 64.12）
 *
 * 管理两个独立的 ChinaRasterOverlay 实例（sunrise / sunset）。
 * 接口与 ChinaSpotsOverlayManager 保持一致，可作为其替代品使用。
 *
 * 设计要点：
 *  - 两个时段实例独立缓存，切换无闪烁
 *  - Tab UI 与 ChinaSpotsOverlayManager 相同风格
 *  - loadAllPeriods() 并行加载，切换时立即可见
 */

import ChinaRasterOverlay from './ChinaRasterOverlay.js';

export const SUPPORTED_PERIODS = ['sunrise', 'sunset', 'test'];

export default class ChinaRasterOverlayManager {
  constructor() {
    this._map = null;
    this._sunriseOverlay = null;
    this._sunsetOverlay = null;
    this._testOverlay = null;
    this._activePeriod = 'sunset';
    this._tabContainer = null;
    this._tabButtons = {};
    this._onPeriodChange = null; // 外部回调
  }

  /**
   * 注册时段切换回调
   * @param {Function} fn - fn(period)
   */
  onPeriodChange(fn) {
    this._onPeriodChange = fn;
  }

  /**
   * 初始化管理器
   * @param {L.Map} leafletMap - Leaflet 地图实例
   * @param {HTMLElement} container - tab 按钮容器（可选）
   */
  init(leafletMap, container = null) {
    if (!leafletMap) {
      console.warn('[ChinaRasterOverlayManager] 地图实例为空，无法初始化');
      return;
    }

    this._map = leafletMap;

    this._sunriseOverlay = new ChinaRasterOverlay();
    this._sunsetOverlay = new ChinaRasterOverlay();
    this._testOverlay = new ChinaRasterOverlay();

    this._sunriseOverlay.init(leafletMap);
    this._sunsetOverlay.init(leafletMap);
    this._testOverlay.init(leafletMap);

    this._sunriseOverlay.hide();
    this._sunsetOverlay.hide();
    this._testOverlay.hide();

    if (container) {
      this._createTabs(container);
    }

    console.log('[ChinaRasterOverlayManager] 已初始化 sunrise/sunset 栅格叠加层');
  }

  // ─── Tab UI ───────────────────────────────────────────────────────────────

  _createTabs(container) {
    // 优先复用 HTML 中已有的静态 tab 按钮
    const existingSunrise = document.getElementById('map-tab-sunrise');
    const existingSunset = document.getElementById('map-tab-sunset');

    if (existingSunrise && existingSunset) {
      // 复用已有按钮，不重复绑定 click（app.js 已提前绑定）
      this._tabButtons['sunrise'] = existingSunrise;
      this._tabButtons['sunset'] = existingSunset;
      this._tabContainer = container;
      this._updateTabUI();
      return;
    }

    // 降级：动态创建
    this._tabContainer = document.createElement('div');
    this._tabContainer.className = 'china-spots-tabs china-raster-tabs';
    this._tabContainer.style.cssText = 'display:flex;gap:8px;margin-bottom:8px;';

    const tabs = [
      { period: 'sunrise', label: '朝霞 🌄' },
      { period: 'sunset',  label: '晚霞 🌅' }
    ];

    tabs.forEach(tab => {
      const btn = document.createElement('button');
      btn.textContent = tab.label;
      btn.dataset.period = tab.period;
      btn.className = 'china-spots-tab';
      btn.style.cssText = [
        'flex: 1',
        'padding: 8px 12px',
        'border: 1px solid rgba(255,120,0,0.5)',
        'border-radius: 6px',
        'background: rgba(0,0,0,0.4)',
        'color: var(--color-text)',
        'font-size: 13px',
        'cursor: pointer',
        'transition: background 0.2s, border-color 0.2s',
        'backdrop-filter: blur(4px)',
        'white-space: nowrap'
      ].join(';');

      btn.addEventListener('click', () => this.switchPeriod(tab.period));
      this._tabContainer.appendChild(btn);
      this._tabButtons[tab.period] = btn;
    });

    if (container.firstChild) {
      container.insertBefore(this._tabContainer, container.firstChild);
    } else {
      container.appendChild(this._tabContainer);
    }

    this._updateTabUI();
  }

  _updateTabUI() {
    Object.entries(this._tabButtons).forEach(([period, btn]) => {
      const isActive = period === this._activePeriod;
      if (isActive) {
        btn.style.background = 'rgba(255, 100, 0, 0.8)';
        btn.style.borderColor = 'rgba(255, 200, 50, 0.9)';
        btn.style.fontWeight = 'bold';
      } else {
        btn.style.background = 'rgba(0, 0, 0, 0.4)';
        btn.style.borderColor = 'rgba(255, 120, 0, 0.5)';
        btn.style.fontWeight = 'normal';
      }
    });
  }

  // ─── 公开 API（与 ChinaSpotsOverlayManager 接口对齐）─────────────────────

  /**
   * 切换当前激活的时段
   * @param {'sunrise'|'sunset'} period
   */
  switchPeriod(period) {
    if (!SUPPORTED_PERIODS.includes(period)) {
      console.warn(`[ChinaRasterOverlayManager] 不支持的时段: ${period}`);
      return;
    }
    if (this._activePeriod === period) return;

    this._getActiveOverlay().hide();
    this._activePeriod = period;
    this._getActiveOverlay().show();
    this._updateTabUI();

    console.log(`[ChinaRasterOverlayManager] 已切换到 ${period}`);

    // 通知外部（WeatherController 更新时段说明/时间戳/空状态）
    if (typeof this._onPeriodChange === 'function') {
      this._onPeriodChange(period);
    }
  }

  /**
   * 加载并渲染指定时段
   * @param {'sunrise'|'sunset'} period
   */
  async loadAndRender(period = this._activePeriod) {
    if (!SUPPORTED_PERIODS.includes(period)) {
      console.warn(`[ChinaRasterOverlayManager] 不支持的时段: ${period}`);
      return;
    }

    const overlay = period === 'sunrise' ? this._sunriseOverlay : (period === 'test' ? this._testOverlay : this._sunsetOverlay);
    overlay.setPeriod(period);
    await overlay.loadAndRender(period);
  }

  /**
   * 并行加载所有时段数据
   */
  async loadAllPeriods() {
    console.log('[ChinaRasterOverlayManager] 开始并行加载所有时段栅格数据...');
    await Promise.all([
      this.loadAndRender('sunrise'),
      this.loadAndRender('sunset')
    ]);
    console.log('[ChinaRasterOverlayManager] 所有时段栅格数据加载完成');

    // 三时段下统一收拢显示态，避免并行加载后多层同时可见
    this._sunriseOverlay?.hide();
    this._sunsetOverlay?.hide();
    this._testOverlay?.hide();
    this._getActiveOverlay().show();
  }

  getActivePeriod() { return this._activePeriod; }

  /**
   * 获取指定时段的叠加层实例
   * @param {'sunrise'|'sunset'} period
   * @returns {ChinaRasterOverlay}
   */
  getOverlay(period) {
    return period === 'sunrise' ? this._sunriseOverlay : (period === 'test' ? this._testOverlay : this._sunsetOverlay);
  }

  /**
   * 获取指定时段的更新时间（对齐 ChinaSpotsOverlayManager API）
   * ChinaRasterOverlay 使用 getUpdatedAt()
   * @param {'sunrise'|'sunset'} period
   * @returns {string|null}
   */
  getUpdatedAt(period) {
    const overlay = this.getOverlay(period);
    return overlay ? overlay.getUpdatedAt() : null;
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
   * 获取当前时段可渲染格元数量（接口与散点模式保持对齐）
   */
  getSpotCount() {
    const active = this._getActiveOverlay();
    return active?.getSpotCount?.() ?? 0;
  }

  show() { this._getActiveOverlay().show(); }

  hide() {
    this._sunriseOverlay?.hide();
    this._sunsetOverlay?.hide();
    this._testOverlay?.hide();
  }

  toggle() { this._getActiveOverlay().toggle(); }

  clear() {
    this._sunriseOverlay?.clear();
    this._sunsetOverlay?.clear();
    this._testOverlay?.clear();

    if (this._tabContainer) {
      this._tabContainer.remove();
      this._tabContainer = null;
    }
    this._tabButtons = {};
  }

  destroy() {
    this.clear();
    this._sunriseOverlay?.destroy();
    this._sunsetOverlay?.destroy();
    this._testOverlay?.destroy();
    this._map = null;
    this._sunriseOverlay = null;
    this._sunsetOverlay = null;
    this._testOverlay = null;
  }

  // ─── 私有辅助 ─────────────────────────────────────────────────────────────

  _getActiveOverlay() {
    return this._activePeriod === 'sunrise'
      ? this._sunriseOverlay
      : (this._activePeriod === 'test' ? this._testOverlay : this._sunsetOverlay);
  }

  _getInactiveOverlay() {
    // 兼容旧接口：在 3 时段下返回一个“非当前”的 overlay 供隐藏调用
    if (this._activePeriod === 'sunrise') return this._sunsetOverlay;
    if (this._activePeriod === 'test') return this._sunsetOverlay;
    return this._sunriseOverlay;
  }
}
