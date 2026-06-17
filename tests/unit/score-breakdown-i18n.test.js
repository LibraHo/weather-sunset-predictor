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
    score: 35,
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
      reason: 'overcast_low_visibility_cap_35',
      score: 35
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
    expect(html).toContain('受光輝度');
    expect(html).toContain('空気の発色');
    expect(html).toContain('最終スコア');
    expect(html).toContain('雲量が非常に多く視程も低いため、スコアを保守的に下げています');

    expect(html).not.toContain('score-ledger-score-block');
    expect(html).not.toContain('score-ledger-context');
    expect(html).not.toContain('視程 4km');
    expect(html).not.toContain('Why this score');
    expect(html).not.toContain('Cloud carrier');
    expect(html).not.toContain('Layer brightness');
    expect(html).not.toContain('Rendering');
    expect(html).not.toContain('Visibility 4km');
  });

  test('Chinese score detail ledger keeps carrier evidence concise', () => {
    i18n.currentLanguage = 'zh-CN';
    const controller = new PredictionController(mockStorageService);
    const prediction = {
      ...makePrediction(),
      cloudThickness: {
        thickness: 'thick',
        reasons: ['low_solar_transmission'],
        evidence: {
          pressure: 1,
          diffuseRatio: 1,
          waterIndex: 35.1,
          carrierRelief: 0
        }
      },
      canvasAnalysis: {
        ...makePrediction().canvasAnalysis,
        cloudThicknessAdjustment: {
          adjustment: -18,
          pressure: 1,
          baseScore: 60,
          maxPenalty: 18
        }
      }
    };

    const html = controller.renderScoreBreakdownPopover(prediction);

    expect(html).toContain('候选载体');
    expect(html).toContain('本地云层');
    expect(html).toContain('采用 云层载体');
    expect(html).not.toContain('{{cloud}}');
    expect(html).not.toContain('低太阳透射');
    expect(html).not.toContain('载体缓冲');
    expect(html).not.toContain('low solar transmission hit');
  });
});
