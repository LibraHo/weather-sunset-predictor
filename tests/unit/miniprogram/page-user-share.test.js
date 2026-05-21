import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { normalizePrediction } from '../../../miniprogram/services/prediction.js';

const resultPageSource = fs.readFileSync(path.resolve(process.cwd(), 'miniprogram/pages/result/index.js'), 'utf8');

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

  test('home prediction share button opens the current compact result', () => {
    expect(homeHelpers.buildHomeShareMessage({
      periodKey: 'sunset',
      periodLabel: '晚霞',
      score: 76
    }, {
      locationName: '北京',
      coordinate: { lat: 39.9042, lon: 116.4074 },
      day: 'today'
    })).toMatchObject({
      title: '霞客｜北京晚霞评分 76分',
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

  test('home hourly chart keeps points inside the plot area', () => {
    const hourly = Array.from({ length: 24 }, (_, index) => ({
      key: `h-${index}`,
      time: `${String(index).padStart(2, '0')}:00`,
      temp: 18 + Math.sin(index / 3) * 5,
      cloudValue: 40 + index,
      windValue: 8 + index / 4,
      precipValue: index % 6,
      humidityValue: 60 - index / 2,
      pressure: 1000 + index
    }));
    const view = homeHelpers.buildWeatherHourlyViewModel(hourly, 'temp');

    expect(view.chart[0].left).toBeGreaterThanOrEqual(18);
    expect(view.chart.at(-1).left).toBeLessThanOrEqual(82);
    expect(Math.min(...view.chart.map((item) => item.left))).toBeGreaterThanOrEqual(18);
    expect(Math.max(...view.chart.map((item) => item.left))).toBeLessThanOrEqual(82);
    expect(view.chart).toHaveLength(13);
    expect(view.chart[0].labelPlacement).toBe('right');
    expect(view.chart.at(-1).labelPlacement).toBe('left');
    expect(view.chart[Math.floor((view.chart.length - 1) / 2)].labelPlacement).toBe('center');
    expect(view.chart.every((point) => point.top >= 26 && point.top <= 80)).toBe(true);
    expect(view.chartSegments).toBeUndefined();
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

  test('home prediction card shows sunset reference time instead of viewing-window start', () => {
    const state = homeHelpers.buildHomePredictionSurface({
      locationName: '北京',
      period: 'sunset',
      score: 76,
      referenceTime: '2026-05-18T11:24:00.000Z',
      bestWindow: {
        start: '2026-05-18T10:58:00.000Z',
        end: '2026-05-18T11:28:00.000Z'
      },
      weatherData: { provider: 'open-meteo' }
    }, { locationName: '北京', period: 'sunset' });

    expect(state.predictionPreview.mainTime).toBe('19:24');
    expect(state.predictionPreview.bestViewingTime).toBe('18:58 - 19:28');
  });

  test('home asks the user to choose when one query contains multiple city names', () => {
    expect(homeHelpers.shouldAskLocationChoice('北京 上海', [
      { name: '上海市', lat: 31.230525, lon: 121.473667, countryCode: 'CN' },
      { name: '北京市', lat: 39.904179, lon: 116.407387, countryCode: 'CN' }
    ])).toBe(true);
  });

  test('home prediction conclusion hides backend condition enum tokens', () => {
    const state = homeHelpers.buildHomePredictionSurface({
      locationName: 'TEST',
      period: 'sunset',
      score: 76,
      conclusion: 'conditions_good',
      weatherData: {
        provider: 'open-meteo',
        highClouds: 62,
        midClouds: 36,
        lowClouds: 8
      },
      clouds: { high: 62, mid: 36, low: 8 }
    }, { locationName: 'TEST', period: 'sunset' });

    expect(state.predictionPreview.conclusion).not.toMatch(/conditions_[a-z_]+/);
    expect(state.predictionPreview.conclusion).toContain('火烧云条件');
  });

  test('home weather card renders normalized real-city weather metrics', () => {
    const prediction = normalizePrediction({
      score: 76,
      status: 'good',
      locationName: '北京',
      cloudLayers: { high: 62, mid: 36, low: 8 },
      weatherData: {
        temperature_2m: 21.6,
        relative_humidity_2m: 68,
        surface_pressure: 1008.7,
        visibility: 16000,
        wind_speed_10m: 11.4,
        wind_direction_10m: '西',
        precipitation: 0,
        aerosol_optical_depth: 0.12
      }
    });
    const state = homeHelpers.buildHomePredictionSurface(prediction, { locationName: '北京', period: 'sunset' });

    expect(state.weatherPreview.temperature).toBe('21.6');
    expect(state.weatherPreview.windSpeed).toBe('11 km/h');
    expect(state.weatherPreview.windDirection).toBe('西');
    expect(state.weatherPreview.metrics).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'humidity', value: '68%' }),
      expect.objectContaining({ key: 'pressure', value: '1008.7 hPa' }),
      expect.objectContaining({ key: 'visibility', value: '16 km' }),
      expect.objectContaining({ key: 'aerosol', value: '0.12' }),
      expect.objectContaining({ key: 'precipitation', value: '0 mm' })
    ]));
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

  test('result period state keeps heavy backend payloads out of setData', () => {
    const heavyHourly = Array.from({ length: 168 }, (_, index) => ({ time: index, temp: 20 + index }));
    const state = resultHelpers.buildResultPeriodState({
      period: 'sunset',
      score: 66,
      lat: 39.9,
      lon: 116.4,
      weatherData: {
        temperature_2m: 22,
        hourly: heavyHourly,
        remoteCloudSamples: heavyHourly,
        rawProviderPayload: { hourly: heavyHourly }
      },
      remoteCloudData: { samples: heavyHourly },
      debugProfile: { remoteCloudMs: 4200 },
      canvasAnalysis: { score: 72 },
      lightPathAnalysis: { score: 70 },
      renderingAnalysis: { factor: 1.02 }
    });

    expect(state.prediction.weatherData).toEqual({ temperature_2m: 22 });
    expect(state.prediction.remoteCloudData).toBeUndefined();
    expect(state.prediction.debugProfile).toBeUndefined();
    expect(JSON.stringify(state)).not.toContain('remoteCloudSamples');
    expect(JSON.stringify(state)).not.toContain('rawProviderPayload');
  });

  test('result period switch reuses prefetch promises and warms alternate panels', () => {
    expect(resultPageSource).toContain('periodCardPromises');
    expect(resultPageSource).toContain('prefetchXiakePanels');
    expect(resultPageSource).toContain('getEnhancedPredictionBatch');
    expect(resultPageSource).toContain('this.periodCardPromises[period]');
    expect(resultPageSource).toContain('this.data.activePeriod !== period');
    expect(resultPageSource).toContain('this.scheduleXiakePanels(nextPrediction)');
    expect(resultPageSource).toContain('this.scheduleXiakePanels(prefetchedPrediction)');
    expect(resultPageSource).not.toContain('this.setData({ activePeriod: period, loading: true });');
  });

  test('result page cached period switch avoids duplicate panel and canvas work', () => {
    expect(resultPageSource).toContain('const cachedRadar = this.radarPanelCache[radarKey] || null;');
    expect(resultPageSource).toContain('const radarPromise = cachedRadar ? null : this.getRadarPanelPromise');
    expect(resultPageSource).toContain('if (!radarPromise && !threeDayPromise) {');
    expect(resultPageSource).toContain("logMiniPerf('result.panels.cacheOnly.done'");
    expect(resultPageSource).toContain('lastResultRadarPaintSignature');
    expect(resultPageSource).toContain('resultRadarPaintTimer');
    expect(resultPageSource).toContain('resultPanelLoadTimer');
  });

  test('home search renders basic weather before waiting for glow scoring', () => {
    const homeSource = fs.readFileSync(path.resolve(process.cwd(), 'miniprogram/pages/home/index.js'), 'utf8');
    const homeWxml = fs.readFileSync(path.resolve(process.cwd(), 'miniprogram/pages/home/index.wxml'), 'utf8');

    expect(homeSource.indexOf('weather = await this.callWeatherForecast(query);')).toBeLessThan(homeSource.indexOf('const raw = await this.callPredictionService(query);'));
    expect(homeSource).toContain('weatherPreview: buildWeatherPreview({ ...weather, location: query.locationName })');
    expect(homeSource).toContain("this.setSearchLoadingStep('正在计算霞光评分', 72, '基础天气暂未返回，继续读取综合预测');");
    expect(homeSource).toContain('predictionPreviewLoading: true');
    expect(homeSource).toContain('predictionPreviewLoading: false');
    expect(homeWxml).toContain('wx:if="{{predictionPreviewLoading}}"');
    expect(homeWxml).toContain('prediction-local-loading');
  });

  test('home search fetches sunrise sunset preview cards together instead of falling back to static preview', () => {
    const homeSource = fs.readFileSync(path.resolve(process.cwd(), 'miniprogram/pages/home/index.js'), 'utf8');

    expect(homeSource).toContain('predictionPeriodCards: {}');
    expect(homeSource).toContain('const predictionCards = await this.callPredictionCardBatch(query);');
    expect(homeSource).toContain('getEnhancedPredictionBatch({');
    expect(homeSource).toContain('compactPredictionPreviewPayload(normalizePrediction');
    expect(homeSource).toContain('const cachedPrediction = this.data.predictionPeriodCards?.[value];');
    expect(homeSource).toContain('const pendingPrediction = this.predictionPreviewPromises?.[value];');
    expect(homeSource.indexOf('const cachedPrediction = this.data.predictionPeriodCards?.[value];')).toBeLessThan(homeSource.indexOf('predictionPreview: buildPredictionPreviewForPeriod(value)'));
  });

  test('home cached prediction cards are compact enough for instant toggles', () => {
    const compact = homeHelpers.compactPredictionPreviewPayload({
      score: 72,
      period: 'sunrise',
      referenceTime: '2026-05-20T21:12:00.000Z',
      weatherData: {
        temperature_2m: 18,
        hourly: Array.from({ length: 168 }, (_, index) => ({ index })),
        daily: Array.from({ length: 7 }, (_, index) => ({ index })),
        remoteCloudSamples: [{ id: 1 }]
      },
      lightPathAnalysis: {
        score: 68,
        samples: Array.from({ length: 100 }, (_, index) => ({ index })),
        directionalAnalysis: { direction: '东偏北', reason: 'opening', raw: { large: true } }
      },
      remoteCloudData: { samples: [{ id: 1 }] }
    });

    expect(compact.weatherData).toEqual({ temperature_2m: 18 });
    expect(compact.lightPathAnalysis).toEqual({
      score: 68,
      azimuth: undefined,
      occlusionProbability: undefined,
      explain: undefined,
      directionalAnalysis: { direction: '东偏北', reason: 'opening' }
    });
    expect(JSON.stringify(compact)).not.toContain('remoteCloudSamples');
    expect(JSON.stringify(compact)).not.toContain('samples');
  });

  test('result period switch clears loading when cached or stale period state wins', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'miniprogram/pages/result/index.js'), 'utf8');

    expect(source).toContain('const periodState = buildResultPeriodState(nextPrediction);');
    expect(source).toContain('...periodState,');
    expect(source).toContain('loading: false,');
    expect(source).toContain('if (this.data.activePeriod !== period) {');
    expect(source).toContain('this.setData({ loading: false });');
  });

  test('result page metrics include the full weather API fields', () => {
    const state = resultHelpers.buildResultPeriodState({
      period: 'sunset',
      score: 76,
      clouds: { high: 62, mid: 36, low: 8 },
      weatherData: {
        temp: 21.6,
        humidity: 68,
        pressure: 1008.7,
        visibility: 16,
        windSpeed: 11.4,
        windDirection: 270,
        precipitation: 0,
        aod: 0.12
      }
    });

    expect(state.metrics).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'temp', value: '21.6°C' }),
      expect.objectContaining({ key: 'wind', value: expect.stringContaining('11.4') }),
      expect.objectContaining({ key: 'windDirection', value: '270°' }),
      expect.objectContaining({ key: 'humidity', value: '68%' }),
      expect.objectContaining({ key: 'visibility', value: '16km' }),
      expect.objectContaining({ key: 'pressure', value: '1008.7 hPa' }),
      expect.objectContaining({ key: 'precipitation', value: '0 mm' })
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
    expect(analysis[0]).toMatchObject({ title: '云层载体', value: '83分', tone: 'good' });
    expect(analysis[1].detail).toContain('太阳方位 286°');
    expect(analysis[2]).toMatchObject({ title: '显色修正', value: 'x0.82', tone: 'watch' });
  });

  test('result score ledger follows additive carrier and light gate formula copy', () => {
    const ledger = resultHelpers.buildScoreLedger({
      score: 67,
      canvasAnalysis: {
        score: 78,
        cloudThicknessAdjustment: { adjustment: -12, reason: 'moderate_thick_cloud_penalty' }
      },
      lightPathAnalysis: { score: 72 },
      lightPathGate: { gate: 0.82 },
      renderingAdjustment: { adjustment: 3.2 },
      renderingAnalysis: { factor: 1.08 },
      breakdown: {
        baseScore: 64,
        lightPathGate: 0.82,
        renderingAdjustment: 3.2,
        unclampedFinalScore: 67
      }
    });

    expect(ledger.summary).toContain('云层载体经光路门控');
    expect(ledger.steps.find((step) => step.key === 'baseScore')).toMatchObject({
      expression: '78 × 光路门控 0.82 = 64'
    });
    expect(ledger.steps.find((step) => step.key === 'cloudThickness')).toMatchObject({
      result: '-12分',
      expression: '厚云幕扣分'
    });
    expect(ledger.steps.find((step) => step.key === 'rendering')).toMatchObject({
      expression: '64 +3.2 = 67'
    });
    expect(JSON.stringify(ledger)).not.toContain('80%');
    expect(JSON.stringify(ledger)).not.toContain('20%');
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

  test('result period fetch timing stays separate from build timing', () => {
    expect(resultPageSource).toContain('const fetchEndedAt = perfNow();');
    expect(resultPageSource).toContain('fetchMs: roundPerfMs(fetchEndedAt - fetchStartedAt)');
    expect(resultPageSource).toContain('buildMs: roundPerfMs(builtAt - buildStartedAt)');
  });
});
