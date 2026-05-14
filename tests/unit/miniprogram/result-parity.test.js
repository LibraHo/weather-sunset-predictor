import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('miniprogram result page web parity', () => {
  test('surfaces the website score ledger before weather metrics and text analysis', () => {
    const web = read('src/controllers/PredictionController.js');
    const wxml = read('miniprogram/pages/result/index.wxml');
    const js = read('miniprogram/pages/result/index.js');
    const wxss = read('miniprogram/pages/result/index.wxss');

    expect(web).toContain('score-breakdown-popover score-breakdown-ledger');
    expect(web).toContain('score-ledger-steps');
    expect(web).toContain("ledgerText('labels.cloudCarrier'");
    expect(web).toContain("ledgerText('labels.lightPath'");
    expect(web).toContain("ledgerText('labels.rendering'");

    expect(wxml).toContain('score-ledger-card');
    expect(wxml).toContain('score-ledger-steps');
    expect(wxml).toContain('wx:for="{{scoreLedger.steps}}"');
    expect(js).toContain('scoreLedger: buildScoreLedger(normalized)');
    expect(js).toContain('export function buildScoreLedger');
    expect(js).toContain("key: 'cloudCarrier'");
    expect(js).toContain("key: 'lightPath'");
    expect(js).toContain("key: 'rendering'");
    expect(wxss).toContain('.score-ledger-card');
    expect(wxss).toContain('.score-ledger-step-final');

    expect(wxml.indexOf('score-ledger-card')).toBeLessThan(wxml.indexOf('metric-grid'));
    expect(wxml.indexOf('score-ledger-card')).toBeLessThan(wxml.indexOf('analysis-card'));
  });

  test('keeps result actions in the mobile web product order', () => {
    const web = read('src/controllers/PredictionController.js');
    const wxml = read('miniprogram/pages/result/index.wxml');
    const js = read('miniprogram/pages/result/index.js');
    const renderStart = web.indexOf('  renderSinglePrediction(');

    expect(web.indexOf('prediction-share-menu', renderStart)).toBeLessThan(web.indexOf('score-summary-card', renderStart));

    expect(wxml.indexOf('open-type="share"')).toBeLessThan(wxml.indexOf('bindtap="toggleFavorite"'));
    expect(wxml.indexOf('data-target="map"')).toBeLessThan(wxml.indexOf('data-target="methodology"'));
    expect(wxml.indexOf('data-target="gallery"')).toBeLessThan(wxml.indexOf('data-target="api"'));
    expect(wxml.indexOf('data-target="api"')).toBeLessThan(wxml.indexOf('data-target="upload"'));
    expect(js.indexOf("map: `/pages/map/index?period=${this.data.prediction?.period")).toBeLessThan(js.indexOf("methodology: '/pages/methodology/index'"));
    expect(js).toContain("api: '/pages/methodology/index?section=api'");
  });

  test('keeps the web sunrise sunset card switch on the result surface', () => {
    const web = read('src/controllers/PredictionController.js');
    const wxml = read('miniprogram/pages/result/index.wxml');
    const js = read('miniprogram/pages/result/index.js');
    const wxss = read('miniprogram/pages/result/index.wxss');

    expect(web).toContain('prediction-toggle-bar');
    expect(wxml).toContain('result-prediction-toggle');
    expect(wxml).toContain('data-period="sunrise"');
    expect(wxml).toContain('data-period="sunset"');
    expect(wxml).toContain('bindtap="selectResultPeriod"');
    expect(js).toContain("activePeriod: 'sunset'");
    expect(js).toContain('periodCards: {}');
    expect(js).toContain('selectResultPeriod(event)');
    expect(wxss).toContain('.result-prediction-toggle');
    expect(wxml).not.toContain('result-prediction-toggle xiake-card');
    expect(wxss).toContain('border-radius: 999rpx');
    expect(wxss).toContain('background: rgba(255, 252, 246, 0.72)');
    expect(wxss).toContain('background: linear-gradient(135deg, #f59e0b, #ea8500)');
  });

  test('renders the website radar compass structure instead of a placeholder-only panel', () => {
    const web = read('src/components/RadarCompass.js');
    const wxml = read('miniprogram/pages/result/index.wxml');
    const js = read('miniprogram/pages/result/index.js');
    const wxss = read('miniprogram/pages/result/index.wxss');

    expect(web).toContain('radar-cloud-field-');
    expect(web).toContain('radar-sun-event-icon');
    expect(wxml).toContain('radar-cloud-field');
    expect(wxml).toContain('id="resultRadarCloudField"');
    expect(wxml).toContain('canvas-id="resultRadarCloudField"');
    expect(wxml).toContain('radar-cloud-canvas');
    expect(wxml).toContain('radar-ring-low-inner');
    expect(wxml).not.toContain('radar-cloud-gradient');
    expect(wxml).not.toContain('radar-direction-score');
    expect(wxml).not.toContain('radar-cloud-blob');
    expect(wxml).toContain('radar-sun-event-icon');
    expect(wxml).toContain('wx:for="{{radar.rings}}"');
    expect(wxml).not.toContain('wx:for="{{radar.cloudBlobs}}"');
    expect(wxml).toContain('wx:for="{{radar.sunEvents}}"');
    expect(wxml).not.toContain('radar-detail-strip');
    expect(js).toContain('buildRadarRings');
    expect(js).toContain('cloudGradients: buildRadarCloudGradients(directions)');
    expect(js).toContain("paintRadarCloudCanvas('resultRadarCloudField', directions, { page: this })");
    expect(js).not.toContain('buildRadarCloudBlobs');
    expect(js).toContain('buildRadarSunEvents');
    expect(wxss).toContain('.radar-cloud-field');
    expect(wxss).toContain('.radar-cloud-canvas');
    expect(wxss).toContain('.radar-ring-low-inner');
    expect(wxss).toContain('width: 84%;');
    expect(wxss).toContain('height: 84%;');
    expect(wxss).toContain('top: 6.3%;');
    expect(wxss).toContain('height: 87.4%;');
    expect(wxss).not.toContain('.radar-direction-score');
    expect(wxss).not.toContain('.radar-cloud-gradient');
    expect(wxss).not.toContain('.radar-cloud-blob-high');
    expect(wxss).toContain('.radar-sun-event-icon');
  });
});
