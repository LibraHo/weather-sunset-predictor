import { jest } from '@jest/globals';
import WindyMapService from '../../../src/services/WindyMapService.js';

/**
 * Helper: create a fully-featured Leaflet map mock that satisfies both
 * WindyMapService (fallback path) and ChinaMapCanvas (native-map path).
 */
const createMapMock = () => ({
  flyTo: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
  getCenter: jest.fn(() => ({ lat: 35.6, lng: 139.6 })),
  getBounds: jest.fn(() => ({
    getNorth: () => 40,
    getSouth: () => 30,
    getEast: () => 140,
    getWest: () => 130
  })),
  getZoom: jest.fn(() => 4),
  getContainer: jest.fn(() => {
    const el = document.createElement('div');
    el.style.cssText = 'width:800px;height:600px;';
    return el;
  }),
  setView: jest.fn(),
  addLayer: jest.fn(),
  removeLayer: jest.fn(),
  fitBounds: jest.fn(),
  remove: jest.fn()
});

const createGeoJsonLayer = () => ({
  setStyle: jest.fn(),
  addTo: jest.fn(function addTo() { return this; }),
  getBounds: jest.fn(() => ({
    getNorth: () => 55,
    getSouth: () => 15,
    getEast: () => 135,
    getWest: () => 70
  })),
  remove: jest.fn()
});

const createLayerGroup = () => ({
  addTo: jest.fn(function addTo() { return this; }),
  clearLayers: jest.fn(),
  addLayer: jest.fn(),
  remove: jest.fn()
});

describe('WindyMapService', () => {
  let service;
  let L;

  beforeEach(() => {
    document.body.innerHTML = '<div id="map"></div>';
    localStorage.setItem('use_native_map', 'false');

    L = {
      map: jest.fn(() => createMapMock()),
      tileLayer: jest.fn(() => ({ addTo: jest.fn(function addTo() { return this; }) })),
      marker: jest.fn(() => ({ addTo: jest.fn(function addTo() { return this; }), remove: jest.fn() })),
      latLngBounds: jest.fn((sw, ne) => ({ sw, ne })),
      latLng: jest.fn((lat, lng) => ({ lat, lng })),
      imageOverlay: jest.fn(() => ({ addTo: jest.fn(function addTo() { return this; }), remove: jest.fn() })),
      // ChinaMapCanvas dependencies
      geoJSON: jest.fn(() => createGeoJsonLayer()),
      layerGroup: jest.fn(() => createLayerGroup()),
      circleMarker: jest.fn(() => ({
        addTo: jest.fn(function addTo() { return this; }),
        setStyle: jest.fn(),
        remove: jest.fn()
      })),
      divIcon: jest.fn(() => ({})),
      Control: {
        extend: jest.fn(() => {
          // Return a constructor whose instances have addTo()
          return jest.fn().mockImplementation(() => ({
            addTo: jest.fn(),
            remove: jest.fn()
          }));
        })
      }
    };

    global.L = L;
    service = new WindyMapService('dummy-key');
  });

  afterEach(() => {
    localStorage.removeItem('use_native_map');
    delete global.L;
  });

  test('initializeMap 应完成 Leaflet 初始化（ChinaMapCanvas 优先路径）', async () => {
    await service.initializeMap('map', { lat: 31.2, lon: 121.5, zoom: 8 });

    expect(L.map).toHaveBeenCalled();
    // ChinaMapCanvas path: tileLayer is NOT called (no OSM fallback)
    // 地图通过 ChinaMapCanvas 初始化成功
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
