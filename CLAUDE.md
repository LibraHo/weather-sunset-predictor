# CLAUDE.md

## Project Overview

Weather Sunset Predictor (天气晚霞预测器) is a web application that predicts sunset/sunrise cloud formations (fire clouds / 火烧云) based on real-time weather data from the Windy API. It features location selection, real-time weather display, multi-factor sunset quality prediction, multi-language support (10 languages), and responsive design for desktop and mobile.

## Specification Documents (.kiro/)

The project has detailed specification documents under `.kiro/specs/weather-sunset-predictor/`. **Always consult these before making significant changes:**

| File | Purpose |
|------|---------|
| `requirements.md` | Product requirements with acceptance criteria (20 requirements, all in Chinese) |
| `design.md` | Architecture diagrams, design decisions, algorithm details, data flow |
| `tasks.md` | Implementation task breakdown with completion status |

### Requirements Summary (需求)

| # | Requirement | Status |
|---|-------------|--------|
| 1 | API Key Management (API密钥管理) | Done |
| 2 | Location Selection (位置选择) | Done |
| 3 | Weather Data Fetching (天气数据获取) | Done |
| 4 | Basic Weather Display (基本天气显示) | Done |
| 5 | Fire Cloud Prediction Algorithm (火烧云预测算法) | Done |
| 6 | Prediction Result Display (预测结果展示) | Done |
| 7 | Future Prediction Timeline (未来预测时间线) | Done |
| 8 | Responsive Design (响应式设计) | Done |
| 9 | Data Refresh (数据刷新) | Done |
| 10 | Error Handling (错误处理) | Done |
| 11 | Weather UI Enhancement (天气界面优化) — 7-day overview, 24h charts | Done |
| 12 | Sunrise/Sunset Prediction Enhancement (朝霞晚霞预测增强) — golden hour, blue hour, cloud layers, notifications, favorites | Done |
| 13 | Recent Search History (最近搜索历史) — LRU 5 items | Done |
| 14 | Multi-language Support (多语言支持) — 10 languages, RTL | Done |
| 15 | Backend Proxy for Windy API (后端代理) — key protection | Done |
| 16 | Unified Settings Panel (统一设置面板) | Done |
| 17 | Personalization (个性化设置) — units, theme, default location | Done |
| 18 | Windy Map Forecast API Integration (地图预测) | Done |
| 19 | Surrounding Fire Cloud Visualization (周边火烧云可视化) — radar chart | Done |
| 20 | Fire Cloud Map Overlay (火烧云地图覆盖层) — GFS data, heatmap | Phase 1 Done (frontend Canvas); Phase 2 pending (backend Python GFS) |
| 21 | UI Glassmorphism Effect (UI毛玻璃效果) — backdrop-filter blur on cards, header, modals | Done |
| 22 | Frontend-Backend Separation (前后端分离) — migrate prediction algorithms to backend, support multi-platform clients | Planned (5 phases) |

### Key Design Decisions (from design.md)

- **Prediction algorithm**: Weighted multi-factor scoring (cloud cover 30-70% optimal, humidity 30-70%, visibility, low cloud penalty). Gaussian scoring curves. Quality grades: excellent (>70), good (40-70), fair (<40).
- **Cloud layer analysis**: High clouds (>6km), mid clouds (2-6km), low clouds (<2km) — each has different impact on fire clouds.
- **Surrounding points**: 8-direction sampling (N/NE/E/SE/S/SW/W/NW) at configurable radius (50/100/150 km), parallel API calls via `Promise.all`.
- **Fire cloud overlay**: Phase 1 uses frontend Canvas with existing Windy data. Phase 2 planned: backend Python (xarray+cfgrib) processing NOAA GFS GRIB2 data with "light path tracing + cloud scoring" algorithm.
- **Theme system**: CSS custom properties with `data-theme` attribute. Three modes: light, dark, auto (follows system `prefers-color-scheme`).
- **Unit conversion**: Applied at render layer only — raw data stays in metric (Celsius, m/s). `UnitConverter` utility class handles conversions.
- **Settings panel**: Modal-based, grouped sections (data source, notifications, language, personalization). Changes save immediately to localStorage.
- **Glassmorphism**: CSS Variables (`--glass-bg`, `--glass-blur`, etc.) drive semi-transparent backgrounds + `backdrop-filter: blur()`. `@supports` for graceful degradation. Reduced blur on mobile for performance.
- **Frontend-Backend Separation (Planned)**: Migrate prediction algorithms (`SunsetPredictionService`, `EnhancedSunsetPredictionService`) to backend. New APIs: `POST /api/prediction/calculate`, `POST /api/prediction/surrounding`, `POST /api/prediction/enhanced`, `POST /api/prediction/batch`. Benefits: multi-platform client support, backend caching, A/B testing, reduced frontend code (-1300 lines).

## Architecture

**3-tier architecture:**

1. **Frontend (Browser)** — Pure ES6 modules in `src/`, served as static files. MVC pattern with Services layer.
2. **Backend Proxy (Node.js)** — Express server in `server/` that proxies Windy API calls to protect API keys.
3. **Python Services** — Optional GFS weather data processing (`server/scripts/requirements.txt` lists xarray, cfgrib, numpy, Pillow).

### Data Flow

```
User action → AppController → WeatherController/PredictionController
  → WindyAPIService (proxy mode) → Backend Express → Windy API
  → WeatherData model → SunsetPredictionService → SunsetPrediction model → UI render
```

For fire cloud overlay (Phase 2):
```
Frontend request → /api/firecloud/overlay → Node.js → child_process.spawn(Python)
  → gfs_processor.py → NOAA GFS GRIB2 download → xarray parse → PNG generation → response
```

For prediction APIs (Planned - Requirement 22):
```
Frontend request → /api/prediction/calculate → Node.js PredictionService
  → SunCalculator + GaussianScore → prediction result JSON → response

Frontend request → /api/prediction/surrounding → Node.js SurroundingService
  → 8 parallel weather fetches → 8 predictions → aggregated result → response
```

### Planned Backend API Endpoints (Requirement 22)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/prediction/calculate` | POST | Single point prediction |
| `/api/prediction/surrounding` | POST | 8-direction aggregated predictions |
| `/api/prediction/enhanced` | POST | Enhanced prediction with canvas/lightpath scoring |
| `/api/prediction/batch` | POST | Multi-day batch predictions |

## Directory Structure

```
weather-sunset-predictor/
├── .kiro/specs/                # Project specifications (requirements, design, tasks)
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
│   ├── routes/                 # API endpoints (weather.js, firecloud.js, prediction.js[planned])
│   ├── services/               # Windy API proxy + prediction services (PredictionService.js[planned])
│   ├── utils/                  # Backend utilities (已实现)
│   │   ├── SunCalculator.js    # 日出日落计算 (NOAA算法) ✅
│   │   └── GaussianScore.js    # 高斯评分函数 ✅
│   ├── middleware/             # HTTP logging middleware
│   ├── scripts/                # Python scripts (gfs_processor.py, requirements.txt)
│   └── .env.example            # Environment variables template
├── styles/                     # CSS (main.css, rtl.css, settings-panel.css)
├── tests/                      # All test suites
│   ├── unit/                   # Jest unit tests (controllers, models, services, utils)
│   │   └── server/             # Backend unit tests (67 tests) ✅
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
- **Models**: Simple data containers with validation methods (`isValid()`, `toJSON()`, static `fromJSON()`). Soft validation (returns boolean, never throws).
- **Services**: Stateful classes with constructor config, public API methods, and private helpers. Each service has a focused responsibility.
- **Controllers**: Orchestrator classes with dependency injection via constructor. Event handler methods prefixed with `handle*`. UI methods use `show*`/`hide*` pattern.
- **Utilities**: Static-only classes (no instantiation), e.g., `ErrorHandler`, `UnitConverter`

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
- RTL support for Arabic (`ar-SA`) via `styles/rtl.css`
- Singleton `i18n` instance with `t()` method for translations
- Locale files in `src/locales/` (one file per language)
- Formatting methods: `formatDate()`, `formatTime()`, `formatNumber()`, `formatPercent()` — all locale-aware via `Intl` API

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
- `GET /api/weather/forecast?lat=&lon=&hours=` — Proxied weather forecast (default 168 hours / 7 days)
- `GET /api/config/map-key` — Map API key for frontend
- `GET /api/firecloud/overlay?lat=&lon=&radius=&type=` — Fire cloud overlay (Phase 2, calls Python GFS processor)

## Key Files to Know

| File | Purpose |
|------|---------|
| `src/app.js` | Application entry point, service instantiation, `USE_MOCK_API` flag |
| `src/i18n.js` | I18n singleton with language detection, translation, formatting |
| `src/services/WindyAPIService.js` | Windy Point Forecast API client (proxy + direct modes) |
| `src/services/SunsetPredictionService.js` | Multi-factor sunset quality prediction algorithm |
| `src/services/EnhancedSunsetPredictionService.js` | Advanced prediction with cloud layers, golden/blue hour |
| `src/services/SurroundingPointsService.js` | 8-direction surrounding area weather sampling |
| `src/services/RadarChartService.js` | Canvas radar chart for surrounding fire cloud visualization |
| `src/services/FireCloudOverlayService.js` | Heatmap overlay generation for Windy map |
| `src/services/WindyMapService.js` | Windy Map Forecast API integration (Leaflet-based) |
| `src/services/ThemeService.js` | Dark/light/auto theme management |
| `src/services/StorageService.js` | localStorage wrapper for preferences, cache, history, favorites |
| `src/services/NotificationService.js` | Browser notification for high-quality predictions |
| `src/utils/UnitConverter.js` | Temperature (°C/°F) and wind speed (m/s, km/h) conversion |
| `src/controllers/AppController.js` | Main UI orchestrator (~1700 lines), manages all user interactions |
| `src/controllers/WeatherController.js` | Weather data fetching, map, charts, overlay management |
| `src/controllers/PredictionController.js` | Sunrise/sunset prediction display, cloud layer rendering |
| `src/utils/ErrorHandler.js` | Centralized error classification and handling |
| `src/components/SettingsPanel.js` | Unified settings modal (data source, notifications, language, personalization) |
| `src/components/LanguageSelector.js` | Language switching dropdown |
| `server/index.js` | Express server setup with middleware stack |
| `server/routes/weather.js` | Weather forecast proxy endpoint |
| `server/routes/firecloud.js` | Fire cloud overlay endpoint (calls Python) |
| `server/utils/SunCalculator.js` | 日出日落计算工具 (NOAA算法) — getSunsetTime, getSunriseTime, getGoldenHour, getBlueHour ✅ |
| `server/utils/GaussianScore.js` | 高斯评分函数工具 — scoreCloudCover, scoreHumidity, scoreVisibility, scoreLowClouds ✅ |
| `server/scripts/gfs_processor.py` | Python GFS GRIB2 data processing and PNG generation |
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
- **Requirement traceability**: Code comments reference requirements by number (e.g., `// 需求：5.1`). When modifying code, check which requirement it maps to in `.kiro/specs/weather-sunset-predictor/requirements.md`.
- **Phase 2 GFS backend not yet implemented**: The fire cloud overlay currently uses frontend-only Canvas rendering. The Python GFS processing pipeline (`server/scripts/gfs_processor.py`) and its API endpoint (`/api/firecloud/overlay`) are scaffolded but not production-ready.
- **Windy Map API licensing**: Testing environment must use Testing API keys; production requires Professional license per Windy terms.
