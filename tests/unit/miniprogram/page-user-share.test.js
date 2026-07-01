import { jest } from '@jest/globals';

describe('miniprogram home page user/share helpers', () => {
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
    homeHelpers = await import('../../../miniprogram/pages/home/index.js');
  });

  afterAll(() => {
    delete globalThis.getApp;
    delete globalThis.Page;
    delete globalThis.wx;
  });

  test('home prediction share button opens the active home prediction page', () => {
    const message = homeHelpers.buildHomeShareMessage({
      periodKey: 'sunset',
      periodLabel: '晚霞',
      score: 76
    }, {
      locationName: '北京',
      coordinate: { lat: 39.9042, lon: 116.4074 },
      day: 'today'
    });

    expect(message.path).toContain('/pages/home/index?');
    expect(message.path).toContain('location=%E5%8C%97%E4%BA%AC');
    expect(message.path).toContain('lat=39.9042');
    expect(message.path).toContain('lon=116.4074');
    expect(message.path).toContain('type=sunset');
    expect(message.path).toContain('share=1');
    expect(message.path).toContain('auto=1');
    expect(message.path).not.toContain('/pages/result/index');
  });

  test('home share path uses the selected prediction card date and period', () => {
    const message = homeHelpers.buildHomeShareMessage({
      periodKey: 'sunrise',
      periodLabel: '朝霞',
      score: 75,
      date: '2026-05-31'
    }, {
      locationName: '北京',
      coordinate: { lat: 39.9042, lon: 116.4074 },
      period: 'sunset',
      day: 'today'
    });

    expect(message.path).toContain('type=sunrise');
    expect(message.path).toContain('date=2026-05-31');
    expect(message.path).not.toContain('/pages/result/index');
  });

  test('home share landing can restore the shared day on the home card', () => {
    expect(homeHelpers.resolveSharedDay('2026-06-14', new Date('2026-06-14T08:00:00+08:00'))).toBe('today');
    expect(homeHelpers.resolveSharedDay('2026-06-15', new Date('2026-06-14T08:00:00+08:00'))).toBe('tomorrow');
    expect(homeHelpers.resolveSharedDay('2026-06-20', new Date('2026-06-14T08:00:00+08:00'))).toBeNull();
  });

  test('FOV radar projects bearing-only sector samples to different horizontal positions', () => {
    const radar = homeHelpers.buildPredictionFovRadar([], 'sunset', {
      visibleSector: {
        mainBearing: 300,
        offsetsDeg: [-35, 0, 35],
        distancesKm: [50]
      },
      visibleSectorSamples: [
        { bearing: 280, distanceKm: 50, highCloud: 70 },
        { bearing: 320, distanceKm: 50, highCloud: 70 }
      ]
    });

    const highClouds = radar.clouds.filter((cloud) => cloud.layer === 'high');
    expect(highClouds.length).toBeGreaterThanOrEqual(2);
    expect(highClouds.some((cloud) => cloud.left < 50)).toBe(true);
    expect(highClouds.some((cloud) => cloud.left > 50)).toBe(true);
  });

  test('FOV radar keeps layer altitude separated when provider cloud base is low', () => {
    const radar = homeHelpers.buildPredictionFovRadar([], 'sunset', {
      visibleSector: {
        mainBearing: 305,
        offsetsDeg: [0],
        distancesKm: [50]
      },
      visibleSectorSamples: [
        { bearing: 305, distanceKm: 50, cloudBaseHeight: 800, highCloud: 70, midCloud: 70, lowCloud: 70 }
      ]
    });

    const high = radar.clouds.find((cloud) => cloud.layer === 'high');
    const mid = radar.clouds.find((cloud) => cloud.layer === 'mid');
    const low = radar.clouds.find((cloud) => cloud.layer === 'low');
    expect(high.top).toBeLessThan(mid.top);
    expect(mid.top).toBeLessThan(low.top);
  });

  test('FOV radar offsets same-bearing clouds by distance to avoid a perfect visual column', () => {
    const radar = homeHelpers.buildPredictionFovRadar([], 'sunset', {
      visibleSector: {
        mainBearing: 305,
        offsetsDeg: [0],
        distancesKm: [25, 75]
      },
      visibleSectorSamples: [
        { bearing: 305, distanceKm: 25, midCloud: 70 },
        { bearing: 305, distanceKm: 75, midCloud: 70 }
      ]
    });

    const midClouds = radar.clouds.filter((cloud) => cloud.layer === 'mid');
    expect(midClouds.length).toBeGreaterThan(2);
    expect(new Set(midClouds.map((cloud) => cloud.left)).size).toBeGreaterThan(2);
  });

  test('FOV radar scales cloud patches by projected altitude spacing', () => {
    const radar = homeHelpers.buildPredictionFovRadar([], 'sunset', {
      visibleSector: {
        mainBearing: 305,
        offsetsDeg: [0],
        distancesKm: [10, 25, 50, 75, 100]
      },
      visibleSectorSamples: [10, 25, 50, 75, 100].map((distanceKm) => ({
        bearing: 305,
        distanceKm,
        highCloud: 70
      }))
    });

    const highClouds = radar.clouds.filter((cloud) => cloud.layer === 'high');
    const topCloud = highClouds.reduce((best, cloud) => (cloud.top < best.top ? cloud : best), highClouds[0]);
    const bottomCloud = highClouds.reduce((best, cloud) => (cloud.top > best.top ? cloud : best), highClouds[0]);
    expect(topCloud.height).toBeGreaterThan(bottomCloud.height);
  });

  test('home prediction radar keeps FOV code dormant until backend enables it', () => {
    const basePrediction = {
      period: 'sunset',
      score: 68,
      clouds: { high: 60, mid: 45, low: 12 },
      direction: 'West',
      visibleSector: { mainBearing: 305, offsetsDeg: [-35, 0, 35], distancesKm: [25, 50] },
      visibleSectorSamples: [
        { bearing: 305, distanceKm: 25, highCloud: 68, midCloud: 45, lowCloud: 12 },
        { bearing: 340, distanceKm: 50, highCloud: 58, midCloud: 42, lowCloud: 10 }
      ]
    };

    const currentPreview = homeHelpers.buildPredictionPreviewFromPrediction(basePrediction, { period: 'sunset' });
    const futurePreview = homeHelpers.buildPredictionPreviewFromPrediction({
      ...basePrediction,
      enableFovRadar: true
    }, { period: 'sunset' });

    expect(currentPreview.radar.fov).toBeTruthy();
    expect(currentPreview.radar.useFovRadar).toBe(false);
    expect(futurePreview.radar.useFovRadar).toBe(true);
    expect(futurePreview.radar.fov.sunLabel).toBe(`\u65e5\u843d 305${String.fromCharCode(176)}`);
    expect(futurePreview.radar.fov.clouds.length).toBeGreaterThan(0);
  });

  test('home FOV radar does not fabricate samples when backend samples are absent', () => {
    const preview = homeHelpers.buildPredictionPreviewFromPrediction({
      period: 'sunset',
      score: 68,
      clouds: { high: 60, mid: 45, low: 12 },
      direction: 'West',
      enableFovRadar: true,
      visibleSector: { mainBearing: 305, offsetsDeg: [-35, 0, 35], distancesKm: [25, 50] },
      visibleSectorSamples: []
    }, { period: 'sunset' });

    expect(preview.radar.fov).toBeNull();
    expect(preview.radar.useFovRadar).toBe(false);
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

  test('home prediction preview keeps event time for feedback window checks', () => {
    const preview = homeHelpers.buildPredictionPreviewFromPrediction({
      period: 'sunset',
      eventTime: '2026-06-12T18:58:00+08:00',
      score: 72,
      cloudLayers: { high: 52, mid: 34, low: 8 }
    }, {
      locationName: '北京',
      coordinate: { lat: 39.9042, lon: 116.4074 }
    });

    expect(preview.eventTime).toBe('2026-06-12T18:58:00+08:00');
  });

  test('home prediction preview exposes score details from the searched-address card', () => {
    const preview = homeHelpers.buildPredictionPreviewFromPrediction({
      period: 'sunset',
      score: 44,
      canvasAnalysis: { score: 65.4 },
      lightPathAnalysis: {
        score: 107.2,
        azimuth: 286,
        occlusionProbability: 0.08
      },
      layerBrightness: {
        applied: true,
        effectiveBrightness: 46.3,
        factors: { pathFactor: 1.07 }
      },
      renderingAnalysis: { factor: 0.68, breakdown: { visibility: 'fair' } },
      breakdown: {
        baseScore: 65.2,
        canvasScore: 65.4,
        renderingFactor: 0.68,
        unclampedFinalScore: 44.1
      }
    }, { locationName: '北京' });

    const keys = preview.scoreLedger.steps.map((step) => step.key);
    const serialized = JSON.stringify(preview.scoreLedger);

    expect(keys).toEqual(['layerCarrierBrightness', 'baseScore', 'airRendering', 'finalScore']);
    expect(serialized).toContain('286');
    expect(serialized).not.toContain('/pages/result/index');
  });

  test('home test weather data drives the weather preview card', () => {
    const preview = homeHelpers.buildTestWeatherPreview();

    expect(homeHelpers.isWeatherTestLocation('test')).toBe(true);
    expect(homeHelpers.isWeatherTestLocation(' TEST ')).toBe(true);
    expect(homeHelpers.isWeatherTestLocation('beijing')).toBe(false);
    expect(preview).toMatchObject({
      badge: 'TEST',
      location: 'TEST',
      iconSrc: '/assets/icons/weather-partly-cloudy.svg'
    });
    expect(preview.weekly.length).toBeGreaterThan(0);
    expect(preview.hourly.length).toBeGreaterThan(0);
  });
});
