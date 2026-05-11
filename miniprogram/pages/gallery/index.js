import { listPhotos } from '../../services/photos.js';

export const GALLERY_LINK = 'https://sunset.bjhyc.online/gallery.html';

Page({
  data: {
    loading: false,
    errorMessage: '',
    photos: [],
    hasPhotos: false,
    isEmpty: false,
    galleryLink: GALLERY_LINK,
    mapStatus: {
      title: '分享地图入口',
      description: '打开完整地图，查看照片位置与详情。'
    }
  },

  onLoad() {
    this.loadPhotos();
  },

  async loadPhotos() {
    this.setData({ loading: true, errorMessage: '', isEmpty: false });

    try {
      const result = await listPhotos();
      const photos = normalizePhotos(result);
      this.setData({
        photos,
        hasPhotos: photos.length > 0,
        isEmpty: photos.length === 0
      });
    } catch (error) {
      this.setData({
        errorMessage: '照片列表暂时加载失败，请稍后再试。',
        photos: [],
        hasPhotos: false,
        isEmpty: false
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  copyGalleryLink() {
    wx.copyClipboardData({
      data: GALLERY_LINK,
      success: () => {
        wx.showToast({ title: '分享地图链接已复制', icon: 'none' });
      },
      fail: () => {
        wx.showToast({ title: '复制失败，请稍后再试', icon: 'none' });
      }
    });
  },

  goUpload() {
    wx.navigateTo({ url: '/pages/upload/index' });
  }
});

export function normalizePhotos(result = []) {
  const list = Array.isArray(result) ? result : (result.photos || result.data || result.items || []);
  return list.map((item, index) => ({
    id: item.id || item.photoId || item._id || `photo-${index}`,
    location: item.locationName || item.location || item.place || '未知地点',
    takenAt: formatPhotoTime(item.takenAt || item.shootingTime || item.createdAt || item.uploadedAt),
    uploader: item.uploaderName || item.uploader || item.author || '霞友',
    thumbnailUrl: item.thumbUrl || item.thumbnailUrl || item.thumbnail || item.coverUrl || item.url || '',
    hasThumbnail: Boolean(item.thumbUrl || item.thumbnailUrl || item.thumbnail || item.coverUrl || item.url)
  }));
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
