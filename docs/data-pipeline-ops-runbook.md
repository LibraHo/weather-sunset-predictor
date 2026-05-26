# GFS+CAMS Data Pipeline Ops Runbook

Date: 2026-05-27

This runbook covers the Requirement 53 firecloud map pipeline. Single-point prediction still uses Open-Meteo. The GFS+CAMS pipeline is for map grids, heatmaps, rasters, tiles, and map summaries.

## Host Baseline

Production target:

- Tencent Cloud CVM `SA2.LARGE4`
- Region/AZ: `ap-beijing / ap-beijing-7`
- CPU: 4 cores, AMD EPYC 7K62
- Memory: about 3.6GiB
- Swap: 2GiB
- System disk: 40G, about 18G free before pipeline rollout

Operational rule: website and Mini Program APIs win over map generation. Pipeline workers must stay single-worker by default and must not start from public map requests.

## Environment Variables

Required for normal service:

- `NODE_ENV`: `production` for server deployment.
- `PORT`: Express listen port.
- `ADMIN_USERNAME`: admin Basic Auth username.
- `ADMIN_PASSWORD`: admin Basic Auth password.

Recommended for pipeline deployment:

- `XIAKE_DATA_DIR`: base data directory. If unset, use the service default under `~/.xiake/data`.
- `DATA_PIPELINE_MODE`: operator-facing default mode, expected values are `gfs_cams`, `hybrid`, `cache_only`, `paused`, or legacy `openmeteo`.
- `DATA_PIPELINE_WORKER_CONCURRENCY`: keep `1` on the 3.6GiB host.
- `DATA_PIPELINE_MAX_RSS_MB`: keep around `512`.
- `DATA_PIPELINE_HARD_MEMORY_MB`: keep around `768`.
- `DATA_PIPELINE_MIN_FREE_DISK_GB`: keep `3` or higher.
- `GFS_BASE_URL`: NOAA/NOMADS or mirror base URL, when the real downloader is enabled.
- `CAMS_BASE_URL`: CAMS/ADS retrieval endpoint or mirror base URL, when the real downloader is enabled.
- `CAMS_API_KEY` or provider-specific CAMS credentials: only if the chosen CAMS endpoint requires auth.

Existing optional integrations:

- `WINDY_API_KEY`: optional/legacy, not required for the GFS+CAMS map pipeline.

Do not expose upstream keys in browser or Mini Program code.

## Directory Structure

Default layout under `~/.xiake`:

```text
~/.xiake/
  data-pipeline-config.json
  data-pipeline-runs.json
  data-pipeline-steps.json
  data/
    raw/
      gfs/<cycle>/*.grib2
      cams/<cycle>/*.nc
    tmp/
    cache/
      grid-products/
        manifest.json
        *.json
      tiles/
    tiles/
```

Notes:

- `data-pipeline-config.json` stores mode, bbox, resolution, forecast hours, source toggles, storage policy, and runtime policy.
- `data-pipeline-runs.json` and `data-pipeline-steps.json` are the MVP run/step logs.
- `raw` holds downloaded GRIB/NetCDF files only while a worker is processing them.
- `tmp` is for partial parse/interpolation output.
- `cache/grid-products` is the standardized GFS/CAMS product cache and manifest.
- Tile cache path should be kept consistent by deployment. Existing docs mention both `data/tiles` and `data/cache/tiles`; prefer the configured path reported by `/api/admin/data-pipeline/status`.

## Cleanup Policy

Default retention:

- raw GFS/CAMS files: delete after 60 minutes.
- tmp files: delete after 3 hours.
- grid products: keep 3 days.
- tiles: keep 3 days.
- run/step logs: keep 7 days or service size cap.
- minimum free disk: 3GB.

Manual cleanup:

1. Open `/admin`.
2. Go to the data pipeline panel.
3. Check current run status and disk state.
4. Run cleanup from the panel or call `POST /api/admin/data-pipeline/cleanup`.
5. Confirm the response includes `deletedFiles`, `deletedBytes`, `prunedRuns`, and `prunedSteps`.

Safety rules:

- Cleanup must only delete inside the configured pipeline data directory.
- Cleanup must not read file contents into memory; it should use stat/unlink.
- Do not run cleanup while a real GFS/CAMS worker is writing the same cycle unless a worker/cleanup lock is active.
- Keep at least one recent successful product before production rollout if cache-only availability is required.

## Admin: What Is Running Now

Use `/admin` or `GET /api/admin/data-pipeline/status`.

Look for:

- `mode`: `gfs_cams`, `hybrid`, `cache_only`, `paused`, or `openmeteo`.
- active run: status `queued`, `running`, `completed`, `failed`, or `cancelled`.
- active step: `downloading`, `parsing`, `scoring`, `tiling`, `cleanup`, `completed`, `failed`, or `skipped`.
- `source`: `gfs`, `cams`, `cleanup`, or scoring/tile step source.
- `cycle`: upstream model cycle, for example `2026052700`.
- `forecastHour`: current forecast hour being processed.
- `message` and `errorCode`: latest human-readable progress or failure reason.

If public maps show a not-ready/degraded state, check whether the latest successful grid product exists before starting a new worker.

## Admin: How Much Was Downloaded Today

Use `/admin` recent runs or `GET /api/admin/data-pipeline/runs`.

Daily download accounting:

- Filter runs and steps by local date.
- Sum `bytesDownloaded` from steps where `source` is `gfs` or `cams`.
- Keep cleanup bytes separate: `deletedBytes` is freed storage, not download volume.
- For failed retries, count each actual download attempt because it consumed bandwidth and disk.

Recommended display:

- Today downloaded: sum of GFS+CAMS `bytesDownloaded`.
- Today freed: sum of cleanup `deletedBytes`.
- Last successful run: run id, cycle, bbox, resolution, forecast hours, elapsed time.

## Admin: Which Data Is The Map Using

For map provenance, inspect responses from:

- `GET /api/heatmap/grid`
- `GET /api/spots/china`
- raster/overlay endpoints backed by `ChinaRasterService`
- firecloud grid/tile metadata when available

Expected provenance fields:

- `source`: ideally `gfs_cams_grid_product`; degraded fallback may show legacy cache source.
- `degraded`: true when reading fallback or missing pipeline products.
- `degradedReason`: for example `GRID_PRODUCT_CACHE_NOT_READY`.
- `meta.products.weather.source`: `gfs`
- `meta.products.aerosol.source`: `cams`
- `cycle`, `forecastHour`, `validTime`, `bbox`, `resolution`
- point-level `sourceMeta.weather` and `sourceMeta.aerosol`

Operator interpretation:

- `source=gfs_cams_grid_product` and `degraded=false`: map is from the new pipeline.
- `degraded=true` with `GRID_PRODUCT_CACHE_NOT_READY`: no complete GFS+CAMS product is available yet.
- stale cycle but successful status: worker is not refreshing or is paused; check mode and latest failed run.

## Common Errors

- `LOW_DISK_SPACE`: free disk is below `minFreeDiskGb`. Run cleanup, shrink bbox, or wait for more disk.
- `ESTIMATE_TOO_LARGE`: bbox/resolution/forecast hours exceed host policy. Use test small region first.
- `MEMORY_PRESSURE`: worker should pause because API/system memory reserve is threatened.
- `GRID_PRODUCT_CACHE_NOT_READY`: public map can only read cache; run or wait for the backend pipeline.
- `GFS_INDEX_NOT_FOUND`: selected GFS cycle or forecast hour is not available upstream yet.
- `GFS_DOWNLOAD_FAILED`: upstream or mirror failure; retry later or switch to cache-only.
- `CAMS_AUTH_FAILED`: CAMS credential or quota issue.
- `CAMS_DOWNLOAD_FAILED`: CAMS endpoint unavailable or query too large.
- `PARSE_FAILED`: GRIB/NetCDF parser failed; keep raw only if inside debugging window, then cleanup.
- `MANIFEST_CORRUPT`: grid product manifest is unreadable; rebuild from product files or restore backup.
- `CLEANUP_PARTIAL`: some files were skipped due to permissions, concurrent deletion, or path safety checks.

## Small-Host Operating Rules

- Start with a test bbox, not all China.
- Keep `workerConcurrency=1`.
- Keep public request pipeline starts disabled.
- Keep at least 2GB memory reserved for Node API, static site, Mini Program API, and OS cache.
- Keep free disk above 3GB; on an 18G-free host, avoid holding more than about 5GB raw/tmp at once.
- Process forecast hours in small batches and delete raw files immediately after product write.
- Prefer `cache_only` or `paused` during traffic spikes.

## OpenClaw Deployment Test Files

After OpenClaw merges and deploys the data-pipeline base slice, run the focused Requirement 53 suite before enabling real GFS/CAMS downloads:

```bash
npm test -- tests/unit/server/DataPipelineConfigService.test.js tests/unit/server/DataPipelinePlannerService.test.js tests/unit/server/DataPipelineRunLogService.test.js tests/unit/server/DataPipelineCleanupService.test.js tests/unit/server/DataPipelineWorkerService.test.js tests/unit/server/DataPipelineModeService.test.js tests/unit/server/GfsGridSourceService.test.js tests/unit/server/CamsAerosolSourceService.test.js tests/unit/server/GridProductCacheService.test.js tests/unit/server/GridProductScoreAdapter.test.js tests/unit/server/GridScoreService.test.js tests/unit/server/GridScoreService.mode.test.js tests/unit/server/heatmapRoute.cacheFirst.test.js tests/unit/server/heatmapRoute.mode.test.js tests/unit/server/FireCloudTileService.cacheFirst.test.js tests/unit/server/FireCloudTileService.mode.test.js tests/unit/server/ChinaRasterService.test.js tests/unit/server/dataPipelineRoutes.test.js tests/integration/server/firecloud-api.integration.test.js tests/integration/server/spots-api.integration.test.js tests/unit/admin --runInBand
```

The individual test files are:

- `tests/unit/server/DataPipelineConfigService.test.js`
- `tests/unit/server/DataPipelinePlannerService.test.js`
- `tests/unit/server/DataPipelineRunLogService.test.js`
- `tests/unit/server/DataPipelineCleanupService.test.js`
- `tests/unit/server/DataPipelineWorkerService.test.js`
- `tests/unit/server/DataPipelineModeService.test.js`
- `tests/unit/server/GfsGridSourceService.test.js`
- `tests/unit/server/CamsAerosolSourceService.test.js`
- `tests/unit/server/GridProductCacheService.test.js`
- `tests/unit/server/GridProductScoreAdapter.test.js`
- `tests/unit/server/GridScoreService.test.js`
- `tests/unit/server/GridScoreService.mode.test.js`
- `tests/unit/server/heatmapRoute.cacheFirst.test.js`
- `tests/unit/server/heatmapRoute.mode.test.js`
- `tests/unit/server/FireCloudTileService.cacheFirst.test.js`
- `tests/unit/server/FireCloudTileService.mode.test.js`
- `tests/unit/server/ChinaRasterService.test.js`
- `tests/unit/server/dataPipelineRoutes.test.js`
- `tests/integration/server/firecloud-api.integration.test.js`
- `tests/integration/server/spots-api.integration.test.js`
- `tests/unit/admin/admin-page-structure.test.js`
- `tests/unit/admin/admin-header-card-width.test.js`

Also run syntax checks for the deployment-critical files:

```bash
node --check public/admin/admin.js
node --check server/routes/data-pipeline.js
node --check server/services/DataPipelineWorkerService.js
node --check server/services/DataPipelineModeService.js
```
