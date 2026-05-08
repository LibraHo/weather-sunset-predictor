import fs from 'fs';
import path from 'path';

const adminHtml = fs.readFileSync(path.resolve(process.cwd(), 'public/admin/index.html'), 'utf8');
const adminRoutes = fs.readFileSync(path.resolve(process.cwd(), 'server/routes/admin.js'), 'utf8');
const serverIndex = fs.readFileSync(path.resolve(process.cwd(), 'server/index.js'), 'utf8');

describe('admin cache policy', () => {
  test('admin HTML opts out of browser cache for mobile browsers', () => {
    expect(adminHtml).toContain('http-equiv="Cache-Control"');
    expect(adminHtml).toContain('no-store, no-cache, must-revalidate');
    expect(adminHtml).toContain('http-equiv="Pragma"');
    expect(adminHtml).toContain('http-equiv="Expires"');
  });

  test('admin route sends no-store headers so /admin does not reopen an old console', () => {
    expect(adminRoutes).toContain("res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')");
    expect(adminRoutes).toContain("res.set('Pragma', 'no-cache')");
    expect(adminRoutes).toContain("res.set('Expires', '0')");
  });

  test('admin JS/CSS assets are served before generic public static cache and use no-store', () => {
    const adminStaticIndex = serverIndex.indexOf("app.use('/admin', express.static");
    const publicStaticIndex = serverIndex.indexOf("app.use(express.static(path.join(__dirname, '../public')");

    expect(adminStaticIndex).toBeGreaterThan(-1);
    expect(publicStaticIndex).toBeGreaterThan(-1);
    expect(adminStaticIndex).toBeLessThan(publicStaticIndex);
    expect(serverIndex).toContain("path.join(__dirname, '../public/admin')");
    expect(serverIndex).toContain("res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')");
  });
});
