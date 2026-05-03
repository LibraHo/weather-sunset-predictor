import fs from 'fs';
import path from 'path';

const css = fs.readFileSync(path.join(process.cwd(), 'styles/main.css'), 'utf8');

describe('requirement 46.5 prediction card visual fit guards', () => {
  test('analysis module keeps Xiake glass/sunset token styling instead of hard-coded concept colors', () => {
    expect(css).toContain('需求46.5');
    expect(css).toContain('var(--glass-bg-heavy');
    expect(css).toContain('var(--glass-border');
    expect(css).toContain('var(--sunset-time-text');
    expect(css).toContain('var(--sunset-time-border');
  });

  test('analysis metric grid has mobile overflow safeguards', () => {
    expect(css).toContain('.analysis-metric-grid {');
    expect(css).toContain('max-width: 100%');
    expect(css).toContain('overflow: hidden');
    expect(css).toContain('overflow-wrap: anywhere');
    expect(css).toContain('@media (max-width: 340px)');
    expect(css).toContain('.analysis-metric-grid { grid-template-columns: 1fr; }');
  });
});
