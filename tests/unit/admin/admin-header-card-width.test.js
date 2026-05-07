import fs from 'fs';
import path from 'path';

describe('admin header layout', () => {
  test('admin header uses card-width panel styling instead of full-bleed bar', () => {
    const source = fs.readFileSync(path.resolve('public/admin/admin.css'), 'utf8');
    const block = source.match(/\.admin-header \{[\s\S]*?\n\}/)?.[0] || '';

    expect(block).toContain('max-width: 1400px');
    expect(block).toContain('margin: var(--spacing-lg) auto 0');
    expect(block).toContain('border: 1px solid var(--header-border)');
    expect(block).toContain('border-radius: var(--radius-lg)');
    expect(block).not.toContain('border-bottom');
    expect(block).not.toContain('width: 100vw');
  });
});
