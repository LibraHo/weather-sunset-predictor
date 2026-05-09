# Sunset Voyager

> 中文版本: [README.md](./README.md)

Sunset Voyager is a web app for sunrise, sunset, and fire-cloud glow prediction, powered primarily by **Open-Meteo**. It combines cloud layers, visibility, humidity, precipitation, solar geometry, and surrounding grid scores to produce explainable viewing recommendations.

## Data Strategy

- **Primary provider**: Open-Meteo
- **Default model**: `ecmwf_ifs025`
- **Model options**: `ecmwf_ifs025`, `gfs_seamless`, `best_match`
- **Windy**: emergency fallback only, disabled by default
- **Mainland China geocoding**: Gaode/AMap key is recommended for better city search

## Features

- Sunrise and sunset glow scoring with explanation
- 7-day overview and hourly weather charts
- Radar compass visualization with 8 directions and low/mid/high cloud rings
- Mainland China fire-cloud map, heatmap, and surrounding point recommendations
- Share cards, share map, photo upload, and admin tools
- Multi-language UI, dark mode, responsive layout, and RTL styles
- Agent API, visit counter, API applications, and API call logs

## Project Structure

```text
weather-sunset-predictor/
├── index.html                 # Frontend entry
├── src/                       # Frontend app
│   ├── components/            # UI components
│   ├── controllers/           # Page and business controllers
│   ├── locales/               # Localization files
│   ├── models/                # Frontend data models
│   └── services/              # Weather, prediction, map, and share services
├── styles/                    # Global, RTL, settings, and share styles
├── public/                    # Static pages, Leaflet, and local map data
├── server/                    # Express backend
│   ├── routes/                # weather / prediction / spots / photos APIs
│   ├── services/              # Providers, scoring, grid, photos, tokens
│   ├── middleware/            # Logging and auth
│   └── scripts/               # GFS processing scripts
├── tests/                     # unit / integration / property / e2e tests
├── docs/                      # Audits, design notes, migration, quality docs
├── deploy.sh                  # Production deployment script
└── server.py                  # Local frontend static server
```

## Local Development

### 1. Install dependencies

```bash
npm install
cd server && npm install && cd ..
```

### 2. Configure environment variables

```bash
cd server
cp .env.example .env
```

Minimum recommended config:

```env
PRIMARY_WEATHER_PROVIDER=openmeteo
GAODE_API_KEY=your_gaode_api_key_here
WINDY_MAP_API_KEY=your_windy_map_key

ENABLE_WINDY=false
ENABLE_WINDY_EMERGENCY_FALLBACK=false
WINDY_API_KEY=your_windy_point_forecast_key

SERVER_TOKEN_SECRET=change-me-in-production
API_TOKEN_STORAGE_PATH=/tmp/xiake/agent-tokens.json

PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:9002

RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 3. Run

```bash
# terminal A: backend
cd server && npm run dev

# terminal B: frontend static server
python3 server.py
```

Open:

- Frontend: `http://localhost:9002`
- Backend health: `http://localhost:3000/health`

## Common Commands

```bash
# unit/integration tests
npm test

# watch mode
npm run test:watch

# coverage
npm run test:coverage

# Playwright E2E
npm run test:e2e

# hardcoded Chinese i18n guard
npm run test:i18n-hardcoded-zh
```

## Key API

### `GET /api/weather/forecast`

Fetch weather forecast data.

Query params:

- `lat`: required latitude
- `lon`: required longitude
- `hours`: optional, default `168`
- `model`: optional, default `ecmwf_ifs025`

Example:

```bash
curl "http://localhost:3000/api/weather/forecast?lat=39.9&lon=116.4&hours=72&model=ecmwf_ifs025"
```

### Other Main Endpoints

- `/api/prediction`: fire-cloud prediction score
- `/api/spots`: Mainland China spot scores
- `/api/geocoding`: city search and geocoding
- `/api/photos`: shared photo upload and retrieval
- `/api/agent`: Agent API and token management
- `/api/admin`: Basic Auth protected admin APIs

See [server/api-docs.yaml](./server/api-docs.yaml) for more details.

## Deployment

Recommended from the repository root:

```bash
bash deploy.sh
```

Current script behavior:

1. Pull latest `origin/main`
2. Validate key entries in server `.env`
3. Append missing keys from `.env.example` without overriding existing values
4. Sync core frontend/backend files via `scp`
5. Restart backend and check `http://localhost:3000/health`

Manual fallback:

```bash
ssh -i ~/.ssh/id_ed25519 ubuntu@43.143.237.15
cd ~/weather-sunset-predictor

git pull origin main
npm install
cd server && npm install && cd ..

cd server
cp -n .env.example .env
# edit .env as needed; GAODE_API_KEY and SERVER_TOKEN_SECRET should be valid

sudo bash -c 'cd /home/ubuntu/weather-sunset-predictor/server && pkill -f "node index" || true && nohup node index.js > /tmp/ws-backend.log 2>&1 &'
curl -s http://localhost:3000/health
```

Notes:

- `server/.env` is server-only and must not be committed.
- Production must replace default secrets and admin passwords.
- If the backend was started by root, restart with `sudo`.
- Start with `/tmp/ws-backend.log` when checking production logs.

## Collaboration Workflow

- Use branch → PR → merge → deploy.
- Do not develop directly on `main`.
- Share the PR link immediately after pushing.
- For UI, i18n, prediction algorithm, or API-contract changes, run the relevant unit tests at minimum.

## License

MIT
