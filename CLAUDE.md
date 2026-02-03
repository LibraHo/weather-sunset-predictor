# CLAUDE.md

## Project Overview

Weather Sunset Predictor (天气晚霞预测器) is a web application that predicts sunset/sunrise cloud formations (fire clouds / 火烧云) based on real-time weather data from the Windy API. It features location selection, real-time weather display, multi-factor sunset quality prediction, multi-language support (10 languages), and responsive design for desktop and mobile.

## Architecture

**3-tier architecture:**

1. **Frontend (Browser)** — Pure ES6 modules in `src/`, served as static files. MVC pattern with Services layer.
2. **Backend Proxy (Node.js)** — Express server in `server/` that proxies Windy API calls to protect API keys.
3. **Python Services** — Optional GFS weather data processing (`server/scripts/requirements.txt` lists xarray, cfgrib, numpy, Pillow).

## Directory Structure

```
weather-sunset-predictor/
├── src/                        # Frontend source (ES6 modules)
│   ├── app.js                  # Entry point - initializes all services/controllers
│   ├── i18n.js                 # Internationalization singleton
│   ├── components/             # UI components (LanguageSelector, SettingsPanel)
│   ├── controllers/            # App, Weather, Prediction controllers
│   ├── models/                 # Data models (Location, WeatherData, SunsetPrediction)
│   ├── services/               # Business logic (18 services including Mock variants)
│   ├── locales/                # Translation files (10 languages)
│   └── utils/                  # ErrorHandler, GlobalErrorBoundary, UnitConverter
├── server/                     # Backend Node.js server (CommonJS)
│   ├── index.js                # Express server entry point
│   ├── routes/                 # API endpoints (weather.js, firecloud.js)
│   ├── services/               # Windy API proxy service
│   ├── middleware/              # HTTP logging middleware
│   └── .env.example            # Environment variables template
├── styles/                     # CSS (main.css, rtl.css, settings-panel.css)
├── tests/                      # All test suites
│   ├── unit/                   # Jest unit tests (controllers, models, services, utils)
│   ├── integration/            # Jest integration tests
│   ├── property/               # fast-check property-based tests
│   └── e2e/                    # Playwright E2E tests
├── index.html                  # Main HTML entry point
├── server.py                   # Python dev server (port 9002)
├── config.api.js               # API mode config (proxy vs direct)
├── package.json                # Frontend deps & test scripts
├── jest.config.js              # Jest configuration
├── babel.config.js             # Babel for Jest ES6 module support
└── playwright.config.js        # Playwright E2E config
```

## Build & Run Commands

### Frontend Development Server

```bash
python server.py               # Starts dev server on port 9002
# or
npx http-server . -p 8080 -c-1 # Alternative HTTP server
```

### Backend Server

```bash
cd server && npm install        # Install backend dependencies
cd server && npm run dev        # Start with nodemon (dev, port 3000)
cd server && npm start          # Start production server
```

### Running Tests

```bash
# Unit + Integration + Property tests (Jest)
npm test                        # Run all Jest tests
npm run test:watch              # Watch mode
npm run test:coverage           # With coverage report

# E2E tests (Playwright)
npm run test:e2e                # Run all E2E tests
npm run test:e2e:headed         # Run with visible browser
npm run test:e2e:debug          # Debug mode
npm run test:e2e:ui             # Interactive UI mode
npm run test:e2e:report         # View last test report
```

**Note:** Jest requires the `--experimental-vm-modules` flag (already configured in package.json scripts) because the project uses ES6 modules (`"type": "module"`).

### Installing Dependencies

```bash
npm install                     # Frontend/test dependencies (root)
cd server && npm install        # Backend dependencies
```

## Test Configuration

- **Jest** (`jest.config.js`): jsdom environment, babel-jest transform, module path aliases (`@/`, `@models/`, `@services/`, `@controllers/`, `@utils/`, `@components/`, `@locales/`)
- **Coverage thresholds**: 75% branches, 90% functions, 80% lines, 80% statements
- **Playwright** (`playwright.config.js`): Tests against Chromium, Firefox, WebKit, Mobile Chrome (Pixel 5), Mobile Safari (iPhone 12). Base URL `http://localhost:8080`. Auto-starts HTTP server.
- **Property tests**: Use `fast-check` library for invariant validation

## Code Conventions

### Module System
- **Frontend**: ES6 modules (`import`/`export`). File extension `.js` required in import paths.
- **Backend** (`server/`): CommonJS (`require`/`module.exports`). The server has its own `package.json` without `"type": "module"`.

### Naming
- **camelCase** for variables, functions, methods, properties
- **PascalCase** for class names (e.g., `WindyAPIService`, `WeatherData`)
- **UPPER_CASE** for constants (e.g., `USE_MOCK_API`, `PORT`)
- **File names**: PascalCase for classes (`WindyAPIService.js`), camelCase for non-class modules (`weather.js` in routes)

### Class Patterns
- **Models**: Simple data containers with validation methods (`isValid()`, `toJSON()`, static `fromJSON()`)
- **Services**: Stateful classes with constructor config, public API methods, and private helpers. Each service has a focused responsibility.
- **Controllers**: Orchestrator classes with dependency injection via constructor. Event handler methods prefixed with `handle*`. UI methods use `show*`/`hide*` pattern.
- **Utilities**: Static-only classes (no instantiation), e.g., `ErrorHandler`

### Exports
- **Default exports** are used throughout (`export default ClassName`)
- The `i18n.js` exports a singleton instance
- `config.api.js` exports both named and default

### Comments & Documentation
- **JSDoc** blocks on all public methods with `@param`, `@returns`, `@throws`
- Requirement traceability comments linking to spec (e.g., `// 需求：5.1`)
- Section dividers in large files: `// ========== Section Name ==========`
- Console log messages prefixed with service name: `[WindyAPIService]`, `[AppController]`

### Error Handling
- Centralized through `ErrorHandler` utility class with error type classification (9 types: API, NETWORK, VALIDATION, GEOCODING, STORAGE, CONFIG, RENDER, NOTIFICATION, UNKNOWN)
- Services throw descriptive errors; controllers catch and route to `ErrorHandler.handleError()`
- User-facing error messages are in Chinese
- Soft validation in models (returns boolean, never throws)

### Internationalization
- 10 languages: zh-CN, zh-TW, en-US, ja-JP, ko-KR, vi-VN, fr-FR, es-ES, it-IT, ar-SA
- Translation keys use dot notation: `app.title`, `weather.temperature`
- Parameter interpolation: `{{paramName}}` syntax
- RTL support for Arabic (`ar-SA`)
- Singleton `i18n` instance with `t()` method for translations
- Locale files in `src/locales/` (one file per language)

## API Configuration

The app supports two API access modes configured in `config.api.js`:

- **`proxy` mode** (default, recommended): Frontend calls the backend Express server (port 3000), which proxies to Windy API. API keys stay server-side.
- **`direct` mode**: Frontend calls Windy API directly (requires API key in frontend config).

### Environment Variables (server/.env)

```
WINDY_API_KEY=<point_forecast_key>
WINDY_MAP_API_KEY=<map_api_key>
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:9002
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Backend API Endpoints

- `GET /health` — Health check
- `GET /api/weather/forecast?lat=&lon=&hours=` — Proxied weather forecast
- `GET /api/config/map-key` — Map API key for frontend
- `/api/firecloud/*` — Fire cloud overlay endpoints

## Key Files to Know

| File | Purpose |
|------|---------|
| `src/app.js` | Application entry point, service instantiation, initialization |
| `src/i18n.js` | I18n singleton with language detection, translation, formatting |
| `src/services/WindyAPIService.js` | Windy Point Forecast API client (proxy + direct modes) |
| `src/services/SunsetPredictionService.js` | Multi-factor sunset quality prediction algorithm |
| `src/services/EnhancedSunsetPredictionService.js` | Advanced prediction with cloud layers, golden/blue hour |
| `src/controllers/AppController.js` | Main UI orchestrator (~1700 lines), manages all user interactions |
| `src/utils/ErrorHandler.js` | Centralized error classification and handling |
| `server/index.js` | Express server setup with middleware stack |
| `config.api.js` | API mode configuration (proxy vs direct) |
| `index.html` | Main HTML page |

## Mock Services (Offline Development)

The project includes mock implementations for offline development and testing:

- `MockWindyAPIService.js` — Returns realistic simulated weather data
- `MockGeocodingService.js` — Supports 50+ preset city names
- `MockWindyMapService.js` — Simulates map interactions

Toggle with `USE_MOCK_API` flag in `src/app.js`. Mock services are used in Jest tests.

## Things to Watch Out For

- **No build step**: Frontend uses raw ES6 modules loaded by the browser. No bundler (webpack/vite/etc.).
- **Two package.json files**: Root (frontend + testing) and `server/` (backend). They have different module systems.
- **Coverage thresholds are enforced**: Jest will fail if coverage drops below 75% branches / 90% functions / 80% lines.
- **Chinese comments and error messages**: Much of the codebase uses Chinese for user-facing strings and code comments. The design docs and requirements are in Chinese.
- **Sensitive files**: `config.json` and `.env` are gitignored. Never commit API keys.
- **Large controller**: `AppController.js` is ~1700 lines. Changes here should be careful and targeted.
- **E2E tests start their own server**: Playwright config auto-starts `npx http-server . -p 8080` — don't conflict with this port.
- **Python server uses port 9002**, backend uses **port 3000**, Playwright E2E uses **port 8080**.
