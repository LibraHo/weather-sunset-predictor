# Requirement 53 Data Pipeline Audit

Date: 2026-05-26

## Scope

This audit records the current firecloud map data path before the GFS+CAMS pipeline replaces Open-Meteo grid sweeping as the default map source.

## Current Map Path

- `server/services/GridScoreService.js`
  - Generates configured regional sample points.
  - Calls `ProviderOrchestrator.fetchWeatherDataBatch()` / Open-Meteo for batches.
  - Scores each point with `calculateEnhancedPrediction()`.
  - Persists point cache and job state under the grid cache directory.
  - Owns the existing `/api/heatmap/status` batch progress model.

- `server/routes/heatmap.js`
  - `GET /api/heatmap/grid` now reads `GridScoreService.getBestAvailableCache()` and returns a cache-derived grid.
  - `POST /api/heatmap/refresh` triggers `gridService.manualRefresh()`.
  - Public `GET` routes must not cause external weather requests from a user/API request path.

- `server/services/ChinaRasterService.js`
  - Reads the best available `GridScoreService` cache, preferring standardized GFS+CAMS products.
  - Interpolates scatter points into an East Asia raster using IDW.
  - Does not own external weather fetching directly.
  - Degraded raster cache entries re-check source signatures before serving from TTL so fresh pipeline products are not masked by old fallback rasters.

- `server/services/FireCloudTileService.js`
  - Builds tile-local grids by sampling cached firecloud score points.
  - Renders scores into PNG tiles.
  - Not-ready grids and PNG tiles are not cached, so newly available pipeline products become visible immediately.

- `server/routes/tiles.js`
  - Currently only proxies Gaode map tiles and logs `gaode_tile`.
  - Firecloud score tiles are not mounted here yet.

- `server/routes/spots.js`
  - `GET /api/spots/china` now reads best available cache and no longer calls `refreshIfStale()` from the public/miniprogram path.

- `server/scripts/gfs_processor.py`
  - Existing GFS processing script is a useful reference for dependencies and parsing approach.
  - It should not become the control plane; orchestration, status, config, and logs belong to Node services.

## New Control Plane Added

- `server/services/DataPipelineConfigService.js`
  - Owns mode, bbox, resolution, forecast window, source toggles, storage policy, and resource estimates.
  - Defaults to China, 0.5 degrees, future 48 hours, GFS+CAMS.

- `server/services/DataPipelineRunLogService.js`
  - Owns run and step lifecycle records with byte accounting, retryability, source, cycle, forecast hour, variables, and paths.

- `server/routes/data-pipeline.js`
  - Exposes `/api/admin/data-pipeline/*` control APIs.
  - Mounted behind existing Basic Auth in `server/index.js`.
  - `run`, `retry`, and `cleanup` currently enqueue control-plane records only; real workers are later tasks.

- `server/services/GridProductScoreAdapter.js`
  - Converts latest standardized GFS weather grid and CAMS aerosol grid products into the existing score-cache shape.
  - Preserves product and point provenance, including source, cycle, forecast hour, bbox, resolution, and sourceMeta.

- `server/services/DataPipelineCleanupService.js`
  - Applies storage retention under the configured pipeline data directory.
  - Deletes old raw files, tmp files, grid products, and tile files without reading file contents into memory.
  - Synchronizes `grid-products/manifest.json` after product deletion.
  - Prunes data-pipeline run/step logs through `DataPipelineRunLogService.pruneOlderThan()`.
  - `/api/admin/data-pipeline/cleanup` now records a completed cleanup run/step with deleted file and byte counts.

## Boundaries For Next PRs

- Keep single-point prediction on `ProviderOrchestrator` and Open-Meteo.
- Move map generation toward GFS+CAMS cached products.
- Do not trigger broad external downloads from `GET /api/heatmap/grid` or tile requests.
- Keep `GridScoreService` scoring logic reusable, but isolate Open-Meteo grid sweeping as fallback/history.
- Add GFS/CAMS parsers as data sources that write standardized grid cache, not as user-request-time providers.

## Immediate Follow-Up

1. Add `GfsGridSource` and `CamsAerosolSource` with small-area fixtures or dry-run modes.
2. Add a cache reader/writer for standardized grid products.
3. Implement the real worker loop that downloads, parses, and stores standardized GFS+CAMS products in small batches.
4. Add cleanup `dryRun`, worker/cleanup concurrency locking, and latest-successful-cycle retention before production rollout.
5. Keep `cache_only` and last-successful-run behavior visible in the admin control plane.

## Requirement 53.16-53.18 Documentation Acceptance

Date: 2026-05-27

Documents added for the QA/devops slice:

- `docs/data-pipeline-ops-runbook.md`
- `docs/data-pipeline-small-host-acceptance.md`

Coverage:

- 53.16: records the automated test slices that must cover config defaults, validation, estimates, run/step state, cleanup, source switching, cache-first heatmap/spots/raster/tile behavior, and provenance preservation.
- 53.17: defines the Tencent Cloud `SA2.LARGE4` small-host acceptance procedure for 4 cores, about 3.6GiB RAM, 2GiB swap, and about 18G free disk. The procedure requires a small Beijing/Tianjin bbox before any China-wide run.
- 53.18: records environment variables, directory structure, cleanup policy, common errors, and admin/operator checks for "what is running now", "how much was downloaded today", and "which data cycle the map is using".

Acceptance caveat:

- These documents are operations and acceptance materials only. They do not complete the real GRIB/NetCDF downloader/parser work that remains under 53.6-53.8.
- Production rollout still needs a real small-region run on the Tencent host and the completed acceptance record from `docs/data-pipeline-small-host-acceptance.md`.
