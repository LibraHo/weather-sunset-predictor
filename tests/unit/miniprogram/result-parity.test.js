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
  });
});
