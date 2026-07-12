import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(process.cwd());

describe('home methodology structure', () => {
  test('puts version update history at the end of the methodology page', () => {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const panelStart = html.indexOf('tab-panel-methodology');
    const gridIndex = html.indexOf('methodology-grid', panelStart);
    const scoreGuideIndex = html.indexOf('methodology-score-guide', panelStart);
    const changelogIndex = html.indexOf('methodology-changelog-card', panelStart);
    const mapPanelIndex = html.indexOf('tab-panel-map', panelStart);

    expect(panelStart).toBeGreaterThan(-1);
    expect(gridIndex).toBeGreaterThan(panelStart);
    expect(scoreGuideIndex).toBeGreaterThan(gridIndex);
    expect(changelogIndex).toBeGreaterThan(scoreGuideIndex);
    expect(mapPanelIndex).toBeGreaterThan(changelogIndex);
  });

  test('puts algorithm version at the end of a scrollable changelog card', () => {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const cardStart = html.indexOf('methodology-changelog-card');
    const scrollIndex = html.indexOf('methodology-changelog-scroll', cardStart);
    const latestIndex = html.indexOf('home.methodology.changelog.latest.title', cardStart);
    const aerosolIndex = html.indexOf('home.methodology.changelog.aerosol.title', cardStart);
    const openingIndex = html.indexOf('home.methodology.changelog.openingCarrier.title', cardStart);
    const lightPathIndex = html.indexOf('home.methodology.changelog.lightPath.title', cardStart);
    const upperCloudIndex = html.indexOf('home.methodology.changelog.upperCloudCarrier.title', cardStart);
    const versionIndex = html.indexOf('methodology-version-card', cardStart);

    expect(cardStart).toBeGreaterThan(-1);
    expect(scrollIndex).toBeGreaterThan(cardStart);
    expect(latestIndex).toBeGreaterThan(scrollIndex);
    expect(aerosolIndex).toBeGreaterThan(latestIndex);
    expect(openingIndex).toBeGreaterThan(aerosolIndex);
    expect(lightPathIndex).toBeGreaterThan(openingIndex);
    expect(upperCloudIndex).toBeGreaterThan(lightPathIndex);
    expect(versionIndex).toBeGreaterThan(upperCloudIndex);
    expect((html.slice(scrollIndex, versionIndex).match(/<li>/g) || []).length).toBeGreaterThanOrEqual(5);
  });

  test('shows the current score-ledger update in version history', () => {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const localeFiles = [
      'zh-CN.js',
      'zh-TW.js',
      'en-US.js',
      'ja-JP.js',
      'ko-KR.js',
      'vi-VN.js',
      'fr-FR.js',
      'es-ES.js',
      'it-IT.js',
      'ar-SA.js'
    ];
    const localeTexts = localeFiles.map(file => fs.readFileSync(path.join(ROOT, 'src/locales', file), 'utf8'));

    expect(html).toContain('2026-07-08');
    expect(html).toContain('2026.07.08-wet-haze-open-path-mid-rendering');
    expect(html).toContain('开光路空气显色中间档');
    expect(html).toContain('硬阻断拆成 hard/soft');
    expect(html).toContain('远端高云、远端中云和远端低云遮挡');
    expect(html).toContain('分层求和亮度公式 v1');
    expect(html).toContain('2026-06-03');
    expect(html).toContain('home.methodology.changelog.scoringV2.title');
    expect(html).toContain('home.methodology.sections.finalFormula.formula');
    expect(html).toContain('满铺中高云叠加 PM/AOD 偏高');
    expect(html).toContain('方向中云越强，越接近 50-60 档');
    expect(html).toContain('云厚比例折损 v2');
    expect(html).toContain('2026-07-07 北京开光路中等显色样本');
    expect(html).not.toContain('载体缓冲');
    expect(html).not.toContain('低太阳透射 未命中');

    const coreLocaleTexts = localeFiles
      .filter(file => ['zh-CN.js', 'zh-TW.js', 'en-US.js'].includes(file))
      .map(file => fs.readFileSync(path.join(ROOT, 'src/locales', file), 'utf8'))
      .join('\n');

    expect(coreLocaleTexts).toContain('2026.07.08-wet-haze-open-path-mid-rendering');
    expect(coreLocaleTexts).toContain('Open-path mid air-rendering band');
    expect(coreLocaleTexts).toContain('開光路空氣顯色中間檔');
    expect(coreLocaleTexts).toContain('Layer-weighted brightness formula v1');
    expect(coreLocaleTexts).toContain('remote high cloud');
    expect(coreLocaleTexts).toContain('Sunset scoring v2');
    expect(coreLocaleTexts).toContain('remote layer carriers');
    expect(localeTexts.join('\n')).toContain('2026-05-27');
    expect(localeTexts.join('\n')).toContain('Cloud-thickness proportional penalty v2');
  });

  test('score guide matches backend score distribution thresholds', () => {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const scoreGuide = html.slice(
      html.indexOf('methodology-score-guide'),
      html.indexOf('methodology-changelog-card')
    );

    expect(scoreGuide).toContain('85-100 分');
    expect(scoreGuide).toContain('70-84 分');
    expect(scoreGuide).toContain('40-69 分');
    expect(scoreGuide).toContain('&lt;40 分');
    expect(scoreGuide).toContain('火烧云条件偏弱；不建议专程追霞，普通日落效果需看实时天气和视野');
    expect(scoreGuide).not.toContain('普通晴天日落仍然可以看');
    expect(scoreGuide).not.toContain('60-79 分');
    expect(scoreGuide).not.toContain('40-59 分');
  });

  test('explains why firecloud map scores can differ from exact point scores', () => {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const scoreGuide = html.slice(
      html.indexOf('methodology-score-guide'),
      html.indexOf('methodology-changelog-card')
    );

    expect(scoreGuide).toContain('methodology-score-source-note');
    expect(scoreGuide).toContain('home.methodology.scoreSourceTitle');
    expect(scoreGuide).toContain('home.methodology.scoreSourceMap');
    expect(scoreGuide).toContain('home.methodology.scoreSourcePoint');
    expect(scoreGuide).toContain('home.methodology.scoreSourceWhy');
    expect(scoreGuide).toContain('为什么地图颜色和地点详情分会不同');
    expect(scoreGuide).not.toContain('地图分与精确点分为什么会不同');
  });

  test('documents the current carrier, brightness, and air scoring formula', () => {
    const zh = fs.readFileSync(path.join(ROOT, 'src/locales/zh-CN.js'), 'utf8');
    const en = fs.readFileSync(path.join(ROOT, 'src/locales/en-US.js'), 'utf8');
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

    expect(html).toContain('home.methodology.sections.finalFormula.carrier');
    expect(html).toContain('home.methodology.sections.finalFormula.lightGate');
    expect(html).toContain('home.methodology.sections.finalFormula.statusCaps');

    expect(zh).toContain('候选载体 = max(本地云层, 远端分层载体, 侧向可视云带, 气溶胶弱载体)');
    expect(zh).toContain('侧向可视云带 = 主光路通透 × 方位角衰减 × 云高/距离仰角 × 空气透射 × 云层权重');
    expect(zh).toContain('本地云层 = 区间分 + 云种修正 + 云厚修正');
    expect(zh).toContain('最终分 = clamp(Σ(分层载体 × 分层受光亮度) × 空气显色, 0, 100)');
    expect(zh).toContain('展示顺序：候选载体 → 本地云层展开 → 基础分 → 空气显色 → 最终分');
    expect(zh).toContain('气溶胶候选 {{score}}');
    expect(zh).not.toContain('画布分×1.2倍');
    expect(zh).not.toContain('透明度分 = 能见度分 + 湿度分（最高25分）');
    expect(zh).not.toContain('载体缓冲');

    expect(en).toContain('Carrier candidate = max(local cloud, remote layer carrier, visible side-sector carrier, weak aerosol carrier)');
    expect(en).toContain('Visible side-sector carrier = main-path openness × azimuth falloff × cloud-height/distance elevation × air transmission × layer weight');
    expect(en).toContain('Local cloud = range score + cloud-type adjustment + cloud-thickness adjustment');
    expect(en).toContain('Final score = clamp(Σ(layer carrier × layer brightness) × air rendering, 0, 100)');
    expect(en).not.toContain('carrier relief');
  });

  test('keeps methodology formula blocks readable across multiple lines', () => {
    const css = fs.readFileSync(path.join(ROOT, 'styles/main.css'), 'utf8');
    const formulaBlock = css.slice(
      css.indexOf('.methodology-formula'),
      css.indexOf('/* 评分表格样式 */')
    );

    expect(formulaBlock).toContain('white-space: pre-line');
    expect(formulaBlock).toContain('overflow-wrap: anywhere');
    expect(formulaBlock).toContain('word-break: normal');
    expect(formulaBlock).toContain('line-height: 1.65');
    expect(formulaBlock).toContain('text-align: center');
    expect(formulaBlock).not.toContain('white-space: nowrap');
  });

  test('uses neutral methodology changelog styling instead of highlight gradients', () => {
    const css = fs.readFileSync(path.join(ROOT, 'styles/main.css'), 'utf8');
    const cardBlock = css.slice(
      css.indexOf('.methodology-changelog-card'),
      css.indexOf('.methodology-changelog-head')
    );

    expect(css).toContain('.methodology-changelog-scroll');
    expect(css).toContain('max-height: 340px');
    expect(cardBlock).toContain('background: var(--color-card-bg)');
    expect(cardBlock).not.toContain('radial-gradient');
    expect(cardBlock).not.toContain('color-mix(in srgb, var(--color-primary');
  });
});
