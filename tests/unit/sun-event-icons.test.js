import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const SUN_EVENT_EMOJI = new RegExp('[\\u{1F304}\\u{1F305}\\u{1F307}]', 'u');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

describe('sunrise/sunset icons', () => {
  test('prediction UI uses custom SVG sun event icons', () => {
    const source = read('src/controllers/PredictionController.js');
    expect(source).toContain('renderSunEventIcon');
    expect(source).toContain('sun-event-sun');
    expect(source).toContain('sun-event-arrow');
    expect(source).toContain('viewBox="0 0 40 32"');
    expect(source).toContain('d="M30 20V7');
    expect(source).toContain('d="M30 6v13');
    expect(source).not.toMatch(SUN_EVENT_EMOJI);
  });

  test('forecast sun event icons are sized for legibility', () => {
    const source = read('styles/main.css');
    const rowIcon = source.match(/#forecast-section \.fcard-row-icon \{[\s\S]*?\n\}/)?.[0] || '';
    const forecastIcon = source.match(/\.fcard-sun-event-icon \{[\s\S]*?\n\}/)?.[0] || '';

    expect(rowIcon).toContain('width: 1.75rem');
    expect(rowIcon).toContain('height: 1.4rem');
    expect(forecastIcon).toContain('width: 1.65rem');
    expect(forecastIcon).toContain('height: 1.35rem');
  });

  test('radar compass and map tab fallbacks do not use sunrise/sunset emoji', () => {
    [
      'src/components/RadarCompass.js',
      'src/services/ChinaRasterOverlayManager.js',
      'src/services/ChinaSpotsOverlayManager.js',
      'src/services/ChinaSpotsOverlay.js'
    ].forEach((file) => {
      expect(read(file)).not.toMatch(SUN_EVENT_EMOJI);
    });
  });

  test('localized light path labels do not prefix sunset emoji', () => {
    fs.readdirSync(path.join(ROOT, 'src/locales'))
      .filter((name) => name.endsWith('.js'))
      .forEach((name) => {
        expect(read(`src/locales/${name}`)).not.toMatch(SUN_EVENT_EMOJI);
      });
  });
});
