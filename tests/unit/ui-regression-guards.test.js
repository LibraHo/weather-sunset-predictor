import fs from 'fs';
import path from 'path';

describe('recent user-reported UI regression guards', () => {
  const css = () => fs.readFileSync(path.resolve('styles/main.css'), 'utf8');
  const predictionController = () => fs.readFileSync(path.resolve('src/controllers/PredictionController.js'), 'utf8');
  const rasterOverlay = () => fs.readFileSync(path.resolve('src/services/ChinaRasterOverlay.js'), 'utf8');
  const html = () => fs.readFileSync(path.resolve('index.html'), 'utf8');

  test('dark mode forecast cards have explicit dark backgrounds', () => {
    const source = css();
    expect(source).toContain('body.theme-dark #forecast-section .forecast-day-card');
    expect(source).toContain('body.theme-dark #forecast-section .forecast-day-column');
    expect(source).toContain('body.theme-dark #forecast-section .forecast-item');
    expect(source).toContain('body.theme-dark #three-day-glow .forecast-day-card');
    expect(source).toMatch(/forecast-day-card[\s\S]*rgba\(18, 28, 52, 0\.88\)/);
  });

  test('7-day weather and cloud-condition cards use Xiake glass backgrounds in light and dark themes', () => {
    const source = css();
    const xiakeFixBlock = source.match(/\/\* UI regression: 7-day weather and cloud-condition panels follow Xiake glass language\. \*\/[\s\S]*$/)?.[0] || '';
    const dayCardBlock = xiakeFixBlock.match(/\.day-card,\n#forecast-section \.forecast-day-card,[\s\S]*?\n\}/)?.[0] || '';
    const cloudBlock = xiakeFixBlock.match(/\.cloud-condition-card,\n\.fire-cloud-details,[\s\S]*?\n\}/)?.[0] || '';
    const darkDayBlock = xiakeFixBlock.match(/body\.theme-dark \.day-card,[\s\S]*?\n\}/)?.[0] || '';
    const darkCloudBlock = xiakeFixBlock.match(/body\.theme-dark \.cloud-condition-card,[\s\S]*?\n\}/)?.[0] || '';

    expect(dayCardBlock).toContain('var(--theme-card-bg)');
    expect(dayCardBlock).toContain('var(--theme-accent-soft)');
    expect(dayCardBlock).toContain('backdrop-filter: blur(var(--glass-blur))');
    expect(cloudBlock).toContain('var(--theme-card-bg)');
    expect(cloudBlock).toContain('var(--theme-accent-soft)');
    expect(source).toContain('.cloud-condition-track {\n  background: var(--cloud-track-color) !important;');
    expect(darkDayBlock).toContain('rgba(18, 28, 52, 0.82)');
    expect(darkCloudBlock).toContain('rgba(18, 28, 52, 0.80)');
    expect(xiakeFixBlock).toContain('@media (prefers-color-scheme: dark)');
    expect(xiakeFixBlock).toContain('#weather-section #weekly-cards.weekly-cards-container .day-card');
    expect(xiakeFixBlock).toContain('Mobile weather weekly rows must use the same night-sky glass layer as the weather panel.');
    expect(xiakeFixBlock).toContain('rgba(18, 28, 52, 0.72)');
    expect(xiakeFixBlock).toContain('color-mix(in srgb, var(--theme-accent) 72%, transparent)');

    expect(dayCardBlock).not.toMatch(/background(?:-color)?:\s*(?:#fff\b|#ffffff\b|#f5f5f5\b|var\(--color-bg\))/i);
    expect(cloudBlock).not.toMatch(/background(?:-color)?:\s*(?:#fff\b|#ffffff\b|#f5f5f5\b|#e5e7eb\b|var\(--color-bg\))/i);
  });

  test('dark weather metric cards use neutral Xiake glass borders', () => {
    const source = css();
    const tokenBlock = source.match(/\/\* 暗色实际主题兜底：评分条 token 不能被亮色\/默认规则覆盖成黑灰 \*\/[\s\S]*?\n\}/)?.[0] || '';
    const metricBlock = source.match(/\/\* Dark weather metric cards use the same neutral Xiake glass border as the rest of the panel\. \*\/[\s\S]*?body\[data-actual-theme="dark"\] \.weather-feature-item \{[\s\S]*?\n\}/)?.[0] || '';
    const metricHoverBlock = source.match(/body\[data-actual-theme="dark"\] \.weather-feature-item:hover \{[\s\S]*?\n\}/)?.[0] || '';

    expect(tokenBlock).toContain('--theme-card-border: rgba(255, 255, 255, 0.10);');
    expect(tokenBlock).toContain('--weather-metric-border: var(--theme-card-border);');
    expect(metricBlock).toContain('html[data-theme="dark"] .weather-feature-item');
    expect(metricBlock).toContain('html[data-actual-theme="dark"] .weather-feature-item');
    expect(metricBlock).toContain('border-color: var(--weather-metric-border) !important;');
    expect(metricBlock).toContain('box-shadow: var(--weather-metric-shadow) !important;');
    expect(metricBlock).not.toContain('var(--theme-accent)');
    expect(metricHoverBlock).toContain('var(--weather-metric-border)');
    expect(metricHoverBlock).not.toContain('var(--theme-accent)');
  });

  test('3-day glow forecast is a weather tab with a loading state', () => {
    const page = html();
    const source = css();
    const desktopGridBlock = source.match(/#three-day-glow \.forecast-horizontal-container \{[\s\S]*?\n\}/)?.[0] || '';
    const mobileBlock = source.match(/@media \(max-width: 768px\) \{[\s\S]*?#three-day-glow \.forecast-horizontal-container \{[\s\S]*?\n  \}[\s\S]*?\n\}/)?.[0] || '';

    expect(page).toContain('id="three-day-glow-btn"');
    expect(page).toContain('data-i18n="weather.threeDayGlow"');
    expect(page).toContain('id="forecast-loading"');
    expect(page).not.toContain('id="forecast-section" class="card hidden"');
    expect(source).toContain('.three-day-glow-loading');
    expect(source).toContain('#three-day-glow #forecast-timeline');
    expect(source).toMatch(/#three-day-glow #forecast-timeline \{[\s\S]*?width: 100%/);
    expect(desktopGridBlock).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))');
    expect(mobileBlock).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))');
    expect(mobileBlock).toContain('justify-content: center');
    expect(mobileBlock).toContain('margin-left: auto !important');
    expect(mobileBlock).toContain('#three-day-glow .fcard-row-label');
    expect(mobileBlock).toContain('display: none');
    expect(source).toContain('.weather-view-toggle.xiake-toggle');
  });

  test('radar compass loading uses the shared progress bar treatment', () => {
    const source = css();
    const controller = fs.readFileSync(path.resolve('src/controllers/WeatherController.js'), 'utf8');

    expect(controller).toContain('radar-compass-loading-progress');
    expect(controller).toContain('radar-compass-progress-fill');
    expect(source).toContain('.radar-compass-loading-progress');
    expect(source).toContain('.radar-compass-progress-fill');
    expect(source).toMatch(/\.radar-compass-progress-fill \{[\s\S]*?animation: xiake-loading-progress/);
  });

  test('compact cloud labels are allowed to wrap and do not force ellipsis', () => {
    const source = css();
    const compactBlock = source.match(/\.compact-cloud-info \{[\s\S]*?\n\}/)?.[0] || '';
    const labelBlock = source.match(/\.cloud-label \{[\s\S]*?\n\}/)?.[0] || '';
    const controller = predictionController();

    expect(compactBlock).toContain('flex-wrap: wrap');
    expect(labelBlock).not.toContain('text-overflow: ellipsis');
    expect(controller).not.toContain('style="flex:1 1 0;min-width:0;" title="${highLabel}"');
  });

  test('firecloud raster full mode starts coloring at 30 and compact at 40', () => {
    const source = rasterOverlay();
    expect(source).toContain('const FULL_VISUAL_MIN_SCORE = 30');
    expect(source).toContain('const COMPACT_VISUAL_MIN_SCORE = 40');
    expect(source).toContain('mode === RASTER_COLOR_MODES.FULL ? FULL_VISUAL_MIN_SCORE : COMPACT_VISUAL_MIN_SCORE');
  });

  test('front header and footer use the same card width language as other panels', () => {
    const source = css();
    const headerBlock = source.match(/header \{[\s\S]*?\n\}/)?.[0] || '';
    const rowBlock = source.match(/\.header-top-row \{[\s\S]*?\n\}/)?.[0] || '';
    const footerBlock = source.match(/footer \{[\s\S]*?\n\}/)?.[0] || '';

    expect(headerBlock).toContain('width: auto');
    expect(headerBlock).toContain('margin: 0 var(--spacing-md) 16px');
    expect(headerBlock).toContain('border-radius: var(--radius-lg)');
    expect(headerBlock).not.toContain('width: 100vw');
    expect(headerBlock).not.toContain('margin-left: calc(50% - 50vw)');
    expect(rowBlock).toContain('width: 100%');
    expect(rowBlock).toContain('margin: 0');
    expect(footerBlock).toContain('width: auto');
    expect(footerBlock).toContain('margin: 0 var(--spacing-md)');
    expect(footerBlock).toContain('border-radius: var(--radius-lg)');
    expect(footerBlock).not.toContain('width: 100vw');
    expect(footerBlock).not.toContain('margin-left: calc(50% - 50vw)');
  });

  test('firecloud map period switch uses xiake segmented toggle styling', () => {
    const page = html();
    const source = css();
    const tabsMarkup = page.match(/id="china-spots-tabs-container"[\s\S]*?<\/div>/)?.[0] || '';

    expect(tabsMarkup).toContain('xiake-toggle');
    expect(tabsMarkup).toContain('xiake-toggle-btn');
    expect(source).not.toContain('border: 1px solid rgba(255, 120, 0, 0.5)');
    expect(source).not.toContain('background: rgba(0, 0, 0, 0.4)');
  });

  test('dark mode share icon uses muted night color instead of orange accent', () => {
    const source = css();
    const darkThemeBlocks = source.match(/body\.theme-dark \{[\s\S]*?\n\}/g) || [];
    const themeTokenBlock = darkThemeBlocks.find((block) => block.includes('--theme-share-icon')) || '';
    const shareButtonBlocks = source.match(/\.prediction-nav-share,\n\.prediction-share-btn \{[\s\S]*?\n\}/g) || [];
    const shareButtonBlock = shareButtonBlocks.find((block) => block.includes('--theme-share-icon')) || '';

    expect(themeTokenBlock).toContain('--theme-share-icon: rgba(255, 255, 255, 0.78)');
    expect(themeTokenBlock).toContain('--theme-share-border: rgba(255, 255, 255, 0.14)');
    expect(shareButtonBlock).toContain('color: var(--theme-share-icon) !important');
    expect(shareButtonBlock).not.toContain('color: var(--theme-accent) !important');
  });

  test('score breakdown popover keeps translucent glass effect', () => {
    const source = css();
    const block = source.match(/\.score-breakdown-popover,\nbody\.theme-light \.score-breakdown-popover,[\s\S]*?\n\}/)?.[0] || '';

    expect(block).toContain('color-mix(in srgb, var(--glass-bg-heavy) 72%, transparent)');
    expect(block).toContain('backdrop-filter: blur(var(--glass-blur-heavy)) saturate(1.24)');
    expect(block).toContain('inset 0 1px 0 rgba(255, 255, 255, 0.30)');
    expect(source).toContain('@media (min-width: 641px)');
    expect(source).toContain('color-mix(in srgb, var(--glass-bg-heavy) 42%, transparent)');
    expect(source).toContain('radial-gradient(circle at 16% 0%, rgba(255, 224, 178, 0.32), transparent 38%)');
    expect(source).toContain('.score-breakdown-popover::before');
    expect(block).not.toContain('background: var(--glass-bg-heavy) !important');
  });

  test('mobile prediction card children cannot widen the card', () => {
    const source = css();
    const radarSource = fs.readFileSync(path.resolve('src/components/RadarCompass.js'), 'utf8');
    const guardBlock = source.match(/\/\* 2026-05-10: narrow phones must not let prediction-card content widen the card\. \*\/[\s\S]*$/)?.[0] || '';

    expect(guardBlock).toContain('.prediction-app-shell > *');
    expect(guardBlock).toContain('min-width: 0');
    expect(guardBlock).toContain('max-width: 100%');
    expect(guardBlock).toContain('.prediction-app-nav-compact');
    expect(guardBlock).toContain('width: 100%');
    expect(guardBlock).toContain('.conclusion-banner > strong');
    expect(guardBlock).toContain('overflow-wrap: anywhere');
    expect(radarSource).toContain('width:min(${S}px,100%)');
    expect(radarSource).toContain('aspect-ratio:1 / 1');
    expect(radarSource).toContain('width:100%;height:100%;display:block;');
    expect(radarSource).toContain('const labelR = R_HIGH * 1.08;');
    expect(radarSource).toContain('margin:8px auto 0');
  });
});

describe('prediction title plate regression guards', () => {
  test('main prediction title plate stays transparent in dark mode too', () => {
    const source = fs.readFileSync(path.resolve('styles/main.css'), 'utf8');
    const titlePlateBlock = source.match(/\.prediction-app-card \.phenomenon-title-card,[\s\S]*?\n\}/)?.[0] || '';

    expect(titlePlateBlock).toContain('body.theme-dark .prediction-app-card .phenomenon-title-card');
    expect(titlePlateBlock).toContain('html[data-theme="dark"] .prediction-app-card .phenomenon-title-card');
    expect(titlePlateBlock).toContain('background: transparent !important');
    expect(titlePlateBlock).toContain('box-shadow: none !important');
  });
});

describe('prediction paired-card alignment guards', () => {
  test('desktop prediction cards use generic paired row sync instead of one-off fixed heights', () => {
    const source = fs.readFileSync(path.resolve('src/controllers/PredictionController.js'), 'utf8');

    expect(source).toContain('syncPairedPredictionCardRows');
    expect(source).toContain('getPredictionAlignmentSelectors');
    expect(source).toContain('.phenomenon-title-card');
    expect(source).toContain('.conclusion-banner');
    expect(source).toContain('.score-summary-card');
    expect(source).toContain('.cloud-condition-card');
    expect(source).toContain('.app-analysis-card');
    expect(source).toContain('getBoundingClientRect().height');
    expect(source).toContain('element.style.minHeight');
    expect(source).toContain("matchMedia?.('(min-width: 641px)')");
  });
});
