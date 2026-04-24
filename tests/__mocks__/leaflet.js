import { jest } from '@jest/globals';

const createMapInstance = () => {
  const handlers = new Map();
  const mockContainer = document.createElement('div');
  mockContainer.style.cssText = 'width:800px;height:600px;';

  return {
    flyTo: jest.fn(),
    on: jest.fn((event, cb) => {
      handlers.set(event, cb);
    }),
    off: jest.fn(),
    getCenter: jest.fn(() => ({ lat: 35.6762, lng: 139.6503 })),
    getBounds: jest.fn(() => ({
      getNorth: () => 40,
      getSouth: () => 30,
      getEast: () => 140,
      getWest: () => 130
    })),
    getZoom: jest.fn(() => 4),
    getContainer: jest.fn(() => mockContainer),
    setView: jest.fn(),
    addLayer: jest.fn(),
    removeLayer: jest.fn(),
    fitBounds: jest.fn(),
    remove: jest.fn(),
    __handlers: handlers
  };
};

const createOverlay = () => ({
  addTo: jest.fn(function addTo() {
    return this;
  }),
  remove: jest.fn()
});

const mockGeoJsonLayer = {
  setStyle: jest.fn(),
  addTo: jest.fn(function addTo() { return this; }),
  getBounds: jest.fn(() => ({
    getNorth: () => 55,
    getSouth: () => 15,
    getEast: () => 135,
    getWest: () => 70
  })),
  remove: jest.fn()
};

const mockLayerGroup = {
  addTo: jest.fn(function addTo() { return this; }),
  clearLayers: jest.fn(),
  addLayer: jest.fn(),
  remove: jest.fn()
};

const L = {
  map: jest.fn(() => createMapInstance()),
  tileLayer: jest.fn(() => ({
    addTo: jest.fn(function addTo() {
      return this;
    })
  })),
  imageOverlay: jest.fn(() => createOverlay()),
  latLngBounds: jest.fn((southWest, northEast) => ({ southWest, northEast })),
  latLng: jest.fn((lat, lng) => ({ lat, lng })),
  marker: jest.fn(() => ({
    addTo: jest.fn(function addTo() {
      return this;
    }),
    remove: jest.fn()
  })),
  circleMarker: jest.fn(() => ({
    addTo: jest.fn(function addTo() { return this; }),
    setStyle: jest.fn(),
    remove: jest.fn()
  })),
  geoJSON: jest.fn(() => ({
    ...mockGeoJsonLayer,
    setStyle: jest.fn()
  })),
  layerGroup: jest.fn(() => ({
    ...mockLayerGroup
  })),
  divIcon: jest.fn(() => ({})),
  Control: {
    extend: jest.fn(() => {
      return jest.fn().mockImplementation(() => ({
        addTo: jest.fn(),
        remove: jest.fn()
      }));
    })
  }
};

export default L;
export { L };
