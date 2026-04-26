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

    const values = hourlyData.map((d) => getConvertedValue(d[param], param));
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const containerWidth = container.clientWidth || 900;
    const chartWidth = isMobile ? Math.max(containerWidth - 8, 320) : 900;
    const chartHeight = isMobile ? 240 : 280;
    const padding = isMobile
      ? { top: 36, right: 20, bottom: 52, left: 72 }
      : { top: 50, right: 50, bottom: 70, left: 122 };
    const contentWidth = chartWidth - padding.left - padding.right;
    const contentHeight = chartHeight - padding.top - padding.bottom;

    const effectiveMaxDataPoints = isMobile
      ? Math.max(10, Math.floor(contentWidth / 64))
      : hourlyData.length;
    const sampleStep = isMobile
      ? Math.max(1, Math.ceil(hourlyData.length / effectiveMaxDataPoints))
      : 1;

    const dataPointStep = isMobile ? Math.max(2, sampleStep * 2) : Math.max(1, Math.round(sampleStep * 1.5));

    const getTimeParts = (timestamp, timezone) => {
      const time = new Date(timestamp);
      if (timezone) {
        const parts = new Intl.DateTimeFormat('en-US', {
          timeZone: timezone,
          hour: '2-digit',
          day: '2-digit',
          month: '2-digit',
          hour12: false
        }).formatToParts(time);
        const pick = (type) => Number(parts.find(p => p.type === type)?.value);
        return { hour: pick('hour'), day: pick('day'), month: pick('month') };
      }
      return {
        hour: time.getHours(),
        month: time.getMonth() + 1,
        day: time.getDate()
      };
    };

    const points = hourlyData.map((d, i) => {
      const value = getConvertedValue(d[param], param);
      const x = padding.left + (i / (hourlyData.length - 1)) * contentWidth;
      const y = padding.top + contentHeight - ((value - min) / range) * contentHeight;
      const t = getTimeParts(d.timestamp, d.timezone);
      return {
        x,
        y,
        value,
        hour: t.hour,
        month: t.month,
        day: t.day,
        idx: i
      };
    });

    const renderPoints = isMobile
      ? points.filter((p) => p.idx % sampleStep === 0 || p.idx === points.length - 1)
      : points;

    const pathData = renderPoints.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');

    const titleFontSize = isMobile ? '1.1rem' : '1.5rem';
    const chartPadding = isMobile ? '12px' : '25px';
    const axisFontSize = isMobile ? 11 : 13;
    const rootStyle = getComputedStyle(document.documentElement);
    const bodyStyle = getComputedStyle(document.body);
    const resolveCssVar = (name, fallback) => (rootStyle.getPropertyValue(name) || bodyStyle.getPropertyValue(name) || fallback).trim();
    const actualTheme = document.documentElement.dataset.actualTheme || document.documentElement.dataset.theme || '';
    const isDarkTheme = document.body.classList.contains('theme-dark')
      || document.documentElement.classList.contains('theme-dark')
      || actualTheme === 'dark';
    const gridColor = resolveCssVar('--chart-grid-color', isDarkTheme ? 'rgba(255,255,255,0.38)' : 'rgba(51,51,51,0.18)');
    const textColor = resolveCssVar('--color-text', isDarkTheme ? 'rgba(255,255,255,0.92)' : '#333333');
    const cardBg = resolveCssVar('--color-card-bg', isDarkTheme ? 'rgba(15,22,40,0.85)' : '#ffffff');
    const pointStroke = isDarkTheme ? 'rgba(15,22,40,0.95)' : cardBg;

    let html = `<div class="weather-chart-panel" style="padding: ${chartPadding}; background: var(--color-card-bg); border-radius: 12px; margin: 12px 0;">`;
    html += `<h3 style="text-align: center; margin-bottom: 16px; color: var(--color-text); font-size: ${titleFontSize};">${label}${this.i18n.t('charts.trend')} (${unit})</h3>`;
    html += '<div>';
    html += `<svg width="100%" viewBox="0 0 ${chartWidth} ${chartHeight}" style="display: block;">`;

    for (let i = 0; i <= 5; i++) {
      const value = min + (range * i) / 5;
      const y = padding.top + contentHeight - (i / 5) * contentHeight;
      html += `<line x1="${padding.left}" y1="${y}" x2="${chartWidth - padding.right}" y2="${y}" stroke="${gridColor}" stroke-width="${isDarkTheme ? 1.35 : 1}" stroke-dasharray="4 6" />`;
      html += `<text x="${padding.left - 10}" y="${y + 4}" font-size="${axisFontSize}" fill="${textColor}" text-anchor="end" font-weight="500">${value.toFixed(1)}</text>`;
    }

    const tickCandidates = points
      .map((p, i) => {
        const prev = points[i - 1];
        const isDayBoundary = !prev || prev.day !== p.day || prev.month !== p.month;
        const isRegularTick = i % dataPointStep === 0;

        if (!isRegularTick && !isDayBoundary) {
          return null;
        }

        return {
          ...p,
          i,
          isDayBoundary,
          priority: isDayBoundary ? 2 : 1,
          label: isDayBoundary ? `${p.month}/${p.day} ${p.hour}:00` : `${p.hour}:00`
        };
      })
      .filter(Boolean);

    const minTickGap = isMobile ? 44 : 54;
    const selectedTicks = [];

    tickCandidates.forEach((candidate) => {
      const last = selectedTicks[selectedTicks.length - 1];

      if (!last || (candidate.x - last.x) >= minTickGap) {
        selectedTicks.push(candidate);
        return;
      }

      if (candidate.priority > last.priority) {
        selectedTicks[selectedTicks.length - 1] = candidate;
      }
    });

    selectedTicks.forEach((tick) => {
      html += `<text x="${tick.x}" y="${chartHeight - padding.bottom + 25}" font-size="${axisFontSize}" fill="${textColor}" text-anchor="middle" font-weight="500">${tick.label}</text>`;
    });

    html += `<path d="${pathData}" fill="none" stroke="${color}" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>`;

    renderPoints.forEach((p, i) => {
      html += `<circle cx="${p.x}" cy="${p.y}" r="${isMobile ? 2.8 : 3.2}" fill="${color}" stroke="${pointStroke}" stroke-width="${isMobile ? 1.1 : 1.4}"/>`;
      if (i % (isMobile ? 2 : 1) === 0) {
        html += `<text x="${p.x}" y="${p.y - 10}" font-size="${isMobile ? 10 : 12}" fill="${textColor}" text-anchor="middle" font-weight="600">${p.value.toFixed(1)}</text>`;
      }
    });

    html += `<text x="${chartWidth / 2}" y="${chartHeight - 15}" font-size="${isMobile ? 12 : 14}" fill="${textColor}" text-anchor="middle" font-weight="600">${this.i18n.t('charts.time')}</text>`;
    if (!isMobile) {
      html += `<text x="20" y="${chartHeight / 2}" font-size="12" fill="${textColor}" text-anchor="middle" transform="rotate(-90, 20, ${chartHeight / 2})" font-weight="600">${label} (${unit})</text>`;
    }

    html += '</svg>';
    html += '</div>';
    html += '</div>';

    container.innerHTML = html;
  }
}

export default ChartRenderController;
