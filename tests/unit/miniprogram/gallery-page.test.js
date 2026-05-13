import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('miniprogram gallery page source', () => {
  test('app.json registers gallery page', () => {
    const appJson = JSON.parse(read('miniprogram/app.json'));
    expect(appJson.pages).toContain('pages/gallery/index');
  });

  test('page state covers loading, error, empty, photos and native map data', () => {
    const js = read('miniprogram/pages/gallery/index.js');
    const wxml = read('miniprogram/pages/gallery/index.wxml');

    expect(js).toContain('DEFAULT_MAP_CENTER');
    expect(js).toContain('mapMarkers: []');
    expect(js).toContain('activePhoto: null');
    expect(js).toContain('latestPhoto: null');
    expect(js).toContain('photoStats:');
    expect(wxml).toContain('wx:if="{{loading}}"');
    expect(wxml).toContain('wx:elif="{{errorMessage}}"');
    expect(wxml).toContain('wx:elif="{{isEmpty}}"');
    expect(wxml).toContain('wx:else');
    expect(wxml).toContain('<map');
    expect(wxml).toContain('markers="{{mapMarkers}}"');
    expect(wxml).toContain('bindmarkertap="focusPhoto"');
  });

  test('loads photos from service and normalizes metadata, coordinates and original URLs', () => {
    const js = read('miniprogram/pages/gallery/index.js');
    const wxml = read('miniprogram/pages/gallery/index.wxml');

    expect(js).toContain("import { listPhotos, normalizePhoto } from '../../services/photos.js'");
    expect(js).toContain('await listPhotos()');
    expect(js).toContain('buildMapMarkers(photos)');
    expect(js).toContain('normalized.locationName || item.location');
    expect(js).toContain('normalized.takenAt || item.shootingTime');
    expect(js).toContain('normalized.uploaderName');
    expect(js).toContain('normalized.thumbUrl');
    expect(js).toContain('normalizePhoto(item');
    expect(js).toContain('coordinatesText');
    expect(wxml).toContain('{{item.location}}');
    expect(wxml).toContain('{{item.takenAt}}');
    expect(wxml).toContain('{{item.uploader}}');
    expect(wxml).toContain('{{item.coordinatesText}}');
    expect(wxml).toContain('{{item.uploadedAt}}');
    expect(wxml).toContain('{{item.thumbnailUrl}}');
    expect(wxml).toContain('photo-placeholder');
  });

  test('primary actions match web-like gallery behavior with H5 fallback retained', () => {
    const js = read('miniprogram/pages/gallery/index.js');
    const wxml = read('miniprogram/pages/gallery/index.wxml');

    expect(js).toContain("GALLERY_LINK = 'https://sunset.bjhyc.online/gallery.html'");
    expect(js).toContain('focusPhoto(event = {})');
    expect(js).toContain('previewOriginal(event = {})');
    expect(js).toContain('wx.previewImage');
    expect(js).toContain('copyPhotoLink(event = {})');
    expect(js).toContain('copyGalleryLink()');
    expect(js).toContain('wx.copyClipboardData');
    expect(js).toContain("wx.navigateTo({ url: '/pages/upload/index' })");
    expect(js).not.toContain('navigateToMiniProgram');
    expect(wxml).toContain('上传照片');
    expect(wxml).toContain('查看原图');
    expect(wxml).toContain('复制照片链接');
    expect(wxml).toContain('复制 H5 地图');
  });

  test('keeps Xiake dark sky, warm accent and glass-card design language', () => {
    const wxml = read('miniprogram/pages/gallery/index.wxml');
    const wxss = read('miniprogram/pages/gallery/index.wxss');

    expect(wxml).toContain('gallery-page');
    expect(wxml).toContain('xiake-card');
    expect(wxml).toContain('glass-card');
    expect(wxml).toContain('warm-accent');
    expect(wxml).toContain('photo-card');
    expect(wxml).toContain('native-map-shell');
    expect(wxml).toContain('map-legend');
    expect(wxml).toContain('legend-photo-dot');
    expect(wxml).toContain('active-uploaded-at');
    expect(wxml).toContain('photo-uploaded-at');
    expect(wxss).toContain('#f5c87a');
    expect(wxss).toContain('rgba(18, 28, 52');
    expect(wxss).toContain('map-empty-panel');
    expect(wxss).toContain('.map-legend');
    expect(wxss).toContain('.legend-photo-dot');
    expect(wxss).toContain('linear-gradient(180deg');
    expect(wxss).toContain('rgba(251, 146, 60');
  });
});
