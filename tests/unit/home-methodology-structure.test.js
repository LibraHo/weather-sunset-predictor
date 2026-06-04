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

  test('shows the current sunset scoring v2 in version history', () => {
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

    expect(html).toContain('2026-06-03');
    expect(html).toContain('2026.06.03-sunset-scoring-v2');
    expect(html).toContain('日落评分 v2');
    expect(html).toContain('云载体 × 日落光路 × 空气显色');
    expect(html).toContain('轻/中度气溶胶可增强橙红散射');
    expect(html).toContain('云厚比例折损 v2');
    expect(html).toContain('画布修正前分 × 30% × 云厚压力');
    expect(html).toContain('去掉固定 -28/24 上限');

    const coreLocaleTexts = localeFiles
      .filter(file => ['zh-CN.js', 'zh-TW.js', 'en-US.js'].includes(file))
      .map(file => fs.readFileSync(path.join(ROOT, 'src/locales', file), 'utf8'))
      .join('\n');

    expect(coreLocaleTexts).toContain('2026.06.03-sunset-scoring-v2');
    expect(coreLocaleTexts).toContain('Sunset scoring v2');
    expect(coreLocaleTexts).toContain('cloud carrier, sunset path, and air rendering');
    expect(localeTexts.join('\n')).toContain('2026-05-27');
    expect(localeTexts.join('\n')).toContain('Cloud-thickness proportional penalty v2');
    expect(localeTexts.join('\n')).toContain('pre-thickness canvas score × 30% × thickness pressure');
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

  test('documents the current additive carrier and light gate scoring formula', () => {
    const zh = fs.readFileSync(path.join(ROOT, 'src/locales/zh-CN.js'), 'utf8');
    const en = fs.readFileSync(path.join(ROOT, 'src/locales/en-US.js'), 'utf8');
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

    expect(html).toContain('home.methodology.sections.finalFormula.carrier');
    expect(html).toContain('home.methodology.sections.finalFormula.lightGate');
    expect(html).toContain('home.methodology.sections.finalFormula.statusCaps');

    expect(zh).toContain('中高云画布量 = 高云×0.75 + 中云×0.45');
    expect(zh).toContain('光路门控 = 0.25–1.12');
    expect(zh).toContain('最终分 = clamp(云载体 × 日落光路 × 空气显色, 0, 100)');
    expect(zh).toContain('降水影响 = 光路封顶 + 弱载体禁用 + 渲染因子修正');
    expect(zh).not.toContain('画布分×1.2倍');
    expect(zh).not.toContain('透明度分 = 能见度分 + 湿度分（最高25分）');

    expect(en).toContain('Upper-cloud canvas = high×0.75 + mid×0.45');
    expect(en).toContain('Light-path gate = 0.25-1.12');
    expect(en).toContain('Final score = clamp(cloud carrier × sunset path × air rendering, 0, 100)');
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
