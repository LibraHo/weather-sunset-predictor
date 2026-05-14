import { jest } from '@jest/globals';

describe('miniprogram page user/share helpers', () => {
  let resultHelpers;
  let homeHelpers;

  beforeAll(async () => {
    globalThis.getApp = () => ({
      globalData: { favorites: [], recentQueries: [] },
      saveLatestPrediction: jest.fn(),
      rememberQuery: jest.fn(),
      services: {}
    });
    globalThis.Page = jest.fn();
    globalThis.wx = {
      getStorageSync: jest.fn(() => []),
      setStorageSync: jest.fn(),
      navigateBack: jest.fn(),
      reLaunch: jest.fn()
    };
    resultHelpers = await import('../../../miniprogram/pages/result/index.js');
    homeHelpers = await import('../../../miniprogram/pages/home/index.js');
  });

  afterAll(() => {
    delete globalThis.getApp;
    delete globalThis.Page;
    delete globalThis.wx;
  });

  test('result share path uses stable location parameters', () => {
    const path = resultHelpers.buildSharePath({
      locationName: '北京 天坛',
      lat: 39.882,
      lon: 116.406,
      period: 'sunset',
      date: '2026-05-11'
    });

    expect(path).toBe('/pages/result/index?lat=39.882&lon=116.406&name=%E5%8C%97%E4%BA%AC%20%E5%A4%A9%E5%9D%9B&type=sunset&date=2026-05-11');
  });

  test('result share message follows Xiake short title style', () => {
    expect(resultHelpers.buildShareMessage({ locationName: '天坛', period: 'sunrise', score: 82.4, lat: 1, lon: 2 })).toMatchObject({
      title: '霞客｜天坛朝霞评分 82分',
      path: expect.stringContaining('/pages/result/index?')
    });
  });

  test('favorite helper matches coordinates and payload shape', () => {
    const prediction = { locationName: '天坛', lat: 39.882, lon: 116.406, period: 'sunset' };
    expect(resultHelpers.buildFavoritePayload(prediction)).toMatchObject({ name: '天坛', lat: 39.882, lon: 116.406, type: 'sunset' });
    expect(resultHelpers.isFavoriteLocation(prediction, [{ name: '旧名', lat: 39.882, lon: 116.406 }])).toBe(true);
    expect(resultHelpers.sameLocation({ name: '天坛' }, { locationName: '天坛' })).toBe(true);
  });

  test('home recent-location payload preserves coordinate and period', () => {
    const recent = homeHelpers.buildRecentLocation({
      locationName: '香山',
      coordinate: { lat: 39.99, lon: 116.18 },
      period: 'sunset',
      day: 'tomorrow'
    });

    expect(recent).toMatchObject({
      name: '香山',
      locationName: '香山',
      lat: 39.99,
      lon: 116.18,
      type: 'sunset',
      day: 'tomorrow'
    });
    expect(recent.date).toEqual(expect.any(String));
  });

  test('home test weather data drives the weather preview card', () => {
    const preview = homeHelpers.buildTestWeatherPreview();

    expect(homeHelpers.isWeatherTestLocation('test')).toBe(true);
    expect(homeHelpers.isWeatherTestLocation(' TEST ')).toBe(true);
    expect(homeHelpers.isWeatherTestLocation('beijing')).toBe(false);
    expect(preview).toMatchObject({
      title: '天气信息',
      badge: 'TEST',
      location: 'TEST',
      iconType: 'partly-cloudy',
      iconSrc: '/assets/icons/weather-partly-cloudy.svg',
      condition: '多云',
      temperature: '19.9',
      temperatureUnit: '°C',
      windSpeed: '11 km/h',
      windDirection: '西',
      metrics: [
        { key: 'humidity', value: '72%' },
        { key: 'cloud', value: '53%' },
        { key: 'pressure', value: '1007 hPa' },
        { key: 'visibility', value: '13 km' },
        { key: 'aerosol', value: '0.11' },
        { key: 'precipitation', value: '0 mm' }
      ],
      note: '高 62% / 中 54% / 低 43% · 西 11 km/h'
    });

    expect(preview.weekly).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'today', label: '今天', temp: '15° / 31°', precip: '8%', wind: '21 km/h' }),
      expect.objectContaining({ key: 'tomorrow', label: '明天', temp: '15° / 32°', precip: '6%', wind: '19 km/h' })
    ]));
  });

  test('home sunrise sunset preview switch rebuilds score time direction and analysis', () => {
    const sunset = homeHelpers.buildPredictionPreviewForPeriod('sunset');
    const sunrise = homeHelpers.buildPredictionPreviewForPeriod('sunrise');

    expect(sunset.periodKey).toBe('sunset');
    expect(sunrise.periodKey).toBe('sunrise');
    expect(sunrise.score).not.toBe(sunset.score);
    expect(sunrise.mainTime).not.toBe(sunset.mainTime);
    expect(sunrise.bestViewingTime).not.toBe(sunset.bestViewingTime);
    expect(sunrise.direction).not.toBe(sunset.direction);
    expect(sunrise.analysis.map((item) => item.desc)).not.toEqual(sunset.analysis.map((item) => item.desc));
    expect(sunrise.radar.directions).toHaveLength(8);
    expect(sunrise.radar.directions).not.toEqual(sunset.radar.directions);
  });

  test('home real-city search builds the same weather and prediction surface as test mode', () => {
    const state = homeHelpers.buildHomePredictionSurface({
      locationName: '北京',
      period: 'sunset',
      date: '2026-05-14',
      score: 81,
      bestWindow: '18:38-19:18',
      direction: '西偏北',
      summary: { description: '高云和中云条件较好。' },
      weatherData: {
        provider: 'open-meteo',
        temp: 22,
        humidity: 63,
        pressure: 1009,
        visibility: 18,
        windSpeed: 9,
        windDirection: '西北',
        highClouds: 66,
        midClouds: 41,
        lowClouds: 12,
        precipitation: 0
      },
      clouds: { high: 66, mid: 41, low: 12 }
    }, { locationName: '北京', period: 'sunset' });

    expect(state.weatherPreview).toMatchObject({
      visible: true,
      badge: '7天概览',
      location: '北京',
      temperature: '22.0',
      windDirection: '西北'
    });
    expect(state.weatherPreview.description).not.toContain('测试数据');
    expect(state.predictionPreview).toMatchObject({
      periodKey: 'sunset',
      periodLabel: '晚霞',
      score: 81,
      bestViewingTime: '18:38-19:18',
      direction: '西偏北',
      clouds: [
        { key: 'high', value: 66 },
        { key: 'mid', value: 41 },
        { key: 'low', value: 12 }
      ]
    });
    expect(state.predictionPreview.radar.directions).toHaveLength(8);
    expect(state.predictionPreview.radar.directions[0]).toMatchObject({ direction: 'N', highCloud: expect.any(Number) });
  });

  test('result period switch can request and render the alternate prediction card', () => {
    const current = {
      locationName: 'TEST',
      lat: 39.9,
      lon: 116.4,
      period: 'sunset',
      date: '2026-05-11',
      score: 76,
      metrics: { highCloud: 62, midCloud: 36, lowCloud: 8 }
    };

    expect(resultHelpers.buildPredictionPeriodRequest(current, 'sunrise')).toMatchObject({
      lat: 39.9,
      lon: 116.4,
      type: 'sunrise',
      date: '2026-05-11'
    });

    const state = resultHelpers.buildResultPeriodState({ ...current, period: 'sunrise', score: 58, bestWindow: '05:12-05:52' });
    expect(state).toMatchObject({
      activePeriod: 'sunrise',
      prediction: expect.objectContaining({ period: 'sunrise', score: 58 }),
      metrics: expect.any(Array),
      analysisItems: expect.any(Array),
      scoreLedger: expect.objectContaining({ summary: expect.stringContaining('58') })
    });
  });

  test('result page builds Xiake core panels from backend analysis', () => {
    const analysis = resultHelpers.buildAnalysisItems({
      canvasAnalysis: { score: 83, breakdown: { highClouds: 64, midClouds: 20, lowClouds: 5 } },
      lightPathAnalysis: { score: 72, azimuth: 286, occlusionProbability: 0.18, explain: '光路通畅' },
      renderingAnalysis: { factor: 0.82, breakdown: { visibility: 'good', aerosol: 'polluted' } },
      cloudType: { label: '高层云' }
    });

    expect(analysis).toHaveLength(3);
    expect(analysis[0]).toMatchObject({ title: '云况画布', value: '83分', tone: 'good' });
    expect(analysis[1].detail).toContain('太阳方位 286°');
    expect(analysis[2]).toMatchObject({ title: '色彩修正', value: 'x0.82', tone: 'watch' });
  });

  test('result page maps surrounding and 3-day data to display rows', () => {
    const radar = resultHelpers.buildRadarView({
      points: [
        { direction: 'N', name: '北', score: 77.4, level: 'good', highCloud: 61, midCloud: 20, lowCloud: 5 }
      ]
    });
    const threeDay = resultHelpers.buildThreeDayGlowView([
      { key: '2026-05-13', label: '今天', date: '2026-05-13', sunrise: { score: 88, level: 'excellent' }, sunset: { score: 46, level: 'watch' } }
    ]);

    expect(radar.hasData).toBe(true);
    expect(radar.points).toHaveLength(9);
    expect(radar.directions).toHaveLength(8);
    expect(radar.bestItems[0]).toMatchObject({ direction: 'N', scoreText: 77 });
    expect(radar.points[1]).toMatchObject({ direction: 'N', scoreText: 77, cloudText: '高 61% / 中 20% / 低 5%' });
    expect(threeDay).toMatchObject({
      hasData: true,
      days: [
        expect.objectContaining({ sunriseScoreText: 88, sunriseLevel: 'excellent', sunsetScoreText: 46, sunsetLevel: 'watch' })
      ]
    });
  });
});
