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
