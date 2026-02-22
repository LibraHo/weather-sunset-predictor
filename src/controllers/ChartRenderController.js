class ChartRenderController {
  constructor({ i18n, getConvertedTemp, getConvertedWindSpeed }) {
    this.i18n = i18n;
    this.getConvertedTemp = getConvertedTemp;
    this.getConvertedWindSpeed = getConvertedWindSpeed;
  }

  createChartService(tempUnit, windUnit) {
    return {
      renderTemperatureChart: (data, id) => {
        const unit = tempUnit === 'fahrenheit' ? '°F' : '°C';
        return this.renderSimpleChart(data, id, 'temp', this.i18n.t('weather.temperature'), unit, '#ff6b6b');
      },
      renderPrecipitationChart: (data, id) => this.renderSimpleChart(data, id, 'precipitation', this.i18n.t('weather.precipitation'), 'mm', '#4dabf7'),
      renderHumidityChart: (data, id) => this.renderSimpleChart(data, id, 'humidity', this.i18n.t('weather.humidity'), '%', '#51cf66'),
      renderWindChart: (data, id) => {
        const unit = windUnit === 'ms' ? 'm/s' : 'km/h';
        return this.renderSimpleChart(data, id, 'windSpeed', this.i18n.t('weather.windSpeed'), unit, '#748ffc');
      },
      renderPressureChart: (data, id) => this.renderSimpleChart(data, id, 'pressure', this.i18n.t('weather.pressure'), 'hPa', '#ffa94d'),
      renderCloudChart: (data, id) => this.renderSimpleChart(data, id, 'cloudCover', this.i18n.t('weather.cloudCover'), '%', '#868e96')
    };
  }

  renderParameterChart(hourlyData, parameter, chartService) {
    const containerId = 'chart-container';

    if (!chartService) {
      console.warn('[ChartRenderController] ChartService 未初始化');
      return;
    }

    switch (parameter) {
      case 'temp':
        chartService.renderTemperatureChart(hourlyData, containerId);
        break;
      case 'precip':
        chartService.renderPrecipitationChart(hourlyData, containerId);
        break;
      case 'humidity':
        chartService.renderHumidityChart(hourlyData, containerId);
        break;
      case 'wind':
        chartService.renderWindChart(hourlyData, containerId);
        break;
      case 'pressure':
        chartService.renderPressureChart(hourlyData, containerId);
        break;
      case 'clouds':
        chartService.renderCloudChart(hourlyData, containerId);
        break;
      default:
        console.error(`[ChartRenderController] 未知的参数类型: ${parameter}`);
    }
  }

  renderSimpleChart(hourlyData, containerId, param, label, unit, color) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const getConvertedValue = (value, chartParam) => {
      if (chartParam === 'temp') {
        return this.getConvertedTemp(value);
      }
      if (chartParam === 'windSpeed') {
        return this.getConvertedWindSpeed(value);
      }
      return value;
    };

    const values = hourlyData.map(d => getConvertedValue(d[param], param));
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const containerWidth = container.clientWidth || 900;
    const chartWidth = isMobile ? Math.max(containerWidth - 8, 320) : 900;
    const chartHeight = isMobile ? 240 : 280;
    const padding = isMobile
      ? { top: 36, right: 20, bottom: 52, left: 60 }
      : { top: 50, right: 50, bottom: 70, left: 90 };
    const contentWidth = chartWidth - padding.left - padding.right;
    const contentHeight = chartHeight - padding.top - padding.bottom;

    const points = hourlyData.map((d, i) => {
      const value = getConvertedValue(d[param], param);
      const time = new Date(d.timestamp);
      const x = padding.left + (i / (hourlyData.length - 1)) * contentWidth;
      const y = padding.top + contentHeight - ((value - min) / range) * contentHeight;
      return {
        x,
        y,
        value,
        hour: time.getHours(),
        month: time.getMonth() + 1,
        day: time.getDate()
      };
    });

    const pathData = points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');

    const titleFontSize = isMobile ? '1.1rem' : '1.5rem';
    const chartPadding = isMobile ? '12px' : '25px';
    const axisFontSize = isMobile ? 11 : 13;

    let html = `<div style="padding: ${chartPadding}; background: var(--color-card-bg); border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin: 12px 0;">`;
    html += `<h3 style="text-align: center; margin-bottom: 16px; color: ${color}; font-size: ${titleFontSize};">${label}${this.i18n.t('charts.trend')}</h3>`;
    html += '<div>';
    html += `<svg width="100%" viewBox="0 0 ${chartWidth} ${chartHeight}" style="display: block;">`;

    for (let i = 0; i <= 5; i++) {
      const value = min + (range * i) / 5;
      const y = padding.top + contentHeight - (i / 5) * contentHeight;
      html += `<line x1="${padding.left}" y1="${y}" x2="${chartWidth - padding.right}" y2="${y}" stroke="var(--color-text-light)" stroke-width="1.5" stroke-dasharray="5,5" stroke-opacity="0.3"/>`;
      html += `<text x="${padding.left - 10}" y="${y + 5}" font-size="${axisFontSize}" fill="var(--color-text)" text-anchor="end" font-weight="500">${value.toFixed(1)} ${unit}</text>`;
    }

    points.forEach((p, i) => {
      if (i % 3 === 0) {
        const prev = points[i - 1];
        const isDayBoundary = !prev || prev.day !== p.day || prev.month !== p.month;
        const axisText = isDayBoundary
          ? `${p.month}/${p.day} ${p.hour}:00`
          : `${p.hour}:00`;
        html += `<text x="${p.x}" y="${chartHeight - padding.bottom + 25}" font-size="${axisFontSize}" fill="var(--color-text)" text-anchor="middle" font-weight="500">${axisText}</text>`;
      }
    });

    html += `<path d="${pathData}" fill="none" stroke="${color}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`;

    points.forEach((p, i) => {
      html += `<circle cx="${p.x}" cy="${p.y}" r="6" fill="${color}" stroke="var(--color-card-bg)" stroke-width="2.5"/>`;
      if (i % 3 === 0) {
        html += `<text x="${p.x}" y="${p.y - 12}" font-size="${isMobile ? 10 : 12}" fill="${color}" text-anchor="middle" font-weight="700">${p.value.toFixed(1)}</text>`;
      }
    });

    html += `<text x="${chartWidth / 2}" y="${chartHeight - 15}" font-size="${isMobile ? 12 : 14}" fill="var(--color-text-light)" text-anchor="middle" font-weight="600">${this.i18n.t('charts.time')}</text>`;
    if (!isMobile) {
      html += `<text x="35" y="${chartHeight / 2}" font-size="14" fill="var(--color-text-light)" text-anchor="middle" transform="rotate(-90, 35, ${chartHeight / 2})" font-weight="600">${label} (${unit})</text>`;
    }

    html += '</svg>';
    html += '</div>';
    html += '</div>';

    container.innerHTML = html;
  }
}

export default ChartRenderController;
