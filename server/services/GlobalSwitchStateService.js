'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_STATE = Object.freeze({
  siteClosed: false,
  weatherPredictionClosed: false,
  updatedAt: null
});

class GlobalSwitchStateService {
  constructor(options = {}) {
    this.filePath = options.filePath || process.env.GLOBAL_SWITCH_FILE || path.join(
      process.env.HOME || process.env.USERPROFILE || process.cwd(),
      '.xiake',
      'global-switches.json'
    );
    this._state = null;
  }

  getState() {
    if (!this._state) {
      this._state = this._readState();
    }
    return { ...this._state };
  }

  getPublicState() {
    const state = this.getState();
    return {
      ...state,
      shareMapAvailable: true,
      firecloudMapAvailable: true
    };
  }

  updateState(input = {}) {
    const current = this.getState();
    const next = {
      siteClosed: typeof input.siteClosed === 'boolean' ? input.siteClosed : current.siteClosed,
      weatherPredictionClosed: typeof input.weatherPredictionClosed === 'boolean'
        ? input.weatherPredictionClosed
        : current.weatherPredictionClosed,
      updatedAt: new Date().toISOString()
    };
    this._state = next;
    this._writeState(next);
    return { ...next };
  }

  isSiteClosed() {
    return this.getState().siteClosed;
  }

  isWeatherPredictionClosed() {
    return this.getState().weatherPredictionClosed;
  }

  buildWeatherPredictionUnavailable() {
    return {
      success: false,
      error: {
        code: 'WEATHER_PREDICTION_CLOSED',
        message: 'Weather prediction is temporarily unavailable. Please come back later.'
      },
      availability: this.getPublicState()
    };
  }

  buildSiteClosedHtml() {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Site temporarily unavailable</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: system-ui, -apple-system, Segoe UI, sans-serif; background: #f3eee4; color: #3d2b1f; }
    main { width: min(440px, calc(100% - 32px)); padding: 28px; border: 1px solid rgba(186,132,72,.20); border-radius: 12px; background: rgba(255,251,243,.92); box-shadow: 0 12px 34px rgba(96,58,12,.16); text-align: center; }
    h1 { margin: 0 0 8px; font-size: 22px; }
    p { margin: 0; color: #7a6554; line-height: 1.6; }
  </style>
</head>
<body><main><h1>站点暂时不可用</h1><p>请稍后再来。</p></main></body>
</html>`;
  }

  _readState() {
    try {
      if (!fs.existsSync(this.filePath)) return { ...DEFAULT_STATE };
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      return {
        siteClosed: parsed.siteClosed === true,
        weatherPredictionClosed: parsed.weatherPredictionClosed === true,
        updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null
      };
    } catch (error) {
      return { ...DEFAULT_STATE };
    }
  }

  _writeState(state) {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(state, null, 2));
  }
}

module.exports = GlobalSwitchStateService;
