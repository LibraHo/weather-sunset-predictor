import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('miniprogram surface parity for map/gallery/upload/methodology', () => {
  test('web exposes API access and gallery/upload/map surfaces used as the parity baseline', () => {
    const index = read('index.html');
    const gallery = read('public/gallery.html');
    const readme = read('README.en.md');

    expect(index).toContain('data-view="api"');
    expect(index).toContain('/api/agent/openapi.json');
    expect(index).toContain('/forecast');
    expect(index).toContain('/explain');
    expect(index).toContain('/geocode');
    expect(gallery).toContain('id="empty-state"');
    expect(gallery).toContain('/api/photos');
    expect(readme).toContain('/api/prediction');
    expect(readme).toContain('/api/spots');
    expect(readme).toContain('/api/photos');
    expect(readme).toContain('/api/agent');
  });

  test('methodology page carries a lightweight API access entry matching the web API tab', () => {
    const wxml = read('miniprogram/pages/methodology/index.wxml');
    const js = read('miniprogram/pages/methodology/index.js');

    expect(wxml).toContain('api-surface-card');
    expect(wxml).toContain('API接入');
    expect(wxml).toContain('/api/agent/forecast');
    expect(wxml).toContain('/api/agent/explain');
    expect(wxml).toContain('/api/agent/geocode');
    expect(wxml).not.toContain('<text class="api-path">/forecast</text>');
    expect(wxml).toContain('bindtap="copyOpenApiSpec"');
    expect(wxml).toContain('bindtap="copyApiApplyLink"');
    expect(js).toContain("openapiSpecUrl = 'https://sunset.bjhyc.online/api/agent/openapi.json'");
    expect(js).toContain("apiApplyUrl = 'https://sunset.bjhyc.online/api-apply.html'");
    expect(js).toContain('copyOpenApiSpec()');
    expect(js).toContain('copyApiApplyLink()');
  });

  test('gallery hides upload entry while upload page keeps metadata and return actions', () => {
    const galleryWxml = read('miniprogram/pages/gallery/index.wxml');
    const galleryWxss = read('miniprogram/pages/gallery/index.wxss');
    const uploadWxml = read('miniprogram/pages/upload/index.wxml');
    const uploadWxss = read('miniprogram/pages/upload/index.wxss');

    expect(galleryWxml).toContain('empty-state');
    expect(galleryWxml).not.toContain('bindtap="goUpload"');
    expect(galleryWxml).not.toContain('上传照片');
    expect(galleryWxml).not.toContain('copyGalleryLink');
    expect(galleryWxml).not.toContain('H5 地图');
    expect(galleryWxml).not.toContain('查看原图');
    expect(galleryWxml).toContain('map-legend');
    expect(galleryWxml).toContain('active-uploaded-at');
    expect(galleryWxml).toContain('photo-uploaded-at');
    expect(galleryWxss).toContain('.map-legend');
    expect(galleryWxss).toContain('.legend-photo-dot');

    expect(uploadWxml).toContain('upload-parity-note');
    expect(uploadWxml).toContain('upload-format-hint');
    expect(uploadWxml).toContain('metadata-edit-hint');
    expect(uploadWxml).toContain('bindtap="goGallery"');
    expect(uploadWxss).toContain('.upload-format-hint');
    expect(uploadWxss).toContain('.metadata-edit-hint');
  });

  test('map keeps the native firecloud raster layer visible without high-score point UI', () => {
    const mapWxml = read('miniprogram/pages/map/index.wxml');
    const mapJs = read('miniprogram/pages/map/index.js');
    const index = read('index.html');

    expect(index).toContain('id="china-spots-map"');
    expect(index).toContain('id="china-spots-period-label"');
    expect(index).toContain('weatherMap.supportedRegions');
    expect(mapWxml).toContain('map-tabs');
    expect(mapWxml).toContain('data-value="sunrise"');
    expect(mapWxml).toContain('data-value="sunset"');
    expect(mapWxml).toContain('map-panel-hint');
    expect(mapWxml).toContain('wx:for="{{legendItems}}"');
    expect(mapWxml).toContain('legend-swatch legend-{{item.key}}');
    expect(mapWxml).toContain('id="firecloud-native-map"');
    expect(mapWxml).toContain('ground-overlays="{{groundOverlays}}"');
    expect(mapWxml).not.toContain('bindtap="openSpotPrediction"');
    expect(mapWxml).not.toContain('spot-row');
    expect(mapJs).not.toContain('openSpotPrediction()');
    expect(mapJs).not.toContain('getChinaFirecloudSpots');
    expect(mapJs).toContain('addNativeGroundOverlay');
    expect(mapJs).toContain('buildRasterPolygons(raster, this.data.period)');
    expect(mapJs).toContain('periodDetailText(period)');
    expect(mapJs).toContain('getChinaFirecloudRaster');
  });
});
