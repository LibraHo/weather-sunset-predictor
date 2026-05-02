import fs from 'fs';
import path from 'path';

describe('recent user-reported UI regression guards', () => {
  const css = () => fs.readFileSync(path.resolve('styles/main.css'), 'utf8');
  const predictionController = () => fs.readFileSync(path.resolve('src/controllers/PredictionController.js'), 'utf8');
  const rasterOverlay = () => fs.readFileSync(path.resolve('src/services/ChinaRasterOverlay.js'), 'utf8');

  test('dark mode forecast cards have explicit dark backgrounds', () => {
    const source = css();
    expect(source).toContain('body.theme-dark #forecast-section .forecast-day-card');
    expect(source).toContain('body.theme-dark #forecast-section .forecast-day-column');
    expect(source).toContain('body.theme-dark #forecast-section .forecast-item');
    expect(source).toMatch(/forecast-day-card[\s\S]*rgba\(18, 28, 52, 0\.88\)/);
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
});
