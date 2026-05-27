import fs from 'fs';
import path from 'path';

const html = fs.readFileSync(path.resolve(process.cwd(), 'public/gallery.html'), 'utf8');
const appSource = fs.readFileSync(path.resolve(process.cwd(), 'src/app.js'), 'utf8');

describe('gallery share map page', () => {
  test('uses the firecloud map basemap component and local Leaflet assets', () => {
    expect(html).toContain("import ChinaMapCanvas from '/src/components/ChinaMapCanvas.js'");
    expect(html).toContain("new ChinaMapCanvas");
    expect(html).toContain('/vendor/leaflet/leaflet.css');
    expect(html).toContain('/vendor/leaflet/leaflet.js');
    expect(html).not.toContain('unpkg.com/leaflet');
    expect(html).not.toContain("fetch('/data/china-geojson.json')");
  });

  test('disables firecloud score controls on the photo sharing map', () => {
    expect(html).toContain('showScoreLegend: false');
    expect(html).toContain('enableScoreQuery: false');
  });

  test('photo popup shows capture and upload metadata', () => {
    expect(html).toContain("t('gallery.takenAt')");
    expect(html).toContain("t('gallery.locationName')");
    expect(html).toContain("t('gallery.uploadedAt')");
    expect(html).toContain("t('gallery.uploaderName')");
    expect(html).toContain('photo.uploaderName');
    expect(html).toContain('photo.takenAt');
    expect(html).toContain('photo.uploadedAt');
  });

  test('clusters nearby photos into accessible stack markers and thumbnail grids', () => {
    expect(html).toContain("import { clusterPhotosByPixelDistance, preferredPhotoUrl } from '/src/utils/galleryPhotoClusters.js'");
    expect(html).toContain('class="photo-marker stack-marker"');
    expect(html).toContain('photo-count-badge');
    expect(html).toContain('cluster-photo-grid');
    expect(html).toContain('cluster-photo-button');
    expect(html).toContain("map.on('zoomend moveend', renderPhotoMarkers)");
    expect(html).toContain('aria-label');
  });

  test('uses thumbnail-first URLs and i18n hooks for gallery-visible copy', () => {
    expect(html).toContain('preferredPhotoUrl(photo)');
    expect(html).toContain('preferredPhotoUrl(representative)');
    expect(html).toContain('data-i18n="gallery.title"');
    expect(html).toContain('data-i18n="gallery.subtitle"');
    expect(html).toContain('data-i18n-aria-label="gallery.legendAria"');
    expect(html).toContain('data-i18n="gallery.photoLocationLegend"');
  });

  test('uses Xiake design language tokens and no emoji title markers', () => {
    expect(html).toContain('class="gallery-body"');
    expect(html).toContain('var(--theme-card-bg');
    expect(html).toContain('var(--theme-accent-strong');
    expect(html).toContain('gallery-logo-icon');
    expect(html).not.toContain('🔥');
    expect(html).not.toContain('📷');
  });

  test('inherits site theme instead of forcing dark mode', () => {
    expect(html).toContain("localStorage.getItem('app_theme')");
    expect(html).toContain('function applyGalleryTheme()');
    expect(html).toContain("style: actualTheme");
    expect(html).not.toContain('class="theme-dark gallery-body"');
    expect(html).not.toContain("style: 'dark'");
    expect(html).not.toContain('background: var(--map-bg-dark');
  });

  test('syncs gallery basemap with the shared map tile setting', () => {
    expect(html).toContain("localStorage.getItem('map_tile_provider')");
    expect(html).toContain('function applyGalleryMapTileProvider');
    expect(html).toContain('mapCanvas.setTileProvider(provider)');
    expect(html).toContain("event.key === 'map_tile_provider'");
    expect(html).toContain("event.data?.type === 'mapTileProviderChanged'");
    expect(html).toContain('applyGalleryMapTileProvider();');
    expect(appSource).toContain('function setupGalleryBasemapSync');
    expect(appSource).toContain("document.getElementById('gallery-iframe')");
    expect(appSource).toContain("type: 'mapTileProviderChanged'");
    expect(appSource).toContain('galleryFrame.contentWindow?.postMessage');
  });

  test('hero copy explains the gallery value instead of restating basemap implementation', () => {
    expect(html).toContain('晚霞照片分享');
    expect(html).toContain('看看世界各地分享的晚霞照片');
    expect(html).not.toContain('火烧云照片地图');
    expect(html).not.toContain('照片分享地图');
    expect(html).not.toContain('评分');
    expect(html).not.toContain('使用火烧云地图同款地理底图');
  });

  test('title card leaves the Leaflet zoom control unobstructed', () => {
    expect(html).toContain('.gallery-title {\n      top: 16px;\n      left: 72px;');
    expect(html).toContain('.gallery-title { top: 12px; left: 64px;');
    expect(html).not.toContain('.gallery-title { top: 12px; left: 12px;');
  });

  test('mobile popup is constrained so zoom controls stay usable', () => {
    expect(html).toContain('.photo-popup .leaflet-popup-content { max-height: min(58vh, 430px); overflow: auto; }');
    expect(html).toContain('.cluster-photo-grid { grid-template-columns: repeat(2, 72px);');
  });

  test('cluster thumbnails keep stable square dimensions inside Leaflet popups', () => {
    expect(html).toContain('grid-template-columns: repeat(3, 72px);');
    expect(html).toContain('width: 72px;');
    expect(html).toContain('height: 72px;');
    expect(html).toContain('.cluster-photo-button img { width: 100%; height: 100%; max-width: none;');
  });
});
