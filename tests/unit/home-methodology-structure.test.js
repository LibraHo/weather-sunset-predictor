import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(process.cwd());

describe('home methodology structure', () => {
  test('puts algorithm version at the end of a scrollable changelog card', () => {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const cardStart = html.indexOf('methodology-changelog-card');
    const scrollIndex = html.indexOf('methodology-changelog-scroll', cardStart);
    const latestIndex = html.indexOf('home.methodology.changelog.latest.title', cardStart);
    const currentIndex = html.indexOf('home.methodology.changelog.current.title', cardStart);
    const versionIndex = html.indexOf('methodology-version-card', cardStart);

    expect(cardStart).toBeGreaterThan(-1);
    expect(scrollIndex).toBeGreaterThan(cardStart);
    expect(latestIndex).toBeGreaterThan(scrollIndex);
    expect(currentIndex).toBeGreaterThan(latestIndex);
    expect(versionIndex).toBeGreaterThan(currentIndex);
  });

  test('uses neutral methodology changelog styling instead of highlight gradients', () => {
    const css = fs.readFileSync(path.join(ROOT, 'styles/main.css'), 'utf8');
    const cardBlock = css.slice(
      css.indexOf('.methodology-changelog-card'),
      css.indexOf('.methodology-changelog-head')
    );

    expect(css).toContain('.methodology-changelog-scroll');
    expect(cardBlock).toContain('background: var(--color-card-bg)');
    expect(cardBlock).not.toContain('radial-gradient');
    expect(cardBlock).not.toContain('color-mix(in srgb, var(--color-primary');
  });
});
