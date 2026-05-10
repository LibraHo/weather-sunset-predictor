import fs from 'fs';
import path from 'path';

const html = fs.readFileSync(path.resolve(process.cwd(), 'public/gallery.html'), 'utf8');

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

  test('uses Xiake design language tokens and no emoji title markers', () => {
    expect(html).toContain('class="theme-dark gallery-body"');
    expect(html).toContain('var(--theme-card-bg');
    expect(html).toContain('var(--theme-accent-strong');
    expect(html).toContain('gallery-logo-icon');
    expect(html).not.toContain('🔥');
    expect(html).not.toContain('📷');
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
});
