import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(process.cwd());

describe('admin page structure', () => {
  test('admin uses home-style menu and separates major functions into panels', () => {
    const html = fs.readFileSync(path.join(ROOT, 'public/admin/index.html'), 'utf8');

    expect(html).toContain('home-view-menu');
    expect(html).toContain('admin-view-option');

    ['dashboard', 'ops', 'logs', 'schedule', 'agent', 'photos'].forEach((view) => {
      expect(html).toContain(`data-admin-panel="${view}"`);
      expect(html).toContain(`data-view="${view}"`);
    });
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
