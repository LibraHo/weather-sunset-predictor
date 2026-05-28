import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { jest } from '@jest/globals';
import { configureApi, resetApiConfig, setWxInstance } from '../../../miniprogram/services/api.js';
import {
  buildRasterGroundOverlay,
  buildRasterOverlayImageUrl,
  buildRasterPolygons,
  buildTestFirecloudRaster,
  buildTestFirecloudSpotData,
  getChinaFirecloudRaster,
  getChinaFirecloudSpots,
  getFirecloudLegend,
  normalizeChinaFirecloudSpots,
  scoreToFirecloudColor,
  scoreToFirecloudMarkerColor,
  scoreToRasterLayerColor,
  scoreToRasterLayerHexColor
} from '../../../miniprogram/services/firecloud-map.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('miniprogram firecloud map', () => {
  afterEach(() => {
    resetApiConfig();
  });

  test('registers a native firecloud map page with a visible raster polygon surface', () => {
    const appJson = JSON.parse(read('miniprogram/app.json'));
    const homeWxml = read('miniprogram/pages/home/index.wxml');
    const resultWxml = read('miniprogram/pages/result/index.wxml');
    const mapWxml = read('miniprogram/pages/map/index.wxml');
    const mapJs = read('miniprogram/pages/map/index.js');

    expect(appJson.pages).toContain('pages/map/index');
    expect(homeWxml).toContain('data-target="map"');
    expect(resultWxml).toContain('data-target="map"');
    expect(mapWxml).toContain('<map');
    expect(mapWxml).toContain('id="firecloud-native-map"');
    expect(mapWxml).toContain('ground-overlays="{{groundOverlays}}"');
    expect(mapWxml).toContain('polygons="{{polygons}}"');
    expect(mapWxml).not.toContain('markers="{{markers}}"');
    expect(mapWxml).not.toContain('bindmarkertap="focusSpot"');
    expect(mapWxml).not.toContain('bindtap="openSpotPrediction"');
    expect(mapWxml).not.toContain('spot-row');
    expect(mapWxml).not.toContain('activeSpot');
    expect(mapWxml).not.toContain('spots.length');
    expect(mapJs).not.toContain('getChinaFirecloudSpots');
    expect(mapJs).not.toContain('openSpotPrediction');
    expect(mapJs).not.toContain('focusSpot');
    expect(mapJs).toContain('FIRECLOUD_MAP_RESOLUTION');
    expect(mapJs).toContain("FIRECLOUD_MAP_ID = 'firecloud-native-map'");
    expect(mapJs).toContain('const FIRECLOUD_MAP_RESOLUTION = 1;');
    expect(mapJs).toContain('buildRasterPolygons(raster, this.data.period)');
    expect(mapJs).toContain('groundOverlays: []');
    expect(mapJs).toContain('polygons');
    expect(mapJs).toContain('function getDefaultMapDay(now = new Date(), options = {})');
    expect(mapJs).toContain('getDefaultSunEventDay(now, options)');
    expect(mapWxml).toContain('enable-zoom="{{true}}"');
    expect(mapWxml).toContain('wx:for="{{legendItems}}"');
    expect(mapWxml).toContain('style="background: {{item.color}};"');
    expect(mapWxml).toContain('目前支持：中国大陆、港澳台、日本、韩国');
    expect(mapWxml).toContain('栅格评分插值染色');
  });

  test('builds a native map ground overlay image for the interpolated web-like raster layer', () => {
    configureApi({ baseUrl: 'https://api.example.com' });
    const raster = {
      period: 'sunset',
      bbox: { west: 100, east: 102, south: 30, north: 32 }
    };
    const overlay = buildRasterGroundOverlay(raster, { period: 'sunset', resolution: 0.25 });

    expect(overlay.src).toContain('https://api.example.com/api/spots/china/raster-overlay.png?period=sunset&resolution=0.25');
    expect(overlay.bounds).toEqual({
      southwest: { latitude: 30, longitude: 100 },
      northeast: { latitude: 32, longitude: 102 }
    });
    expect(overlay.opacity).toBeGreaterThan(0.8);
    expect(buildRasterOverlayImageUrl({ period: 'sunrise', resolution: 0.5 })).toContain('/api/spots/china/raster-overlay.png?period=sunrise&resolution=0.5');
  });

  test('loads same-source raster API and paints an interpolated polygon layer instead of map pins', async () => {
    const wxMock = {
      request: jest.fn(({ success }) => success({
        statusCode: 200,
        data: {
          period: 'sunset',
          updatedAt: '2026-05-13T00:10:00.000Z',
          bbox: { west: 100, east: 102, south: 30, north: 32 },
          resolution: 1,
          width: 2,
          height: 2,
          noData: -1,
          values: [39, 45, 62, -1]
        }
      }))
    };
    setWxInstance(wxMock);
    configureApi({ baseUrl: 'https://api.example.com' });

    const raster = await getChinaFirecloudRaster({ period: 'sunset', resolution: 0.25 });
    const polygons = buildRasterPolygons(raster, 'sunset');

    expect(wxMock.request).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://api.example.com/api/spots/china/raster?period=sunset&resolution=0.25',
      method: 'GET'
    }));
    expect(raster.validCellCount).toBe(2);
    expect(polygons).toHaveLength(2);
    expect(polygons[0]).toMatchObject({
      points: [
        { latitude: 32, longitude: 101 },
        { latitude: 32, longitude: 102 },
        { latitude: 31, longitude: 102 },
        { latitude: 31, longitude: 101 }
      ],
      strokeWidth: 0
    });
    expect(polygons[0].fillColor).toBe(scoreToRasterLayerHexColor(45, 'sunset'));
    expect(polygons[0].fillColor).toMatch(/^#[0-9A-F]{8}$/);
  });

  test('keeps spot normalization utilities available for backend parity without exposing high-score UI', async () => {
    const wxMock = {
      request: jest.fn(({ success }) => success({
        statusCode: 200,
        data: {
          period: 'sunset',
          updatedAt: '2026-05-13T00:10:00.000Z',
          spots: [
            { lat: 31.2, lon: 121.5, score: 88, quality: 'custom-quality' },
            { lat: null, lon: 116.4, score: 70 }
          ]
        }
      }))
    };
    setWxInstance(wxMock);
    configureApi({ baseUrl: 'https://api.example.com' });

    const data = await getChinaFirecloudSpots({ period: 'sunset' });

    expect(wxMock.request).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://api.example.com/api/spots/china?period=sunset',
      method: 'GET'
    }));
    expect(data.spots).toHaveLength(1);
    expect(data.spots[0]).toMatchObject({ scoreText: '88', level: 'peak', quality: 'custom-quality' });
  });

  test('normalizes spot bands with the same compact raster policy as the web map', () => {
    const data = normalizeChinaFirecloudSpots({
      spots: [
        { lat: 1, lon: 2, score: 91 },
        { lat: 3, lon: 4, score: 64 },
        { lat: 5, lon: 6, score: 55 },
        { lat: 7, lon: 8, score: 45 }
      ]
    });

    expect(data.spots.map((spot) => spot.level)).toEqual(['peak', 'high', 'mid', 'low']);
    expect(data.spots.map((spot) => spot.scoreText)).toEqual(['91', '64', '55', '45']);
  });

  test('uses web compact raster legend thresholds for map color semantics', () => {
    const sunsetLegend = getFirecloudLegend('sunset');
    const sunriseLegend = getFirecloudLegend('sunrise');

    expect(sunsetLegend.map((item) => item.label)).toEqual(['<40', '40', '50', '60', '70+']);
    expect(sunriseLegend.map((item) => item.label)).toEqual(['<40', '40', '50', '60', '70+']);
    expect(sunsetLegend[4].color).toBe('rgba(218,78,28,0.55)');
    expect(sunriseLegend[4].color).toBe('rgba(218,78,28,0.65)');
    expect(scoreToFirecloudColor(62, 'sunset')).toBe('rgba(248,132,54,0.36)');
    expect(scoreToFirecloudMarkerColor(62, 'sunset')).toBe('#ff9a3d');
    expect(scoreToRasterLayerColor(40, 'sunset')).toBe('rgba(255,236,212,0.05)');
    expect(scoreToRasterLayerColor(70, 'sunset')).toBe('rgba(218,78,28,0.55)');
    expect(scoreToRasterLayerHexColor(39, 'sunset')).toBe('#00000000');
    expect(scoreToRasterLayerHexColor(70, 'sunset')).toBe('#DA4E1C8C');
  });

  test('falls back to generated China-Japan-Korea test spots when backend data is unavailable', async () => {
    const wxMock = {
      request: jest.fn(({ fail }) => fail({ errMsg: 'network down' }))
    };
    setWxInstance(wxMock);
    configureApi({ baseUrl: 'https://api.example.com' });

    const data = await getChinaFirecloudSpots({ period: 'sunset' });

    expect(data.isFallback).toBe(true);
    expect(data.fallbackReason).toBe('request-failed');
    expect(data.spots.length).toBeGreaterThanOrEqual(8);
    expect(data.spots.map((spot) => spot.name)).toEqual(expect.arrayContaining(['北京', '东京', '首尔']));
  });

  test('manual generated test data covers only the currently supported CJK map region', () => {
    const data = buildTestFirecloudSpotData('sunset');

    expect(data.spots.every((spot) => (
      (spot.lon >= 73 && spot.lon <= 146)
      && (spot.lat >= 18 && spot.lat <= 46)
    ))).toBe(true);
  });

  test('manual generated raster data creates a visible interpolation layer when backend is unavailable', () => {
    const raster = buildTestFirecloudRaster('sunset');
    const polygons = buildRasterPolygons(raster, 'sunset');

    expect(raster.isFallback).toBe(true);
    expect(raster.validCellCount).toBeGreaterThan(0);
    expect(polygons.length).toBeGreaterThan(0);
    expect(polygons.every((polygon) => polygon.points.length === 4)).toBe(true);
  });

  test('map page uses polygons as the primary visible raster layer', () => {
    const mapJs = read('miniprogram/pages/map/index.js');

    expect(mapJs).toContain('buildRasterPolygons');
    expect(mapJs).toContain('const polygons = buildRasterPolygons(raster, this.data.period)');
    expect(mapJs).toContain('groundOverlays: []');
    expect(mapJs).toContain('polygons');
    expect(mapJs).not.toContain('addNativeGroundOverlay');
    expect(mapJs).not.toContain('createMapContext');
  });

  test('map page follows the prediction page theme and segmented-control language', () => {
    const wxml = read('miniprogram/pages/map/index.wxml');
    const wxss = read('miniprogram/pages/map/index.wxss');

    expect(wxml).toContain('<app-topbar current="map" period="{{period}}" theme-mode="{{themeMode}}" resolved-theme-mode="{{resolvedThemeMode}}"');
    expect(wxml).toContain('map-tabs prediction-toggle-bar');
    expect(wxml).toContain('tap-feedback prediction-toggle');
    expect(wxss).toContain('.firecloud-map-page.theme-light .map-card');
    expect(wxss).toContain('.firecloud-map-page.theme-dark .map-card');
    expect(wxss).toContain('width: 332rpx');
    expect(wxss).toContain('border-radius: 999rpx');
  });
});
