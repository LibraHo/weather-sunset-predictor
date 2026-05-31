import {
  buildRasterGroundOverlay,
  getChinaFirecloudRaster,
  getFirecloudLegend
} from '../../services/firecloud-map.js';
import { applyPageSettings, readAppSettings } from '../../utils/app-settings.js';
import { getDefaultSunEventDay } from '../../utils/sun-event-day.js';

const DEFAULT_MAP_CENTER = { latitude: 35.8617, longitude: 104.1954 };
const FIRECLOUD_MAP_RESOLUTION = 0.5;
const FIRECLOUD_MAP_ID = 'firecloud-native-map';

Page({
  data: {
    period: 'sunset',
    periodLabel: '晚霞',
    periodDetailText: '',
    loading: false,
    errorMessage: '',
    updatedAtText: '等待地图数据',
    groundOverlays: [],
    polygons: [],
    legendItems: getFirecloudLegend('sunset'),
    mapCenter: DEFAULT_MAP_CENTER,
    mapScale: 4,
    themeMode: 'system',
    resolvedThemeMode: 'light'
  },

  onLoad(options = {}) {
    this.applySavedSettings();
    const period = options.period === 'sunrise' ? 'sunrise' : 'sunset';
    this.setData({
      period,
      periodLabel: periodLabel(period),
      periodDetailText: periodDetailText(period),
      legendItems: getFirecloudLegend(period)
    });
    this.loadMap();
  },

  onShow() {
    this.applySavedSettings();
  },

  applySavedSettings() {
    applyPageSettings(this);
  },

  onAppSettingsChange(event) {
    this.setData(event.detail || readAppSettings());
  },

  selectPeriod(event) {
    const period = event.currentTarget.dataset.value;
    if (period === this.data.period) return;
    this.setData({
      period,
      periodLabel: periodLabel(period),
      periodDetailText: periodDetailText(period),
      groundOverlays: [],
      polygons: [],
      mapCenter: DEFAULT_MAP_CENTER,
      mapScale: 4,
      legendItems: getFirecloudLegend(period)
    });
    this.loadMap();
  },

  async loadMap() {
    this.setData({ loading: true, errorMessage: '' });
    try {
      const raster = await getChinaFirecloudRaster({ period: this.data.period, resolution: FIRECLOUD_MAP_RESOLUTION });
      if (raster.isFallback) {
        throw new Error('raster backend unavailable');
      }
      const groundOverlay = buildRasterGroundOverlay(raster, {
        period: this.data.period,
        resolution: FIRECLOUD_MAP_RESOLUTION
      });
      this.setData({
        groundOverlays: [groundOverlay],
        polygons: [],
        updatedAtText: raster.isFallback ? '测试图层 · 后端暂不可用' : formatUpdatedAt(raster.updatedAt),
        mapCenter: DEFAULT_MAP_CENTER,
        mapScale: 4
      });
    } catch (error) {
      this.setData({
        errorMessage: '火烧云地图暂时加载失败，请稍后再试。',
        updatedAtText: '地图数据不可用'
      });
    } finally {
      this.setData({ loading: false });
    }
  }
});

function periodLabel(period) {
  return period === 'sunrise' ? '朝霞' : '晚霞';
}

function periodDetailText(period) {
  const date = new Date();
  const day = getDefaultMapDay(date, { period });
  if (day === 'tomorrow') {
    date.setDate(date.getDate() + 1);
  }
  const dayLabel = day === 'tomorrow' ? '明天' : '今天';
  return `${dayLabel}的${periodLabel(period)} · ${formatMonthDay(date)}`;
}

function formatMonthDay(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}-${day}`;
}

function formatUpdatedAt(value) {
  if (!value) return '等待地图数据';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return `更新于 ${value}`;
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `更新于 ${month}-${day} ${hour}:${minute}`;
}

function getDefaultMapDay(now = new Date(), options = {}) {
  return getDefaultSunEventDay(now, options);
}

export { DEFAULT_MAP_CENTER, FIRECLOUD_MAP_ID, formatUpdatedAt, getDefaultMapDay, periodDetailText };
