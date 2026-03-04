import { jest } from '@jest/globals';

const createMapInstance = () => {
  const handlers = new Map();
  return {
    flyTo: jest.fn(),
    on: jest.fn((event, cb) => {
      handlers.set(event, cb);
    }),
    getCenter: jest.fn(() => ({ lat: 35.6762, lng: 139.6503 })),
    getBounds: jest.fn(() => ({
      getNorth: () => 40,
      getSouth: () => 30,
      getEast: () => 140,
      getWest: () => 130
    })),
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

const L = {
  map: jest.fn(() => createMapInstance()),
  tileLayer: jest.fn(() => ({
    addTo: jest.fn(function addTo() {
      return this;
    })
  })),
  imageOverlay: jest.fn(() => createOverlay()),
  latLngBounds: jest.fn((southWest, northEast) => ({ southWest, northEast })),
  marker: jest.fn(() => ({
    addTo: jest.fn(function addTo() {
      return this;
    }),
    remove: jest.fn()
  }))
};

export default L;
export { L };
