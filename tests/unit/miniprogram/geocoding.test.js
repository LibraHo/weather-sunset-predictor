import { jest } from '@jest/globals';
import { configureApi, resetApiConfig, setWxInstance } from '../../../miniprogram/services/api.js';
import { reverseGeocode, searchLocations } from '../../../miniprogram/services/geocoding.js';

describe('miniprogram services/geocoding', () => {
  afterEach(() => {
    resetApiConfig();
    jest.restoreAllMocks();
  });

  test('searchLocations calls backend and maps location fields', async () => {
    const wxMock = {
      request: jest.fn(({ success }) => success({
        statusCode: 200,
        data: {
          success: true,
          results: [
            { displayName: 'Beijing, China', lat: '39.9042', lng: '116.4074', country_code: 'cn' },
            { name: 'Paris', latitude: 48.8566, longitude: 2.3522, countryCode: 'FR' }
          ]
        }
      }))
    };
    setWxInstance(wxMock);
    configureApi({ baseUrl: 'https://api.example.com' });

    const results = await searchLocations('beijing', 2);

    expect(wxMock.request.mock.calls[0][0].url).toBe('https://api.example.com/api/geocoding/search?q=beijing&limit=2');
    expect(results).toEqual([
      { name: 'Beijing, China', lat: 39.9042, lon: 116.4074, countryCode: 'CN' },
      { name: 'Paris', lat: 48.8566, lon: 2.3522, countryCode: 'FR' }
    ]);
  });

  test('searchLocations returns empty array for blank query', async () => {
    await expect(searchLocations('   ')).resolves.toEqual([]);
  });

  test('searchLocations keeps ambiguous candidates so the UI can ask the user to choose', async () => {
    const wxMock = {
      request: jest.fn(({ success }) => success({
        statusCode: 200,
        data: {
          success: true,
          results: [
            { name: 'Penang, Malaysia', lat: 5.4141, lon: 100.3288, countryCode: 'MY' },
            { name: 'Bincheng, Shandong, China', lat: 37.3818, lon: 118.0167, countryCode: 'CN' }
          ]
        }
      }))
    };
    setWxInstance(wxMock);
    configureApi({ baseUrl: 'https://api.example.com' });

    const results = await searchLocations('槟城', 5);

    expect(wxMock.request.mock.calls[0][0].url).toBe('https://api.example.com/api/geocoding/search?q=%E6%A7%9F%E5%9F%8E&limit=5');
    expect(results).toEqual([
      { name: 'Penang, Malaysia', lat: 5.4141, lon: 100.3288, countryCode: 'MY' },
      { name: 'Bincheng, Shandong, China', lat: 37.3818, lon: 118.0167, countryCode: 'CN' }
    ]);
  });

  test('reverseGeocode maps current coordinates to a display name', async () => {
    const wxMock = {
      request: jest.fn(({ success }) => success({
        statusCode: 200,
        data: { success: true, name: 'Beijing, China' }
      }))
    };
    setWxInstance(wxMock);
    configureApi({ baseUrl: 'https://api.example.com' });

    await expect(reverseGeocode(39.9042, 116.4074)).resolves.toBe('Beijing, China');
    expect(wxMock.request.mock.calls[0][0].url).toBe('https://api.example.com/api/geocoding/reverse?lat=39.9042&lon=116.4074');
  });
});
