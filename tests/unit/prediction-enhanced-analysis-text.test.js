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
      'prediction.canvas.lowCloudPenalty': `| 低云惩罚: ${params.reason}`,
      'prediction.canvas.space': '太空（无云）',
      'prediction.canvas.fair': '尚可',
      'prediction.canvas.perfect': '完美',
      'prediction.canvas.crowded': '拥挤',
      'prediction.canvas.overcast': '阴天',
      'prediction.canvas.noLowCloudObstruction': '无低云遮挡',
      'prediction.canvas.tooManyLowClouds': '低云过多（几乎阴天）',
      'prediction.canvas.lowCloudAmount': `低云量 ${params.value}%`,
      'prediction.lightPath.lightPathScore': `🌅 光路: ${params.score}分`,
      'prediction.rendering.renderingFactor': `🎨 渲染系数: ${params.factor} | ${params.visibility} | ${params.aqi} | ${params.color}`,
      'prediction.rendering.specialMode': `| ${params.mode}`,
      'prediction.rendering.visibilityExcellent': '极佳（>20km）',
      'prediction.rendering.visibilityGood': '良好（10-20km）',
      'prediction.rendering.visibilityPoor': '较差（<10km）',
      'prediction.rendering.aqiExcellent': '优',
      'prediction.rendering.aqiGood': '良',
      'prediction.rendering.aqiPoor': '差',
      'prediction.rendering.colorGoldenOrange': '金黄、亮橙色',
      'prediction.rendering.colorReddishPurplish': '偏红、紫红色',
      'prediction.rendering.colorDarkRed': '暗红、血色（不美）',
      'prediction.rendering.postRainMode': '🌟 雨后初晴模式（超级加倍）'
    };
    return dict[key] || key;
  }
});

describe('PredictionController.generateEnhancedAnalysisText', () => {
  test('should reuse detailed fire-cloud analysis and avoid raw enum codes', () => {
    const controller = new PredictionController(mockStorageService);
    controller.i18n = makeI18n();

    const html = controller.generateEnhancedAnalysisText({
      icon: '🔥',
      status: '很棒',
      description: '测试描述',
      canvasAnalysis: {
        score: 82,
        cloudLevel: 'crowded',
        breakdown: { highClouds: 44, midClouds: 27, lowClouds: 45 },
        lowCloudPenalty: 0.63,
        penaltyReason: 'low_cloud_amount',
        penaltyValue: 45
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

    expect(html).toContain('火烧云形成条件分析');
    expect(html).toContain('高层云充足（44%），色彩载体丰富');
    expect(html).toContain('中层云适中（27%），利于色彩扩散和层次感');
    expect(html).toContain('低云较厚（45%），遮挡风险较大');

    expect(html).not.toContain('crowded');
    expect(html).not.toContain('low_cloud_amount');
    expect(html).not.toContain('reddish_purple');
    expect(html).not.toContain('post_rain');
    expect(html).not.toContain('| good | good |');
  });

  test('should prioritize rain summary over verbose cloud-layer details', () => {
    const controller = new PredictionController(mockStorageService);
    controller.i18n = makeI18n();

    const html = controller.generateEnhancedAnalysisText({
      icon: '🌧️',
      status: '不适合',
      description: '测试描述',
      score: 20,
      precipitation: 6.2,
      weatherCode: 63,
      humidity: 92,
      visibility: 3,
      canvasAnalysis: {
        score: 20,
        breakdown: { highClouds: 70, midClouds: 50, lowClouds: 80 }
      },
      factors: {
        precipitation: { value: 6.2 },
        weatherCode: { value: 63 },
        humidity: { value: 92 },
        visibility: { value: 3 }
      }
    });

    expect(html).toContain('下大雨，基本看不到');
    expect(html).not.toContain('高层云充沛');
    expect(html).not.toContain('中层云适中');
  });

  test('should omit weather analysis for clear sky', () => {
    const controller = new PredictionController(mockStorageService);
    controller.i18n = makeI18n();

    const html = controller.generateEnhancedAnalysisText({
      icon: '☀️',
      status: '一般',
      description: '测试描述',
      score: 35,
      precipitation: 0,
      weatherCode: 0,
      canvasAnalysis: {
        score: 35,
        breakdown: { highClouds: 0, midClouds: 0, lowClouds: 0 }
      }
    });

    expect(html).not.toContain('火烧云形成条件分析');
    expect(html).not.toContain('天气：晴');
  });

  test('should simplify post-rain weather analysis', () => {
    const controller = new PredictionController(mockStorageService);
    controller.i18n = makeI18n();

    const html = controller.generateEnhancedAnalysisText({
      icon: '🌦️',
      status: '有机会',
      description: '测试描述',
      score: 70,
      precipitation: 0,
      weatherCode: 2,
      canvasAnalysis: {
        score: 70,
        breakdown: { highClouds: 50, midClouds: 30, lowClouds: 10 }
      },
      renderingAnalysis: {
        breakdown: { specialMode: 'post_rain' }
      }
    });

    expect(html).toContain('雨后晴');
    expect(html).not.toContain('高层云充足');
  });

  test('should keep cloud and atmosphere analysis for moderate rain window', () => {
    const controller = new PredictionController(mockStorageService);
    controller.i18n = makeI18n();

    const html = controller.generateEnhancedAnalysisText({
      icon: '🌦️',
      status: '有机会',
      description: '测试描述',
      score: 55,
      precipitation: 0.8,
      weatherCode: 61,
      humidity: 78,
      visibility: 12,
      canvasAnalysis: {
        score: 55,
        breakdown: { highClouds: 50, midClouds: 35, lowClouds: 25 }
      }
    });

    expect(html).toContain('天气：小雨');
    expect(html).toContain('高层云充足');
    expect(html).toContain('雨后开缝反而可能出大片颜色');
  });

  test('should include humidity and visibility details when not raining heavily', () => {
    const controller = new PredictionController(mockStorageService);
    controller.i18n = makeI18n();

    const html = controller.generateEnhancedAnalysisText({
      icon: '🔥',
      status: '可看',
      description: '测试描述',
      score: 65,
      humidity: 62,
      visibility: 18,
      precipitation: 0,
      weatherCode: 1,
      canvasAnalysis: {
        score: 65,
        breakdown: { highClouds: 45, midClouds: 35, lowClouds: 10 }
      }
    });

    expect(html).toContain('天气：少云');
    expect(html).toContain('能见度良好（18km）');
    expect(html).toContain('湿度适中（62%）');
  });
});
