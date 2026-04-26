# 分享卡与残余硬编码颜色复盘（theme-token follow-up）

> 产出时间：2026-04-26
> 分支：theme-sharecard-token-audit-plan

## 1) 已完成处理：ShareCardGenerator 主题对象重命名与文档化（低风险）

`src/services/ShareCardGenerator.js`

- 将主题配置从 `this.themes` 更名为 `this.shareThemes`，明确“输出分享卡主题”职责。
- 将键名重构为语义化字段：
  - `bg` -> `backgroundStops`
  - `card` -> `surfaceFill`
  - `cardStroke` -> `surfaceBorder`
  - `gaugeColors` -> `scoreGradient`
  - `accent` -> `scoreAccent`
  - `accent2` -> `scoreAccentSecondary`
- 仅改名/注释，不调整视觉值，避免影响现有输出风格。

### 审计结论
- 该文件为 Canvas 输出，当前颜色仍大量直接写在绘制代码中（包括白色系与多处 `rgba`）。
- 其性质：
  - 可接受：用于**独立分享卡输出**，具备独立主题场景；
  - 风险：大规模硬编码难以维护（不是错误）。
- 本次不做全面重构，仅完成命名与归档，符合“低风险优先”与“有条件可回退”的要求。

## 2) 其他文件硬编码颜色复盘（待后续 token 化）

### `src/utils/GlobalErrorBoundary.js`

- 关键硬编码：`#d32f2f`、`#f5f5f5`、`#333`、`rgba(0,0,0,0.9)`、`white`
- 评级：
  - `#d32f2f`（错误主色）：应映射到项目现有语义 token（如 `--color-error`）
  - `rgba(0,0,0,0.9)`（遮罩）：保留当前写法，属于可访问性/弹层背景语义，不建议全局 token 化
  - `white`/浅灰等：建议使用语义 token 或变量（`--color-text`, `--color-text-light`）做一致性覆盖

### `src/components/SettingsPanel.js`

- 关键硬编码：`#f59e0b`、`#e0e0e0`、`#4CAF50`
- 评级：
  - 全部建议统一到现有语义变量（`--color-warning` / `--color-success`），
  - 目前文件已有 `var(--xxx, fallback)`，但回退色应替换为新版色系以避免旧绿橙残留。

### `src/services/RadarChartService.js`

- 关键硬编码：评分颜色、网格/边框/背景/文本色，回退表格的 `#f5f5f5`、`#ddd`、评分状态色
- 评级：
  - 强烈建议：使用主题系统变量（如 `--score-*`/`--chart-*`）并通过 `getComputedStyle` 获取后回退，
  - `rgba(76,175,80,0.3)` 为填充语义色，可定义为 `--score-excellent-overlay` 之类的新语义 token；
  - `#ddd` 这类边框可降级到 `--color-border` 或 `--chart-grid-color`。

## 3) 下一个动作（建议）

- 单独排期处理 `GlobalErrorBoundary + SettingsPanel` 的轻量 token 化（样式常量级替换）。
- 对 `RadarChartService` 做分步处理：
  1) 先替换颜色对象与 fallback UI 颜色为 `resolveCssVar` 风格（含默认值）；
  2) 再用 `--score-*`/`--chart-*` 常量补齐半透明覆盖色。
- 保持 `ShareCardGenerator` 为独立输出主题，但在后续版本可逐步将非关键白色与高频 `rgba` 提取到主题 token。