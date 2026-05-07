import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(process.cwd());

describe('admin page structure', () => {
  test('admin uses home-style menu and separates major functions into panels', () => {
    const html = fs.readFileSync(path.join(ROOT, 'public/admin/index.html'), 'utf8');

    expect(html).toContain('header-top-row');
    expect(html).toContain('header-right-group');
    expect(html).toContain('home-view-menu');
    expect(html).toContain('id="home-view-menu-btn"');
    expect(html).toContain('id="home-view-menu-dropdown"');
    expect(html).toContain('admin-view-option');
    expect(html).not.toContain('admin-header');
    expect(html).not.toContain('admin-view-menu');

    ['dashboard', 'ops', 'logs', 'schedule', 'agent', 'photos'].forEach((view) => {
      expect(html).toContain(`data-admin-panel="${view}"`);
      expect(html).toContain(`data-view="${view}"`);
    });

    expect(html).toContain('admin-entry-grid');
    expect(html).toContain('id="kpi-share-today"');
    expect(html).toContain('id="kpi-share-total"');
  });

  test('dangerous operations live in ops panel, not dashboard', () => {
    const html = fs.readFileSync(path.join(ROOT, 'public/admin/index.html'), 'utf8');
    const opsStart = html.indexOf('id="admin-panel-ops"');
    const logsStart = html.indexOf('id="admin-panel-logs"');
    const opsHtml = html.slice(opsStart, logsStart);

    expect(opsHtml).toContain('danger-zone');
    expect(opsHtml).toContain('clearGridCache');
    expect(opsHtml).toContain('restartBackend');
  });
});
