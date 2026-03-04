import { jest } from '@jest/globals';
import RadarChartService from '../../../src/services/RadarChartService.js';

describe('RadarChartService', () => {
  let service;

  beforeEach(() => {
    service = new RadarChartService();
    document.body.innerHTML = '<div id="radar"></div>';

    HTMLCanvasElement.prototype.getContext.mockImplementation(() => global.__canvasContext2DMock);

    Object.values(global.__canvasContext2DMock).forEach((fn) => {
      if (typeof fn === 'function' && 'mockClear' in fn) fn.mockClear();
    });
  });

  test('renderRadarChart 应触发核心 Canvas 绘制调用', () => {
    const points = [
      { score: 80, label: 'N', name: '北', distance: 100 },
      { score: 70, label: 'NE', name: '东北', distance: 100 },
      { score: 60, label: 'E', name: '东', distance: 100 },
      { score: 50, label: 'SE', name: '东南', distance: 100 },
      { score: 40, label: 'S', name: '南', distance: 100 },
      { score: 30, label: 'SW', name: '西南', distance: 100 },
      { score: 20, label: 'W', name: '西', distance: 100 },
      { score: 10, label: 'NW', name: '西北', distance: 100 }
    ];

    const success = service.renderRadarChart('radar', points);

    expect(success).toBe(true);
    expect(HTMLCanvasElement.prototype.getContext).toHaveBeenCalledWith('2d');
    expect(global.__canvasContext2DMock.fillRect).toHaveBeenCalled();
    expect(global.__canvasContext2DMock.arc).toHaveBeenCalled();
    expect(global.__canvasContext2DMock.fillText).toHaveBeenCalled();
  });

  test('数据为空时应正常渲染且不抛错', () => {
    const success = service.renderRadarChart('radar', []);
    expect(success).toBe(true);
    expect(global.__canvasContext2DMock.fillRect).toHaveBeenCalled();
  });

  test('canvas 不支持时应返回 false 并渲染降级表格', () => {
    const originalCreateElement = document.createElement.bind(document);
    jest.spyOn(document, 'createElement').mockImplementation((tag) => {
      const el = originalCreateElement(tag);
      if (tag === 'canvas') el.getContext = null;
      return el;
    });

    const success = service.renderRadarChart('radar', [{ score: 50, label: 'N', name: '北', distance: 100 }]);

    expect(success).toBe(false);
    expect(document.getElementById('radar').querySelector('table')).not.toBeNull();
  });
});
