import { jest } from '@jest/globals';

describe('miniprogram current location search', () => {
  let page;

  beforeAll(async () => {
    global.getApp = () => ({
      globalData: {
        recentQueries: [],
        favorites: []
      },
      services: {},
      rememberQuery: jest.fn(),
      saveLatestPrediction: jest.fn()
    });
    global.Page = (definition) => {
      page = definition;
    };
    global.wx = {
      getLocation: jest.fn(),
      request: jest.fn(),
      getStorageSync: jest.fn(() => null),
      setStorageSync: jest.fn(),
      getDeviceInfo: jest.fn(() => ({ pixelRatio: 1 })),
      getWindowInfo: jest.fn(() => ({ pixelRatio: 1 }))
    };

    await import('../../../miniprogram/pages/home/index.js');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  function createPageContext(overrides = {}) {
    return {
      data: {
        ...page.data,
        locating: false,
        loading: false,
        siteState: {
          siteClosed: false,
          weatherPredictionClosed: false,
          shareMapAvailable: true,
          firecloudMapAvailable: true
        },
        ...overrides.data
      },
      setData(patch, callback) {
        this.data = { ...this.data, ...patch };
        if (typeof callback === 'function') callback();
      },
      onSearch: jest.fn(),
      ...overrides
    };
  }

  test('does not search weather when wx.getLocation returns invalid overseas coordinates', async () => {
    global.wx.getLocation.mockImplementation(({ success }) => {
      success({ latitude: undefined, longitude: 115.1889 });
    });
    const ctx = createPageContext();

    await page.onUseCurrentLocation.call(ctx);

    expect(ctx.onSearch).not.toHaveBeenCalled();
    expect(global.wx.request).not.toHaveBeenCalled();
    expect(ctx.data.errorMessage).toBe('当前位置坐标不可用，请手动输入地点。');
    expect(ctx.data.locating).toBe(false);
  });

  test('clears stale current coordinates when wx.getLocation returns invalid coordinates', async () => {
    global.wx.getLocation.mockImplementation(({ success }) => {
      success({ latitude: undefined, longitude: 115.1889 });
    });
    const ctx = createPageContext({
      data: {
        coordinate: { lat: 39.9042, lon: 116.4074 },
        locationText: '当前位置',
        locationCandidates: [{ name: 'Beijing', lat: 39.9042, lon: 116.4074 }]
      }
    });

    await page.onUseCurrentLocation.call(ctx);

    expect(ctx.data.coordinate).toBeNull();
    expect(ctx.data.locationText).toBe('');
    expect(ctx.data.locationCandidates).toEqual([]);
    expect(ctx.onSearch).not.toHaveBeenCalled();
  });

  test('uses validated current coordinates for the following weather search', async () => {
    global.wx.getLocation.mockImplementation(({ success }) => {
      success({ latitude: '-8.4095', longitude: '115.1889' });
    });
    global.wx.request.mockImplementation(({ success }) => {
      success({ statusCode: 200, data: { success: true, name: [] } });
    });
    const ctx = createPageContext();

    await page.onUseCurrentLocation.call(ctx);

    expect(global.wx.request.mock.calls[0][0].url).toBe('/api/geocoding/reverse?lat=-8.4095&lon=115.1889');
    expect(ctx.data.coordinate).toEqual({ lat: -8.4095, lon: 115.1889 });
    expect(ctx.data.locationText).toBe('当前位置');
    expect(ctx.onSearch).toHaveBeenCalledTimes(1);
    expect(ctx.data.locating).toBe(false);
  });
});
