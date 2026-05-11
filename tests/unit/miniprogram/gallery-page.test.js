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

  test('page state covers loading, error, empty and photos', () => {
    const js = read('miniprogram/pages/gallery/index.js');
    const wxml = read('miniprogram/pages/gallery/index.wxml');

    expect(js).toContain("loading: false");
    expect(js).toContain("errorMessage: ''");
    expect(js).toContain('photos: []');
    expect(js).toContain('isEmpty: false');
    expect(wxml).toContain('wx:if="{{loading}}"');
    expect(wxml).toContain('wx:elif="{{errorMessage}}"');
    expect(wxml).toContain('wx:elif="{{isEmpty}}"');
    expect(wxml).toContain('wx:else');
  });

  test('loads photos from service and normalizes metadata fields', () => {
    const js = read('miniprogram/pages/gallery/index.js');
    const wxml = read('miniprogram/pages/gallery/index.wxml');

    expect(js).toContain("import { listPhotos } from '../../services/photos.js'");
    expect(js).toContain('await listPhotos()');
    expect(js).toContain('locationName || item.location');
    expect(js).toContain('takenAt || item.shootingTime');
    expect(js).toContain('uploaderName || item.uploader');
    expect(js).toContain('thumbUrl || item.thumbnailUrl');
    expect(wxml).toContain('{{item.location}}');
    expect(wxml).toContain('{{item.takenAt}}');
    expect(wxml).toContain('{{item.uploader}}');
    expect(wxml).toContain('{{item.thumbnailUrl}}');
    expect(wxml).toContain('photo-placeholder');
  });

  test('copyGalleryLink copies stable H5 gallery URL with toast', () => {
    const js = read('miniprogram/pages/gallery/index.js');

    expect(js).toContain("GALLERY_LINK = 'https://sunset.bjhyc.online/gallery.html'");
    expect(js).toContain('copyGalleryLink()');
    expect(js).toContain('wx.copyClipboardData');
    expect(js).toContain('wx.showToast');
    expect(js).not.toContain('navigateToMiniProgram');
  });

  test('keeps Xiake dark sky, warm accent and glass-card design language', () => {
    const wxml = read('miniprogram/pages/gallery/index.wxml');
    const wxss = read('miniprogram/pages/gallery/index.wxss');

    expect(wxml).toContain('gallery-page');
    expect(wxml).toContain('xiake-card');
    expect(wxml).toContain('glass-card');
    expect(wxml).toContain('warm-accent');
    expect(wxml).toContain('photo-card');
    expect(wxss).toContain('#f5c87a');
    expect(wxss).toContain('rgba(18, 28, 52');
    expect(wxss).toContain('backdrop-filter');
  });
});
