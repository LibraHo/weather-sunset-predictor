# Small Host Acceptance Checklist For Requirement 53

Date: 2026-05-27

Target host:

- Tencent Cloud CVM `SA2.LARGE4`
- 4 CPU cores
- about 3.6GiB RAM
- 2GiB swap
- 40G system disk
- about 18G free before rollout

Goal: prove the GFS+CAMS firecloud map pipeline can run without hurting the website or Mini Program APIs. Always test a small region first.

## Acceptance Scope

This checklist covers Requirement 53.16-53.18 documentation and ops acceptance:

- automated and manual test evidence to collect,
- small-resource end-to-end test procedure,
- operations evidence for progress, download volume, cleanup, and map provenance.

It does not claim that the real GRIB/NetCDF downloader is production-ready until 53.6-53.8 are completed with real upstream data.

## Preflight

Record:

- commit/branch:
- date/time:
- host:
- free disk before run:
- memory before run:
- swap before run:
- Node version:
- npm version:
- pipeline mode:
- bbox:
- resolution:
- forecast hours:

Suggested first bbox:

```json
{
  "regionPreset": "test_small_beijing_tianjin",
  "bbox": { "west": 115.5, "south": 39.0, "east": 118.5, "north": 41.0 },
  "resolution": 0.5,
  "forecastHours": 48,
  "forecastStepHours": 3
}
```

Use this before China-wide runs. If this fails, do not expand the range.

## Required Automated Tests

Run the existing unit/integration slices before manual host acceptance:

```bash
npm test -- tests/unit/server/DataPipelineConfigService.test.js tests/unit/server/DataPipelinePlannerService.test.js tests/unit/server/DataPipelineRunLogService.test.js tests/unit/server/DataPipelineCleanupService.test.js tests/unit/server/GridProductCacheService.test.js tests/unit/server/GridProductScoreAdapter.test.js tests/unit/server/ChinaRasterService.test.js tests/unit/server/FireCloudTileService.cacheFirst.test.js tests/unit/server/heatmapRoute.cacheFirst.test.js tests/unit/server/dataPipelineRoutes.test.js tests/integration/server/spots-api.integration.test.js --runInBand
```

Expected:

- all suites pass,
- public heatmap/spots/tile paths do not trigger external downloads,
- not-ready grids/tiles are not cached over future successful products,
- cleanup returns deleted/pruned counts,
- source/cycle/bbox/sourceMeta provenance is preserved.

## Small-Region End-To-End Procedure

1. Set mode to `paused` or `cache_only` before changing config.
2. Save the test bbox above.
3. Call `/api/admin/data-pipeline/estimate`.
4. Confirm estimate is accepted and free disk remains above 3GB after projected raw/tmp usage.
5. Switch mode to `gfs_cams` or `hybrid`.
6. Start one manual run for future 48 hours.
7. Watch `/api/admin/data-pipeline/status` until the run completes or fails.
8. Verify `/api/admin/data-pipeline/runs/:id` shows per-step `source`, `cycle`, `forecastHour`, `bytesDownloaded`, `elapsedMs`, and errors if any.
9. Open map endpoints and confirm metadata points to the same successful cycle.
10. Run cleanup and confirm raw/tmp do not accumulate.
11. Switch back to `cache_only` if the host is under pressure.

## Resource Measurements

Capture every 30-60 seconds during the run:

```bash
date
free -h
df -h /
du -sh ~/.xiake/data 2>/dev/null || true
du -sh ~/.xiake/data/raw ~/.xiake/data/tmp ~/.xiake/data/cache 2>/dev/null || true
ps -o pid,ppid,rss,vsz,pcpu,pmem,cmd -C node
```

Record peak values:

- peak Node RSS:
- peak total memory used:
- peak swap used:
- peak raw directory size:
- peak tmp directory size:
- peak cache directory size:
- total GFS bytes downloaded:
- total CAMS bytes downloaded:
- total elapsed time:
- cleanup deleted files:
- cleanup freed bytes:

Pass/fail thresholds for the Tencent host:

- API remains reachable throughout the run.
- Node API has about 2GB memory reserve available for normal traffic.
- pipeline worker RSS stays near 512MB target and below 768MB hard limit.
- swap does not grow continuously.
- free disk never drops below 3GB.
- raw/tmp combined peak stays below 5GB.
- cleanup reduces raw/tmp after completion.
- public map requests do not start downloads.

## Admin Acceptance Questions

The backend/admin must answer these without SSH:

- What mode is active now?
- Is a run active, queued, completed, or failed?
- Which step is running now?
- Which source is being processed: GFS, CAMS, scoring, tiling, or cleanup?
- Which cycle and forecast hour are being processed?
- How many bytes were downloaded today?
- How many bytes were freed by cleanup today?
- What was the last successful product?
- Which source/cycle/bbox/resolution is the current map using?
- Is the map degraded, and why?

Evidence source:

- `/admin` data pipeline panel,
- `GET /api/admin/data-pipeline/status`,
- `GET /api/admin/data-pipeline/runs`,
- `GET /api/admin/data-pipeline/runs/:id`,
- map endpoint metadata.

## Rollback

Use rollback when host pressure or upstream failures threaten normal service:

1. Set pipeline mode to `paused`.
2. If a stable product exists, set mode to `cache_only`.
3. Run cleanup.
4. Confirm public maps return cached/degraded responses without triggering downloads.
5. Keep single-point prediction on Open-Meteo.
6. Re-enable `gfs_cams` only after estimate and small-region run pass.

## Acceptance Record Template

```text
Date:
Operator:
Host:
Commit:
Mode:
BBox:
Resolution:
Forecast hours:

Estimate:
  grid points:
  projected download:
  projected raw/tmp:
  accepted/rejected:

Run:
  run id:
  cycle:
  started:
  completed:
  status:
  failed step/error:

Resources:
  peak Node RSS:
  peak memory used:
  peak swap used:
  peak raw/tmp:
  minimum free disk:

Download:
  GFS bytes:
  CAMS bytes:
  total bytes:

Cleanup:
  deleted files:
  freed bytes:
  pruned runs:
  pruned steps:

Map provenance:
  source:
  weather cycle:
  aerosol cycle:
  bbox:
  degraded:
  degraded reason:

Result:
  pass/fail:
  follow-up:
```

