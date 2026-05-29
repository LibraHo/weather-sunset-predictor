# Admin Console Design

## Goal

The admin console is an operational workspace, not a marketing or content page. It should help an operator answer three questions quickly:

- Is the service healthy right now?
- Which workflow needs attention?
- Is the next action read-only, normal write, or dangerous?

## Information Architecture

The console uses a persistent navigation shell. Each top-level navigation item should map to how an operator thinks about the work, not to every backend subsystem:

- 总览: health, traffic, error rate, share count, top IP, client source.
- 访客分析: date-scoped visitor totals, IP list, request details.
- 运维中心: queue status, service-impacting operations, firecloud refresh schedule, GFS+CAMS status, configuration, run controls, danger actions, history.
- 日志: API distribution, provider logs, daily error/retry stats.
- API Token: token creation, batch disable, applications, usage, audit logs.
- 照片管理: upload, metadata parsing, gallery management.

The dashboard must stay status-first. It should not duplicate every module entry or contain configuration forms.

## Layout Rules

- Desktop uses a fixed left navigation rail.
- Tablet and mobile collapse the rail into a horizontally scrollable top module bar.
- Page headers are compact. Large hero blocks are avoided inside the console.
- Cards are used for individual tools or repeated objects, not as nested page sections.
- Dense tables remain horizontally scrollable when needed, but key actions stay outside the scroll area.

## Data Pipeline Workflow

The data pipeline lives inside 运维中心 so operators do not need to guess whether it is under 运维操作, 定时任务, or 数据管线. Within that center, the data pipeline is split into explicit zones:

1. 状态与预算: mode, range, progress, latest product, download, failure, disk and memory budgets.
2. 当前状态: runtime state, estimate, cache state.
3. 配置: mode, region preset, bbox, resolution, forecast hours, source toggles.
4. 运行控制: dry-run and real run.
5. Danger Zone: cleanup, cleanup dry-run, rollback intent.
6. 运行历史: recent runs and selected run steps.

Cleanup and rollback controls must not live beside normal run buttons.

## Safety Rules

- Dangerous controls are visually grouped in a Danger Zone.
- Dangerous controls keep explicit confirmation behavior in JavaScript.
- New admin UI work should preserve existing DOM IDs unless the associated JavaScript and tests are updated in the same PR.
- UI-only restructure should not change admin auth, backend routes, or deployment behavior.

## Code Evolution

This pass keeps the existing `admin.js` behavior to reduce risk. A later refactor may split it into:

- `admin-api.js`
- `admin-navigation.js`
- `admin-dashboard.js`
- `admin-data-pipeline.js`
- `admin-tokens.js`
- `admin-photos.js`

That split should happen after the visual/workflow shell is stable.
