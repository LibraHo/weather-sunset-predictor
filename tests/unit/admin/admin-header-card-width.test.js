import fs from 'fs';
import path from 'path';

describe('admin header layout', () => {
  test('admin header uses the same card topbar treatment as the foreground app', () => {
    const html = fs.readFileSync(path.resolve('public/admin/index.html'), 'utf8');
    const css = fs.readFileSync(path.resolve('public/admin/admin.css'), 'utf8');
    const block = css.match(/\.admin-header \{[\s\S]*?\n\}/)?.[0] || '';

    expect(html).toContain('<header class="admin-header">');
    expect(block).toContain('max-width: 1400px');
    expect(block).toContain('margin: 0 auto 16px');
    expect(block).toContain('padding: var(--spacing-lg)');
    expect(block).toContain('background: linear-gradient(120deg, var(--header-surface)');
    expect(block).toContain('border: 1px solid var(--header-border)');
    expect(block).toContain('border-radius: var(--radius-lg)');
    expect(block).not.toContain('border-bottom');
    expect(block).not.toContain('width: 100vw');
  });

  test('admin foreground link follows header icon button shape', () => {
    const html = fs.readFileSync(path.resolve('public/admin/index.html'), 'utf8');

    expect(html).toContain('class="icon-btn header-svg-btn admin-home-link"');
    expect(html).toContain('aria-label="返回前台"');
    expect(html).toContain('class="header-action-icon"');
    expect(html).not.toContain('class="btn btn-secondary btn-sm">返回前台</a>');
  });
});
