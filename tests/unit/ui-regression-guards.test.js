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
    expect(mobileBlock).toContain('grid-template-columns: 1fr');
    expect(source).toContain('.weather-view-toggle.xiake-toggle');
    expect(source).toContain('overflow-x: auto');
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
});
