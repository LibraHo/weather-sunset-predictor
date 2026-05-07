import fs from 'fs';
import path from 'path';

describe('desktop weekly weather cards', () => {
  test('desktop 7-day cards use larger vertical four-line layout', () => {
    const source = fs.readFileSync(path.resolve('styles/main.css'), 'utf8');
    const desktopBlock = source.match(/\/\* Desktop 7-day forecast cards:[\s\S]*$/)?.[0] || '';

    expect(desktopBlock).toContain('@media (min-width: 900px)');
    expect(desktopBlock).toContain('min-height: 154px');
    expect(desktopBlock).toContain('font-size: 1.04rem !important');
    expect(desktopBlock).toContain('font-size: 2.05rem !important');
    expect(desktopBlock).toContain('font-size: 1.08rem !important');
    expect(desktopBlock).toContain('.day-meta-precip');
    expect(desktopBlock).not.toContain('.day-meta-humidity');
    expect(desktopBlock).toContain('font-size: 0.9rem !important');
  });

  test('weekly card markup includes precipitation row before wind row', () => {
    const source = fs.readFileSync(path.resolve('src/controllers/WeatherController.js'), 'utf8');
    const precipIndex = source.indexOf('day-meta-chip day-meta-precip');
    const windIndex = source.indexOf('day-meta-chip day-meta-wind');

    expect(source).toContain('const precipProb');
    expect(source).toContain('weather-icon-svg');
    expect(source).not.toMatch(/[🌧️☁️⛅☀️]/u);
    expect(source).not.toContain('day-meta-chip day-meta-humidity');
    expect(source).not.toContain('const avgHumidity');
    expect(precipIndex).toBeGreaterThan(0);
    expect(windIndex).toBeGreaterThan(precipIndex);
  });
});
