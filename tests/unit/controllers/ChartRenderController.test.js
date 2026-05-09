import { jest } from '@jest/globals';
import ChartRenderController from '../../../src/controllers/ChartRenderController.js';

describe('ChartRenderController', () => {
  test('跨天的横轴应在日期切换点显示月/日，避免仅显示小时造成误解', () => {
    document.body.innerHTML = '<div id="chart-container" style="width: 900px"></div>';
    window.matchMedia = jest.fn().mockReturnValue({ matches: false });

    const controller = new ChartRenderController({
      i18n: { t: jest.fn((key) => (key === 'charts.trend' ? '变化趋势' : key === 'charts.time' ? '时间' : '温度')) },
      getConvertedTemp: (v) => v,
      getConvertedWindSpeed: (v) => v
    });

    const base = new Date('2026-01-01T18:00:00Z').getTime();
    const hourlyData = Array.from({ length: 24 }, (_, i) => ({
      timestamp: base + i * 60 * 60 * 1000,
      temp: 20 + i * 0.1
    }));

    controller.renderSimpleChart(hourlyData, 'chart-container', 'temp', '温度', '°C', '#ff6b6b');

    const html = document.getElementById('chart-container').innerHTML;
    expect(html).toContain('1/2 2:00');
    expect(html).toContain('1/3 0:00');
  });

  test('跨日边界与常规刻度过近时，应优先保留跨日标签避免横轴混叠', () => {
    document.body.innerHTML = '<div id="chart-container" style="width: 900px"></div>';
    window.matchMedia = jest.fn().mockReturnValue({ matches: false });

    const controller = new ChartRenderController({
      i18n: { t: jest.fn((key) => (key === 'charts.trend' ? '变化趋势' : key === 'charts.time' ? '时间' : '温度')) },
      getConvertedTemp: (v) => v,
      getConvertedWindSpeed: (v) => v
    });

    // 17:00 开始可制造 23:00（常规3小时刻度）与 0:00（跨日刻度）相邻冲突
    const base = new Date('2026-01-01T17:00:00Z').getTime();
    const hourlyData = Array.from({ length: 24 }, (_, i) => ({
      timestamp: base + i * 60 * 60 * 1000,
      temp: 10 + i
    }));

    controller.renderSimpleChart(hourlyData, 'chart-container', 'temp', '温度', '°C', '#ff6b6b');

    const html = document.getElementById('chart-container').innerHTML;
    expect(html).toContain('1/3 0:00');
    // 与跨日点过近的 23:00 常规刻度应被抑制，避免文字重叠
    expect(html).not.toContain('>23:00<');
  });

  test('温度图应附带逐小时天气标签', () => {
    document.body.innerHTML = '<div id="chart-container" style="width: 900px"></div>';
    window.matchMedia = jest.fn().mockReturnValue({ matches: false });

    const translations = {
      'charts.trend': '变化趋势',
      'charts.time': '时间',
      'weather.clear': '晴天',
      'weather.partlyCloudy': '少云',
      'weather.cloudy': '多云',
      'weather.overcast': '阴天',
      'weather.precipitation': '降水'
    };
    const controller = new ChartRenderController({
      i18n: { t: jest.fn((key) => translations[key] || key) },
      getConvertedTemp: (v) => v,
      getConvertedWindSpeed: (v) => v
    });

    const base = new Date('2026-01-01T00:00:00Z').getTime();
    const hourlyData = Array.from({ length: 24 }, (_, i) => ({
      timestamp: base + i * 60 * 60 * 1000,
      temp: 20 + i,
      cloudCover: i < 3 ? 5 : 80,
      precipitation: i === 6 ? 0.3 : 0
    }));

    controller.renderSimpleChart(hourlyData, 'chart-container', 'temp', '温度', '°C', '#ff6b6b');

    const strip = document.querySelector('.hourly-weather-strip');
    expect(strip).toBeTruthy();
    expect(strip.textContent).toContain('0:00');
    expect(strip.textContent).toContain('晴天');
    expect(strip.textContent).toContain('阴天');
    expect(strip.textContent).toContain('降水');
  });

  test('图表面板不应写死白底，亮色也应交给设计 token 控制', () => {
    document.body.innerHTML = '<div id="chart-container" style="width: 900px"></div>';
    window.matchMedia = jest.fn().mockReturnValue({ matches: false });

    const controller = new ChartRenderController({
      i18n: { t: jest.fn((key) => (key === 'charts.trend' ? '变化趋势' : key === 'charts.time' ? '时间' : '温度')) },
      getConvertedTemp: (v) => v,
      getConvertedWindSpeed: (v) => v
    });

    const base = new Date('2026-01-01T00:00:00Z').getTime();
    const hourlyData = Array.from({ length: 24 }, (_, i) => ({
      timestamp: base + i * 60 * 60 * 1000,
      temp: 20 + i
    }));

    controller.renderSimpleChart(hourlyData, 'chart-container', 'temp', '温度', '°C', '#ff6b6b');

    const panel = document.querySelector('.weather-chart-panel');
    expect(panel.getAttribute('style')).not.toContain('background: var(--color-card-bg)');
    expect(panel.getAttribute('style')).not.toContain('#ffffff');
    expect(panel.querySelector('h3').getAttribute('style')).toContain('var(--theme-text, var(--color-text))');
  });

  test('暗色主题图表应使用暗色网格和深色点描边，不 fallback 到亮色白底', () => {
    document.documentElement.dataset.theme = 'dark';
    document.body.dataset.theme = 'dark';
    document.body.innerHTML = '<div id="chart-container" style="width: 900px"></div>';
    window.matchMedia = jest.fn().mockReturnValue({ matches: false });

    const controller = new ChartRenderController({
      i18n: { t: jest.fn((key) => (key === 'charts.trend' ? '变化趋势' : key === 'charts.time' ? '时间' : '温度')) },
      getConvertedTemp: (v) => v,
      getConvertedWindSpeed: (v) => v
    });

    const base = new Date('2026-01-01T00:00:00Z').getTime();
    const hourlyData = Array.from({ length: 24 }, (_, i) => ({
      timestamp: base + i * 60 * 60 * 1000,
      temp: 20 + i
    }));

    controller.renderSimpleChart(hourlyData, 'chart-container', 'temp', '温度', '°C', '#ff6b6b');

    const svg = document.querySelector('#chart-container svg');
    expect(svg.innerHTML).toContain('stroke="rgba(255,255,255,0.26)"');
    expect(svg.innerHTML).toContain('stroke="rgba(18,28,52,0.95)"');
    expect(svg.innerHTML).not.toContain('#ffffff');

    delete document.documentElement.dataset.theme;
    delete document.body.dataset.theme;
  });

  test('移动端渲染应降采样并使用统一颜色变量', () => {
    document.body.innerHTML = '<div id="chart-container" style="width: 320px"></div>';
    window.matchMedia = jest.fn().mockReturnValue({ matches: true });

    const controller = new ChartRenderController({
      i18n: { t: jest.fn((key) => (key === 'charts.trend' ? '变化趋势' : key === 'charts.time' ? '时间' : '温度')) },
      getConvertedTemp: (v) => v,
      getConvertedWindSpeed: (v) => v
    });

    const base = new Date('2026-01-01T00:00:00Z').getTime();
    const hourlyData = Array.from({ length: 24 }, (_, i) => ({
      timestamp: base + i * 60 * 60 * 1000,
      temp: 20 + i
    }));

    controller.renderSimpleChart(hourlyData, 'chart-container', 'temp', '温度', '°C', '#ff6b6b');

    const svg = document.querySelector('#chart-container svg');
    const circles = svg.querySelectorAll('circle');

    expect(svg.innerHTML).toContain('fill="#333333"');
    expect(svg.innerHTML).toContain('stroke="rgba(122,101,84,0.18)"');
    expect(circles.length).toBeLessThan(24);
    expect(circles.length).toBeGreaterThanOrEqual(4);
  });

});
