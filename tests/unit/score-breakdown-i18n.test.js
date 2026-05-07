import PredictionController from '../../src/controllers/PredictionController.js';
import i18n from '../../src/i18n.js';
import jaJP from '../../src/locales/ja-JP.js';
import enUS from '../../src/locales/en-US.js';
import zhCN from '../../src/locales/zh-CN.js';

const mockStorageService = {
  getAPIKey: () => 'test-api-key',
  getCachedWeatherData: () => null,
  setCachedWeatherData: () => {},
  getRecentSearches: () => [],
  addRecentSearch: () => {},
  clearRecentSearches: () => {},
  getFavorites: () => [],
  addFavorite: () => {},
  removeFavorite: () => {},
  isFavorite: () => false,
  getNotificationSettings: () => ({ enabled: false }),
  setNotificationSettings: () => {}
};

function makePrediction() {
  return {
    score: 15,
    factors: {
      visibility: { value: 4 },
      humidity: { value: 88 },
      precipitation: { value: 0.4 }
    },
    canvasAnalysis: {
      score: 22,
      lowCloudPenalty: 0.55,
      overcastPenalty: 0.6,
      breakdown: { highClouds: 40, midClouds: 30, lowClouds: 85 }
    },
    lightPathAnalysis: { score: 8 },
    renderingAnalysis: {
      factor: 0.62,
      visibilityFactor: 0.45,
      humidityFactor: 0.8,
      aerosolFactor: 0.9
    },
    breakdown: {
      baseScore: 19.2,
      unclampedFinalScore: 11.9,
      aerosolScattering: { factor: 0.9 }
    },
    severeWeatherCap: {
      reason: 'overcast_fog_cap_15',
      score: 15
    }
  };
}

describe('score breakdown i18n', () => {
  beforeEach(() => {
    i18n.currentLanguage = 'ja-JP';
    i18n.translations = {
      'ja-JP': jaJP,
      'en-US': enUS,
      'zh-CN': zhCN
    };
  });

  test('Japanese score detail ledger uses Japanese strings instead of English fallback', () => {
    const controller = new PredictionController(mockStorageService);
    const html = controller.renderScoreBreakdownPopover(makePrediction());

    expect(html).toContain('このスコアの理由');
    expect(html).toContain('雲の載体');
    expect(html).toContain('光路');
    expect(html).toContain('発色補正');
    expect(html).toContain('最終スコア');
    expect(html).toContain('視程 4km');
    expect(html).toContain('曇天かつ視程5km以下のためスコア上限は15');

    expect(html).not.toContain('Why this score');
    expect(html).not.toContain('Cloud carrier');
    expect(html).not.toContain('Rendering');
    expect(html).not.toContain('Visibility 4km');
  });
});
