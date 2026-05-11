import { uploadPhoto } from '../../services/photos.js';

const app = getApp();

Page({
  data: {
    selectedPhoto: null,
    hasPhoto: false,
    previewUrl: '',
    form: {
      locationName: '',
      uploaderName: '',
      takenAt: '',
      lat: '',
      lon: '',
      desc: ''
    },
    submitting: false,
    progress: 0,
    errorMessage: '',
    successMessage: ''
  },

  onLoad(options = {}) {
    const latest = app.globalData.latestPrediction || wx.getStorageSync('latestPrediction') || {};
    const locationName = options.locationName || latest.locationName || '';
    const lat = options.lat || latest.lat || '';
    const lon = options.lon || latest.lon || '';

    this.setData({
      form: {
        ...this.data.form,
        locationName,
        lat,
        lon
      }
    });
  },

  async choosePhoto() {
    this.setData({ errorMessage: '', successMessage: '' });

    try {
      const result = await choosePhotoFromAlbum();
      const photo = result.tempFiles?.[0] || {};
      const filePath = photo.tempFilePath || result.tempFilePaths?.[0] || '';
      if (!filePath) {
        this.setData({ errorMessage: '没有拿到照片文件，请重新选择。' });
        return;
      }

      this.setData({
        selectedPhoto: { filePath, size: photo.size || 0 },
        hasPhoto: true,
        previewUrl: filePath
      });
    } catch (error) {
      this.setData({ errorMessage: normalizeChooseError(error) });
    }
  },

  onFieldInput(event) {
    const field = event.currentTarget.dataset.field;
    if (!field) return;
    this.setData({ [`form.${field}`]: event.detail.value });
  },

  async submitPhoto() {
    const payload = buildUploadPayload(this.data);
    const validation = validateUploadPayload(payload);
    if (validation) {
      this.setData({ errorMessage: validation, successMessage: '' });
      return;
    }

    this.setData({ submitting: true, progress: 0, errorMessage: '', successMessage: '' });

    try {
      await uploadPhoto(payload, {
        onProgress: ({ progress }) => {
          this.setData({ progress: Math.max(0, Math.min(100, Number(progress) || 0)) });
        }
      });
      this.setData({
        submitting: false,
        progress: 100,
        successMessage: '照片已上传，审核通过后会出现在分享地图。',
        selectedPhoto: null,
        hasPhoto: false,
        previewUrl: '',
        form: {
          locationName: '',
          uploaderName: this.data.form.uploaderName,
          takenAt: '',
          lat: '',
          lon: '',
          desc: ''
        }
      });
    } catch (error) {
      this.setData({
        submitting: false,
        errorMessage: error.message || '照片上传失败，请稍后再试。'
      });
    }
  },

  goGallery() {
    wx.navigateTo({ url: '/pages/gallery/index' });
  }
});

function choosePhotoFromAlbum() {
  return new Promise((resolve, reject) => {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: resolve,
      fail: reject
    });
  });
}

function normalizeChooseError(error = {}) {
  const message = error.errMsg || error.message || '';
  if (/cancel/i.test(message)) return '';
  return message || '选择照片失败，请稍后再试。';
}

export function buildUploadPayload(state = {}) {
  const form = state.form || {};
  const selectedPhoto = state.selectedPhoto || {};
  return {
    filePath: selectedPhoto.filePath || '',
    locationName: form.locationName?.trim?.() || '',
    uploaderName: form.uploaderName?.trim?.() || '',
    takenAt: form.takenAt || '',
    lat: form.lat,
    lon: form.lon,
    desc: form.desc?.trim?.() || ''
  };
}

export function validateUploadPayload(payload = {}) {
  if (!payload.filePath) return '请先选择一张照片。';
  const hasLat = payload.lat !== undefined && payload.lat !== null && payload.lat !== '';
  const hasLon = payload.lon !== undefined && payload.lon !== null && payload.lon !== '';
  if (hasLat !== hasLon) return '经纬度需要同时填写。';
  if (hasLat && !isValidCoordinate(payload.lat, -90, 90)) return '纬度需要在 -90 到 90 之间。';
  if (hasLon && !isValidCoordinate(payload.lon, -180, 180)) return '经度需要在 -180 到 180 之间。';
  return '';
}

function isValidCoordinate(value, min, max) {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max;
}
