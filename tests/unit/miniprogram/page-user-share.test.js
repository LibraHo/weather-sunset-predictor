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
});
