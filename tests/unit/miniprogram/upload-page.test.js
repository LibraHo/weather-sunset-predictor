import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { jest } from '@jest/globals';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('miniprogram upload page source', () => {
  let helpers;

  beforeAll(async () => {
    globalThis.getApp = () => ({
      globalData: { latestPrediction: null }
    });
    globalThis.__uploadPage = null;
    globalThis.Page = jest.fn((page) => {
      globalThis.__uploadPage = page;
    });
    globalThis.wx = {
      getStorageSync: jest.fn(() => null),
      chooseMedia: jest.fn(),
      navigateTo: jest.fn()
    };
    helpers = await import('../../../miniprogram/pages/upload/index.js');
  });

  afterAll(() => {
    delete globalThis.getApp;
    delete globalThis.Page;
    delete globalThis.wx;
    delete globalThis.__uploadPage;
  });

  test('app.json registers upload page', () => {
    const appJson = JSON.parse(read('miniprogram/app.json'));
    expect(appJson.pages).toContain('pages/upload/index');
  });

  test('gallery page does not expose upload entry', () => {
    const js = read('miniprogram/pages/gallery/index.js');
    const wxml = read('miniprogram/pages/gallery/index.wxml');

    expect(js).not.toContain('goUpload()');
    expect(js).not.toContain("url: '/pages/upload/index'");
    expect(wxml).not.toContain('bindtap="goUpload"');
    expect(wxml).not.toContain('上传照片');
  });

  test('upload page supports chooseMedia, uploadPhoto and metadata fields', () => {
    const js = read('miniprogram/pages/upload/index.js');
    const wxml = read('miniprogram/pages/upload/index.wxml');
    const wxss = read('miniprogram/pages/upload/index.wxss');

    expect(js).toContain('wx.chooseMedia');
    expect(js).toContain("mediaType: ['image']");
    expect(js).toContain('uploadPhoto(payload');
    expect(wxml).toContain('data-field="locationName"');
    expect(wxml).toContain('data-field="uploaderName"');
    expect(wxml).toContain('data-field="takenAt"');
    expect(wxml).toContain('data-field="lat"');
    expect(wxml).toContain('data-field="lon"');
    expect(wxml).toContain('data-field="desc"');
    expect(wxml).toContain('upload-format-hint');
    expect(wxml).toContain('metadata-edit-hint');
    expect(wxss).toContain('.upload-format-hint');
    expect(wxss).toContain('.metadata-edit-hint');
  });

  test('buildUploadPayload trims metadata and keeps file path', () => {
    expect(helpers.buildUploadPayload({
      selectedPhoto: { filePath: '/tmp/photo.jpg' },
      form: {
        locationName: '  颐和园  ',
        uploaderName: ' Alex ',
        takenAt: '2026-05-12T19:20:00+08:00',
        lat: '39.99',
        lon: '116.27',
        desc: '  金色云边  '
      }
    })).toEqual({
      filePath: '/tmp/photo.jpg',
      locationName: '颐和园',
      uploaderName: 'Alex',
      takenAt: '2026-05-12T19:20:00+08:00',
      lat: '39.99',
      lon: '116.27',
      desc: '金色云边'
    });
  });

  test('submit success keeps the trimmed uploader name for the next upload', async () => {
    const page = globalThis.__uploadPage;
    const uploadFile = jest.fn(({ success }) => {
      success({
        statusCode: 201,
        data: JSON.stringify({ success: true, photo: { id: 'p2' } })
      });
      return { onProgressUpdate: jest.fn((handler) => handler({ progress: 64 })) };
    });
    const state = {
      ...page.data,
      selectedPhoto: { filePath: '/tmp/photo.jpg' },
      hasPhoto: true,
      form: {
        locationName: ' Test Place ',
        uploaderName: ' Alex ',
        takenAt: '',
        lat: '',
        lon: '',
        desc: ''
      }
    };
    const ctx = {
      ...page,
      data: state,
      setData(patch) {
        Object.entries(patch).forEach(([key, value]) => {
          const parts = key.split('.');
          let target = this.data;
          while (parts.length > 1) {
            const part = parts.shift();
            target[part] = target[part] || {};
            target = target[part];
          }
          target[parts[0]] = value;
        });
      }
    };
    globalThis.wx.getStorageSync.mockImplementation((key) => (key === 'sessionToken' ? 'test-token' : null));
    globalThis.wx.uploadFile = uploadFile;

    await page.submitPhoto.call(ctx);

    expect(uploadFile.mock.calls[0][0].formData.uploaderName).toBe('Alex');
    expect(ctx.data.form.uploaderName).toBe('Alex');
    expect(ctx.data.hasPhoto).toBe(false);
    expect(ctx.data.successMessage).toContain('照片已上传');
  });

  test('validateUploadPayload requires photo and valid paired coordinates', () => {
    expect(helpers.validateUploadPayload({})).toBe('请先选择一张照片。');
    expect(helpers.validateUploadPayload({ filePath: '/tmp/photo.jpg', lat: '39.9' })).toBe('经纬度需要同时填写。');
    expect(helpers.validateUploadPayload({ filePath: '/tmp/photo.jpg', lat: '91', lon: '116' })).toBe('纬度需要在 -90 到 90 之间。');
    expect(helpers.validateUploadPayload({ filePath: '/tmp/photo.jpg', lat: '39', lon: '181' })).toBe('经度需要在 -180 到 180 之间。');
    expect(helpers.validateUploadPayload({ filePath: '/tmp/photo.jpg', lat: '39', lon: '116' })).toBe('');
  });

  test('keeps Xiake dark sky, warm accent and glass-card design language', () => {
    const wxml = read('miniprogram/pages/upload/index.wxml');
    const wxss = read('miniprogram/pages/upload/index.wxss');

    expect(wxml).toContain('upload-page');
    expect(wxml).toContain('xiake-card');
    expect(wxml).toContain('glass-card');
    expect(wxml).toContain('warm-accent');
    expect(wxss).toContain('#f5c87a');
    expect(wxss).toContain('rgba(18, 28, 52');
    expect(wxss).toContain('linear-gradient(135deg');
  });
});
