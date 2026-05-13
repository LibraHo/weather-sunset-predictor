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
    globalThis.Page = jest.fn();
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
  });

  test('app.json registers upload page', () => {
    const appJson = JSON.parse(read('miniprogram/app.json'));
    expect(appJson.pages).toContain('pages/upload/index');
  });

  test('gallery page links to upload page', () => {
    const js = read('miniprogram/pages/gallery/index.js');
    const wxml = read('miniprogram/pages/gallery/index.wxml');

    expect(js).toContain('goUpload()');
    expect(js).toContain("url: '/pages/upload/index'");
    expect(wxml).toContain('bindtap="goUpload"');
    expect(wxml).toContain('上传照片');
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
