import fs from 'fs';
import path from 'path';

describe('admin header layout', () => {
  test('admin uses a dedicated console shell instead of the foreground card topbar', () => {
    const html = fs.readFileSync(path.resolve('public/admin/index.html'), 'utf8');
    const css = fs.readFileSync(path.resolve('public/admin/admin.css'), 'utf8');

    expect(html).toContain('class="admin-shell"');
    expect(html).toContain('class="admin-sidebar"');
    expect(html).toContain('class="admin-workspace"');
    expect(css).toContain('.admin-shell');
    expect(css).toContain('grid-template-columns: 248px minmax(0, 1fr)');
    expect(css).toContain('.admin-sidebar');
    expect(css).toContain('position: sticky');
    expect(css).toContain('.admin-header');
    expect(css).toContain('border-bottom: 1px solid var(--theme-card-border');
  });

  test('admin foreground link stays reachable from the sidebar action rail', () => {
    const html = fs.readFileSync(path.resolve('public/admin/index.html'), 'utf8');

    expect(html).toContain('class="admin-sidebar-actions"');
    expect(html).toContain('class="icon-btn header-svg-btn admin-home-link"');
    expect(html).toContain('aria-label="返回前台"');
    expect(html).toContain('class="header-action-icon"');
    expect(html).not.toContain('class="btn btn-secondary btn-sm">返回前台</a>');
  });
});
