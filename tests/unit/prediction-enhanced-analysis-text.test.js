import PredictionController from '../../src/controllers/PredictionController.js';

const mockStorageService = {
  getCachedWeatherData: () => null,
  cacheWeatherData: () => {},
  getAPIKey: () => null,
  saveAPIKey: () => {}
};

const makeI18n = () => ({
  t: (key, params = {}) => {
    const dict = {
      'prediction.canvas.canvasScore': `📊 画布: ${params.score}分 | ${params.level}`,
      'prediction.canvas.cloudBreakdown': `高云${params.high}% 中云${params.mid}% 低云${params.low}%`,
      'prediction.lightPath.lightPathScore': `🌅 光路: ${params.score}分`,
      'prediction.rendering.renderingFactor': `🎨 渲染系数: ${params.factor} | ${params.visibility} | ${params.aqi} | ${params.color}`,
      'prediction.rendering.visibilityExcellent': '极佳（>20km）',
      'prediction.rendering.visibilityGood': '良好（10-20km）',
      'prediction.rendering.visibilityPoor': '较差（<10km）',
      'prediction.rendering.aqiExcellent': '优',
      'prediction.rendering.aqiGood': '良',
      'prediction.rendering.aqiPoor': '差',
      'prediction.rendering.colorGoldenOrange': '金黄、亮橙色',
      'prediction.rendering.colorReddishPurplish': '偏红、紫红色',
      'prediction.rendering.colorDarkRed': '暗红、血色（不美）'
    };
    return dict[key] || key;
  }
});

describe('PredictionController.generateEnhancedAnalysisText', () => {
  test('should render human-readable labels instead of raw enum codes', () => {
    const controller = new PredictionController(mockStorageService);
    controller.i18n = makeI18n();

    const html = controller.generateEnhancedAnalysisText({
      icon: '🔥',
      status: '很棒',
      description: '测试描述',
      canvasAnalysis: {
        score: 82,
        cloudLevel: 'crowded',
        breakdown: { highClouds: 44, midClouds: 27, lowClouds: 18 },
        lowCloudPenalty: 1,
        penaltyReason: ''
      },
      lightPathAnalysis: {
        score: 40,
        capReason: 'overcast_cap_40',
        explain: ''
      },
      renderingAnalysis: {
        factor: 1,
        breakdown: {
          visibility: 'good',
          aqi: 'good',
          colorTendency: 'reddish_purple'
        }
      }
    });

    expect(html).toContain('拥挤');
    expect(html).toContain('良好（10-20km）');
    expect(html).toContain('良');
    expect(html).toContain('偏红、紫红色');

    expect(html).not.toContain('crowded');
    expect(html).not.toContain('reddish_purple');
    expect(html).not.toContain('| good | good |');
  });
});
