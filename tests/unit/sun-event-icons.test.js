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
    expect(source).not.toMatch(SUN_EVENT_EMOJI);
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
