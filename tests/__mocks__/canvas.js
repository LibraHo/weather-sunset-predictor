import { jest } from '@jest/globals';

const createGradientMock = () => ({
  addColorStop: jest.fn()
});

const context2D = {
  clearRect: jest.fn(),
  beginPath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  stroke: jest.fn(),
  fill: jest.fn(),
  arc: jest.fn(),
  fillText: jest.fn(),
  fillRect: jest.fn(),
  strokeRect: jest.fn(),
  closePath: jest.fn(),
  createLinearGradient: jest.fn(() => createGradientMock()),
  createRadialGradient: jest.fn(() => createGradientMock()),
  setLineDash: jest.fn(),
  measureText: jest.fn(() => ({ width: 24 }))
};

Object.defineProperty(global, '__canvasContext2DMock', {
  value: context2D,
  writable: true,
  configurable: true
});

if (typeof HTMLCanvasElement !== 'undefined') {
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    writable: true,
    value: jest.fn(() => context2D)
  });

  Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
    configurable: true,
    writable: true,
    value: jest.fn(() => 'data:image/png;base64,mock-overlay')
  });
}
