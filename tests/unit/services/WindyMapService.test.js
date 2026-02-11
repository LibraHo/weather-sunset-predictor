import { jest } from '@jest/globals';
import WindyMapService from '../../../src/services/WindyMapService.js';

describe('WindyMapService', () => {
  let service;
  let L;

  beforeEach(() => {
    document.body.innerHTML = '<div id="map"></div>';

    L = {
      map: jest.fn(() => ({
        flyTo: jest.fn(),
        on: jest.fn(),
        getCenter: jest.fn(() => ({ lat: 35.6, lng: 139.6 })),
        getBounds: jest.fn(() => ({
          getNorth: () => 40,
          getSouth: () => 30,
          getEast: () => 140,
          getWest: () => 130
        })),
        remove: jest.fn()
      })),
      tileLayer: jest.fn(() => ({ addTo: jest.fn(function addTo() { return this; }) })),
      marker: jest.fn(() => ({ addTo: jest.fn(function addTo() { return this; }), remove: jest.fn() })),
      latLngBounds: jest.fn((sw, ne) => ({ sw, ne })),
      imageOverlay: jest.fn(() => ({ addTo: jest.fn(function addTo() { return this; }), remove: jest.fn() }))
    };

    global.L = L;
    service = new WindyMapService('dummy-key');
  });

  test('initializeMap 应完成 Leaflet 初始化与瓦片图层加载', async () => {
    await service.initializeMap('map', { lat: 31.2, lon: 121.5, zoom: 8 });

    expect(L.map).toHaveBeenCalled();
    expect(L.tileLayer).toHaveBeenCalledWith(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      expect.any(Object)
    );
    expect(service.isInitialized).toBe(true);
  });

  test('moveTo 应调用 flyTo 并更新中心位置', async () => {
    await service.initializeMap('map', { lat: 31.2, lon: 121.5, zoom: 8 });
    const mapInstance = service.getMap();

    service.moveTo(30.3, 120.2, 7);

    expect(mapInstance.flyTo).toHaveBeenCalledWith([30.3, 120.2], 7, { duration: 1 });
    expect(service.currentOptions.lat).toBe(30.3);
    expect(service.currentOptions.lon).toBe(120.2);
  });

  test('addImageOverlay 应通过 L.imageOverlay 添加覆盖层', async () => {
    await service.initializeMap('map');

    const overlay = service.addImageOverlay('data:image/png;base64,abc', {
      north: 35,
      south: 34,
      east: 118,
      west: 117
    }, { opacity: 0.8 });

    expect(L.latLngBounds).toHaveBeenCalledWith([34, 117], [35, 118]);
    expect(L.imageOverlay).toHaveBeenCalled();
    expect(overlay).toBeTruthy();
    expect(service.overlays.length).toBe(1);
  });

  test('地图未初始化时 addImageOverlay 应返回 null', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const overlay = service.addImageOverlay('x', { north: 1, south: 0, east: 1, west: 0 });

    expect(overlay).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
  });
});
