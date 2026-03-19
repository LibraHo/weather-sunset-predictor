# Sunset Voyager

> 中文说明: [README.md](./README.md)

A web app for sunrise/sunset glow prediction, powered by **Open-Meteo**.

Current data strategy:
- **Primary provider**: Open-Meteo
- **Default model**: `ecmwf_ifs025`
- **Model options**: `ecmwf_ifs025`, `gfs_seamless`, `best_match`
- **Windy**: emergency fallback only (disabled by default)

---

## Features

- Sunrise / sunset glow score prediction
- 7-day overview + hourly forecast
- Radar compass visualization (8 directions, low/mid/high cloud rings)
- Weather model switch in Settings panel
- Consistent data-source labels across UI
- Multi-language + dark mode + responsive layout

---

## Local Development

### 1) Install dependencies

```bash
npm install
cd server && npm install && cd ..
```

### 2) Configure environment variables

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

PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:9002
```

### 3) Run

```bash
# terminal A
cd server && npm run dev

# terminal B
python3 server.py
```

Open:
- Frontend: `http://localhost:9002`
- Backend health: `http://localhost:3000/health`

---

## Key API

### `GET /api/weather/forecast`

Query params:
- `lat` (required)
- `lon` (required)
- `hours` (optional, default `168`)
- `model` (optional, default `ecmwf_ifs025`)

Example:

```bash
curl "http://localhost:3000/api/weather/forecast?lat=39.9&lon=116.4&hours=72&model=ecmwf_ifs025"
```

---

## Deployment (Updated)

### A) Recommended: `deploy.sh`

```bash
bash deploy.sh
```

Current script behavior:
1. Pull latest `main`
2. Validate key entries in server `.env`
3. Append missing keys from `.env.example` (without overriding existing values)
4. Sync core files via `scp`
5. Restart backend and check `/health`

### B) Manual fallback

```bash
ssh -i ~/.ssh/id_ed25519 ubuntu@43.143.237.15
cd ~/weather-sunset-predictor

git pull origin main
npm install
cd server && npm install && cd ..

cd server
cp -n .env.example .env
# edit .env if needed

sudo bash -c 'cd /home/ubuntu/weather-sunset-predictor/server && pkill -f "node index" || true && nohup node index.js > /tmp/ws-backend.log 2>&1 &'
curl -s http://localhost:3000/health
```

Notes:
- `server/.env` is server-only and should not be committed.
- If backend was started by root, restart with `sudo`.
- Logs: `/tmp/ws-backend.log`

---

## Collaboration Workflow

- Branch → PR → merge → deploy
- Do not develop directly on `main`
- Share PR link immediately after push

---

## License

MIT
