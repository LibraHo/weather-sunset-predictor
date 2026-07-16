import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('miniprogram methodology page', () => {
  test('registers a native firecloud methodology page', () => {
    const appJson = JSON.parse(read('miniprogram/app.json'));

    expect(appJson.pages).toContain('pages/methodology/index');
  });

  test('covers the same user-facing methodology sections as web', () => {
    const wxml = read('miniprogram/pages/methodology/index.wxml');
    const js = read('miniprogram/pages/methodology/index.js');

    expect(wxml).toContain('{{heroTitle}}');
    expect(js).toContain("heroTitle: '火烧云计算方法'");
    expect(wxml).toContain('评分解读');
    expect(wxml).toContain('形成条件');
    expect(wxml).toContain('分数计算链路');
    expect(wxml).toContain('地图分 / 地点详情分说明');
    expect(wxml).toContain('版本更新记录');
    expect(wxml).toContain('changelog-scroll');

    expect(js).toContain('85-100 分');
    expect(js).toContain('70-84 分');
    expect(js).toContain('40-69 分');
    expect(js).toContain('<40 分');
    expect(js).toContain('开光路空气显色中间档');
    expect(js).toContain('分层与空间重叠协同 v1');
    expect(js).toContain('midCarrier × midLight');
    expect(js).toContain('overlapSynergy(regions)');
    expect(js).toContain('硬阻断拆成 hard/soft');
    expect(js).toContain('远端分层载体 v1');
    expect(js).toContain('分层云载体');
    expect(js).toContain('本地云层展开');
    expect(js).toContain('云厚比例折损 v2');
    expect(js).toContain('日落方向云拆成远端高云、远端中云和远端低云遮挡');
    expect(js).toContain('远端高云、远端中云和远端低云遮挡');
    expect(js).not.toContain('低太阳透射证据 v1');
    expect(js).not.toContain('载体缓冲');
    expect(js).not.toContain('thicknessPenalty = canvasBeforeThickness × 0.30 × thicknessPressure');
    expect(js).not.toContain('去掉固定 -28/24 上限');
    expect(js).not.toContain('不再用直射比直接参与评分');
    expect(js).toContain('高云×0.75 + 中云×0.45');
    expect(js).not.toContain("formula: 'base = Σ(layerCarrier × layerBrightness)'");
    expect(js).toContain('airRendering');
    expect(js).toContain('中等显色档');
    expect(js).toContain('layerSynergy(mid, high)');
    expect(js).toContain('受光亮度');
    expect(js).toContain('光路和下层遮挡分别估算');
    expect(js).toContain('无火烧云 <40');
    expect(wxml).toContain('2026.07.16 · 分层与空间重叠协同 v1');
    expect(wxml).toContain('地图分');
    expect(wxml).toContain('地点详情分');
    expect(js).not.toContain('DOM');
  });

  test('renders a dedicated API access mode from the home menu', () => {
    const wxml = read('miniprogram/pages/methodology/index.wxml');
    const js = read('miniprogram/pages/methodology/index.js');

    expect(wxml).toContain('current="{{currentNav}}"');
    expect(wxml).toContain('wx:if="{{!apiOnly}}"');
    expect(wxml).toContain('API接入');
    expect(wxml).toContain('/api/agent/forecast');
    expect(wxml).toContain('/api/agent/explain');
    expect(wxml).toContain('/api/agent/geocode');
    expect(wxml).not.toContain('<text class="api-path">/forecast</text>');
    expect(js).toContain("apiOnly: false");
    expect(js).toContain("currentNav: 'methodology'");
    expect(js).toContain("options.section === 'api'");
  });

  test('uses Xiake sunset glass styling instead of heavy blue form styling', () => {
    const wxss = read('miniprogram/pages/methodology/index.wxss');
    const wxml = read('miniprogram/pages/methodology/index.wxml');

    expect(wxml).toContain('<app-topbar current="{{currentNav}}" theme-mode="{{themeMode}}" resolved-theme-mode="{{resolvedThemeMode}}"');
    expect(wxml).toContain('methodology-section xiake-card app-section-card');
    expect(wxss).toContain('#0a0f1e');
    expect(wxss).toContain('#ffd166');
    expect(wxss).toContain('#fb923c');
    expect(wxss).toContain('rgba(18, 28, 52');
    expect(wxss).toContain('rgba(251, 146, 60');
    expect(wxss).toContain('.methodology-page.theme-light .methodology-section');
    expect(wxss).toContain('.methodology-page.theme-dark .methodology-section');
    expect(wxss).toContain('gap: 24rpx');
    expect(wxss).not.toContain('#003366');
    expect(wxss).not.toContain('form-item');
  });
});
