import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(process.cwd());
const CJK = /[\u4e00-\u9fff]/;
const AUDIT_PATH = path.join(ROOT, 'docs/i18n-static-pages-audit.md');

function walkHtml(dir, out = []) {
  for (const entry of fs.readdirSync(dir)) {
    const p = path.join(dir, entry);
    const rel = path.relative(ROOT, p).replace(/\\/g, '/');
    if (rel.includes('/node_modules/')) continue;
    const stat = fs.statSync(p);
    if (stat.isDirectory()) {
      walkHtml(p, out);
    } else if (p.endsWith('.html')) {
      out.push(p);
    }
  }
  return out;
}

function stripNonVisible(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[^]*?-->/g, '');
}

describe('requirement 47.2 static page i18n audit', () => {
  test('every static HTML page with CJK visible text is listed in the audit with a decision', () => {
    const audit = fs.readFileSync(AUDIT_PATH, 'utf8');
    const htmlFiles = [path.join(ROOT, 'index.html'), ...walkHtml(path.join(ROOT, 'public'))];
    const pagesWithCjk = htmlFiles
      .filter((file) => CJK.test(stripNonVisible(fs.readFileSync(file, 'utf8'))))
      .map((file) => path.relative(ROOT, file).replace(/\\/g, '/'))
      .sort();

    expect(pagesWithCjk).toEqual([
      'index.html',
      'public/admin/index.html',
      'public/api-apply.html',
      'public/gallery.html',
      'public/raster-debug.html'
    ]);

    for (const rel of pagesWithCjk) {
      expect(audit).toContain(`\`${rel}\``);
    }

    expect(audit).toContain('Decision / reason');
    expect(audit).toContain('47.4–47.8');
  });
});
