import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { jest } from '@jest/globals';
import { configureApi, resetApiConfig, setWxInstance } from '../../../miniprogram/services/api.js';
import {
  buildSpotMarkers,
  getChinaFirecloudSpots,
  normalizeChinaFirecloudSpots
} from '../../../miniprogram/services/firecloud-map.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('miniprogram firecloud map', () => {
  afterEach(() => {
    resetApiConfig();
  });

  test('registers native firecloud map page and routes from home/result', () => {
    const appJson = JSON.parse(read('miniprogram/app.json'));
    const homeWxml = read('miniprogram/pages/home/index.wxml');
    const resultWxml = read('miniprogram/pages/result/index.wxml');
    const mapWxml = read('miniprogram/pages/map/index.wxml');

    expect(appJson.pages).toContain('pages/map/index');
    expect(homeWxml).toContain('火烧云地图');
    expect(resultWxml).toContain('火烧云地图');
    expect(mapWxml).toContain('<map');
    expect(mapWxml).toContain('markers="{{markers}}"');
    expect(mapWxml).toContain('bindmarkertap="focusSpot"');
    expect(mapWxml).toContain('查详情分');
  });

  test('loads same-source China spots API and normalizes markers', async () => {
    const wxMock = {
      request: jest.fn(({ success }) => success({
        statusCode: 200,
        data: {
          period: 'sunset',
          updatedAt: '2026-05-13T00:10:00.000Z',
          spots: [
            { lat: 31.2, lon: 121.5, score: 88, quality: '顶级' },
            { lat: null, lon: 116.4, score: 70 }
          ]
        }
      }))
    };
    setWxInstance(wxMock);
    configureApi({ baseUrl: 'https://api.example.com' });

    const data = await getChinaFirecloudSpots({ period: 'sunset' });
    const markers = buildSpotMarkers(data.spots);

    expect(wxMock.request).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://api.example.com/api/spots/china?period=sunset',
      method: 'GET'
    }));
    expect(data.spots).toHaveLength(1);
    expect(data.spots[0]).toMatchObject({ scoreText: '88', level: 'excellent', quality: '顶级' });
    expect(markers[0]).toMatchObject({ latitude: 31.2, longitude: 121.5, title: '88分' });
  });

  test('normalizes spot bands with the same score policy as result pages', () => {
    const data = normalizeChinaFirecloudSpots({
      spots: [
        { lat: 1, lon: 2, score: 91 },
        { lat: 3, lon: 4, score: 76 },
        { lat: 5, lon: 6, score: 45 }
      ]
    });

    expect(data.spots.map((spot) => spot.level)).toEqual(['excellent', 'good', 'watch']);
    expect(data.spots.map((spot) => spot.quality)).toEqual(['顶级', '较好', '可观赏']);
  });
});
