import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(process.cwd());
const CJK = /[\u4e00-\u9fff]/;
const AUDIT_PATH = path.join(ROOT, 'docs/i18n-dynamic-copy-audit.md');
const SCOPES = ['src/controllers', 'src/components', 'src/services', 'src/utils'];

function walkJs(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir)) {
    const p = path.join(dir, entry);
    const stat = fs.statSync(p);
    if (stat.isDirectory()) {
      walkJs(p, out);
    } else if (p.endsWith('.js')) {
      out.push(p);
    }
  }
  return out;
}

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^\\])\/\/.*$/gm, '$1');
}

describe('requirement 47.3 dynamic copy audit', () => {
  test('dynamic source files with CJK are tracked by the audit inventory', () => {
    const audit = fs.readFileSync(AUDIT_PATH, 'utf8');
    const filesWithCjk = SCOPES
      .flatMap((scope) => walkJs(path.join(ROOT, scope)))
      .filter((file) => CJK.test(stripComments(fs.readFileSync(file, 'utf8'))))
      .map((file) => path.relative(ROOT, file).replace(/\\/g, '/'))
      .sort();

    expect(filesWithCjk).toEqual([
      'src/components/ChinaMapCanvas.js',
      'src/components/LanguageSelector.js',
      'src/components/RadarCompass.js',
      'src/components/SettingsPanel.js',
      'src/controllers/AppController.js',
      'src/controllers/ChartRenderController.js',
      'src/controllers/FavoriteController.js',
      'src/controllers/PredictionController.js',
      'src/controllers/WeatherController.js',
      'src/services/BackendGeocodingService.js',
      'src/services/ChinaRasterOverlay.js',
      'src/services/ChinaRasterOverlayManager.js',
      'src/services/ChinaSpotsOverlay.js',
      'src/services/ChinaSpotsOverlayManager.js',
      'src/services/ConfigService.js',
      'src/services/EnhancedSunsetPredictionService.js',
      'src/services/FireCloudOverlayService.js',
      'src/services/GeocodingService.js',
      'src/services/GeocodingServiceFactory.js',
      'src/services/HeatmapLayer.js',
      'src/services/MockGeocodingService.js',
      'src/services/MockWindyAPIService.js',
      'src/services/MockWindyMapService.js',
      'src/services/NativeFireCloudRenderer.js',
      'src/services/NotificationService.js',
      'src/services/PredictionAPIService.js',
      'src/services/RadarChartService.js',
      'src/services/ShareCardGenerator.js',
      'src/services/StorageService.js',
      'src/services/SunsetPredictionService.js',
      'src/services/SurroundingPointsService.js',
      'src/services/ThemeService.js',
      'src/services/ToastService.js',
      'src/services/WindyAPIService.js',
      'src/services/WindyMapService.js',
      'src/utils/ErrorHandler.js',
      'src/utils/GlobalErrorBoundary.js',
      'src/utils/LocationName.js',
      'src/utils/QualityLevels.js',
    ]);

    for (const rel of filesWithCjk) {
      expect(audit).toContain(path.basename(rel));
    }
    expect(audit).toContain('Decision / follow-up');
    expect(audit).toContain('47.4–47.8');
  });
});
