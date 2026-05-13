import { buildSpotMarkers, getChinaFirecloudSpots, getFirecloudLegend } from '../../services/firecloud-map.js';

const DEFAULT_MAP_CENTER = { latitude: 35.8617, longitude: 104.1954 };

Page({
  data: {
    period: 'sunset',
    periodLabel: '晚霞',
    periodDetailText: '',
    loading: false,
    errorMessage: '',
    updatedAtText: '等待地图数据',
    spots: [],
    topSpots: [],
    markers: [],
    legendItems: getFirecloudLegend('sunset'),
    activeSpot: null,
    mapCenter: DEFAULT_MAP_CENTER,
    mapScale: 4
  },

  onLoad(options = {}) {
    const period = options.period === 'sunrise' ? 'sunrise' : 'sunset';
    this.setData({
      period,
      periodLabel: periodLabel(period),
      periodDetailText: periodDetailText(period),
      legendItems: getFirecloudLegend(period)
    });
    this.loadMap();
  },

  selectPeriod(event) {
    const period = event.currentTarget.dataset.value;
    if (period === this.data.period) return;
    this.setData({
      period,
      periodLabel: periodLabel(period),
      periodDetailText: periodDetailText(period),
      activeSpot: null,
      spots: [],
      topSpots: [],
      markers: [],
      mapCenter: DEFAULT_MAP_CENTER,
      mapScale: 4,
      legendItems: getFirecloudLegend(period)
    });
    this.loadMap();
  },

  async loadMap() {
    this.setData({ loading: true, errorMessage: '' });
    try {
      const data = await getChinaFirecloudSpots({ period: this.data.period });
      const spots = data.spots;
      const markers = buildSpotMarkers(spots);
      const activeSpot = spots[0] || null;
      this.setData({
        spots,
        topSpots: spots.slice(0, 12),
        markers,
        activeSpot,
        updatedAtText: formatUpdatedAt(data.updatedAt),
        mapCenter: activeSpot ? { latitude: activeSpot.lat, longitude: activeSpot.lon } : DEFAULT_MAP_CENTER,
        mapScale: activeSpot ? 5 : 4
      });
    } catch (error) {
      this.setData({
        errorMessage: '火烧云地图暂时加载失败，请稍后再试。',
        updatedAtText: '地图数据不可用'
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  focusSpot(event = {}) {
    const markerId = event.detail?.markerId;
    const spotId = event.currentTarget?.dataset?.id;
    const spot = this.data.spots.find((item) => (
      Number(item.markerId) === Number(markerId) || String(item.id) === String(spotId)
    ));
    if (!spot) return;
    this.setData({
      activeSpot: spot,
      mapCenter: { latitude: spot.lat, longitude: spot.lon },
      mapScale: 7
    });
  },

  openSpotPrediction() {
    const spot = this.data.activeSpot;
    if (!spot) return;
    const query = [
      `lat=${encodeURIComponent(spot.lat)}`,
      `lon=${encodeURIComponent(spot.lon)}`,
      `name=${encodeURIComponent(spot.name)}`,
      `type=${encodeURIComponent(this.data.period)}`
    ].join('&');
    wx.navigateTo({ url: `/pages/result/index?${query}` });
  }
});

function periodLabel(period) {
  return period === 'sunrise' ? '朝霞' : '晚霞';
}

function periodDetailText(period) {
  const date = new Date();
  if (period === 'sunrise') {
    date.setDate(date.getDate() + 1);
    return `明天的朝霞 · ${formatMonthDay(date)}`;
  }
  return `今天的晚霞 · ${formatMonthDay(date)}`;
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

export { DEFAULT_MAP_CENTER, formatUpdatedAt, periodDetailText };
