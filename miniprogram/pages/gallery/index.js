import { listPhotos, normalizePhoto } from '../../services/photos.js';
import { applyPageSettings, readAppSettings } from '../../utils/app-settings.js';

export const DEFAULT_MAP_CENTER = { latitude: 35.8617, longitude: 104.1954 };

Page({
  data: {
    loading: false,
    errorMessage: '',
    photos: [],
    mapMarkers: [],
    hasPhotos: false,
    isEmpty: false,
    activePhoto: null,
    latestPhoto: null,
    mapCenter: DEFAULT_MAP_CENTER,
    mapScale: 4,
    themeMode: 'system',
    resolvedThemeMode: 'light',
    photoStats: {
      total: 0,
      withLocation: 0
    },
    mapStatus: {
      title: '霞光照片位置',
      description: '欣赏压缩后的霞光照片和拍摄位置；小程序不提供原图下载。'
    }
  },

  onLoad() {
    this.applySavedSettings();
    this.loadPhotos();
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

  async loadPhotos() {
    this.setData({ loading: true, errorMessage: '', isEmpty: false });

    try {
      const result = await listPhotos();
      const photos = normalizePhotos(result);
      const mapMarkers = buildMapMarkers(photos);
      const activePhoto = photos[0] || null;
      this.setData({
        photos,
        mapMarkers,
        activePhoto,
        latestPhoto: activePhoto,
        mapCenter: activePhoto?.hasLocation
          ? { latitude: activePhoto.lat, longitude: activePhoto.lon }
          : DEFAULT_MAP_CENTER,
        mapScale: mapMarkers.length > 1 ? 5 : 4,
        hasPhotos: photos.length > 0,
        isEmpty: photos.length === 0,
        photoStats: {
          total: photos.length,
          withLocation: mapMarkers.length
        }
      });
    } catch (error) {
      this.setData({
        errorMessage: '照片列表暂时加载失败，请稍后再试。',
        photos: [],
        mapMarkers: [],
        activePhoto: null,
        latestPhoto: null,
        hasPhotos: false,
        isEmpty: false,
        photoStats: { total: 0, withLocation: 0 }
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  focusPhoto(event = {}) {
    const photoId = event.currentTarget?.dataset?.id;
    const markerId = event.detail?.markerId;
    const photo = this.data.photos.find((item) => (
      String(item.id) === String(photoId) || Number(item.markerId) === Number(markerId)
    ));
    if (!photo) return;

    this.setData({
      activePhoto: photo,
      mapCenter: photo.hasLocation
        ? { latitude: photo.lat, longitude: photo.lon }
        : this.data.mapCenter,
      mapScale: photo.hasLocation ? 9 : this.data.mapScale
    });
  },

  previewPhoto(event = {}) {
    const photo = findPhotoByEvent(this.data.photos, event) || this.data.activePhoto;
    if (!photo?.thumbnailUrl) {
      wx.showToast({ title: '暂无可预览照片', icon: 'none' });
      return;
    }

    wx.previewImage({
      current: photo.thumbnailUrl,
      urls: this.data.photos.map((item) => item.thumbnailUrl).filter(Boolean)
    });
  }
});

function findPhotoByEvent(photos = [], event = {}) {
  const photoId = event.currentTarget?.dataset?.id || event.target?.dataset?.id;
  return photos.find((item) => String(item.id) === String(photoId));
}

export function normalizePhotos(result = []) {
  const list = Array.isArray(result) ? result : (result.photos || result.data || result.items || []);
  return list.map((item, index) => {
    const normalized = normalizePhoto(item);
    const lat = parseCoordinate(normalized.lat);
    const lon = parseCoordinate(normalized.lon);
    const thumbnailUrl = normalized.thumbUrl || '';
    const location = normalized.locationName || item.location || item.place || normalized.desc || '未知地点';

    return {
      id: normalized.id || `photo-${index}`,
      markerId: index + 1,
      location,
      coordinatesText: lat !== null && lon !== null ? `${lat.toFixed(4)}, ${lon.toFixed(4)}` : '位置待补充',
      lat,
      lon,
      hasLocation: lat !== null && lon !== null,
      takenAt: formatPhotoTime(normalized.takenAt || item.shootingTime),
      uploadedAt: formatPhotoTime(normalized.uploadedAt),
      uploader: normalized.uploaderName || item.author || '霞友',
      description: normalized.desc || '',
      thumbnailUrl,
      hasThumbnail: Boolean(thumbnailUrl)
    };
  });
}

export function buildMapMarkers(photos = []) {
  return photos
    .filter((photo) => photo.hasLocation)
    .map((photo, index) => ({
      id: photo.markerId,
      latitude: photo.lat,
      longitude: photo.lon,
      title: photo.location,
      zIndex: photos.length - index,
      width: 30,
      height: 30,
      callout: {
        content: photo.location,
        color: '#ffffff',
        fontSize: 12,
        borderRadius: 10,
        bgColor: '#111827',
        padding: 8,
        display: 'BYCLICK'
      }
    }));
}

export function parseCoordinate(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatPhotoTime(value) {
  if (!value) return '时间待补充';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${month}-${day} ${hour}:${minute}`;
}
