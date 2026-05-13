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
