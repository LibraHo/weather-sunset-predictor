# 火烧云模拟器

## 目标

在 Web 首页菜单新增“火烧云模拟器”页面，用一个可交互横切面解释太阳低角度光路、公里级距离和米级云高如何共同决定火烧云显色。

该页面是教学与调参工具，不替代真实地点预测。它服务于两个问题：

- 在某个日出/日落太阳高度角下，哪些云块会被照亮？
- 哪些云块会因为前方云墙、过厚云体或低太阳角而变暗？

## 输入模型

每个云块使用真实尺度，而不是“高中低云”三档抽象：

```js
{
  id: 'cloud-01',
  distanceKm: 32,
  baseHeightM: 1800,
  topHeightM: 3400,
  coverage: 72,
  opticalDepth: 0.8
}
```

核心范围：

- X 轴：0-150km，表示观察者到太阳方向的距离。
- Y 轴：0-12000m，表示云底、云顶和光线高度。
- 太阳：使用日出/日落模式和模拟时间映射到 `solarElevationDeg`。
- 云厚：`topHeightM - baseHeightM`，影响遮挡和变暗。
- 光学厚度：`opticalDepth`，影响透光、染色和灰幕。

## 输出模型

模拟器对每块云输出：

- `status`: `lit | dimmed | shadowed | blocking | unlit`
- `illumination`: 0-1
- `colorName`: 如 `gold`, `orange red`, `crimson pink`, `violet gray`, `blue gray`
- `blockedBy`: 如果被前方云挡住，记录前方云块 id。
- `reason`: 面向用户的简短解释。

## 几何规则

- 太阳光线按 `heightAtDistance = tan(solarElevationDeg) * distanceKm * 1000` 估算在对应距离上的高度。
- 云块与光线高度相交时，可被直接照亮。
- 近处高覆盖率、高光学厚度、与光线相交的云块会形成遮挡云墙；后方云块沿同一低角度光路被标记为 `shadowed`。
- 光学厚度过高时，即便几何可达，也优先标记为 `dimmed`，颜色偏紫灰或蓝灰。
- 日落/日出前后颜色随太阳高度变化：较高偏金黄，接近地平线偏橙红，低于地平线偏粉紫，光弱或厚云偏灰。

## 页面结构

- Home menu 新增“火烧云模拟器”，位置放在“预测功能”和“火烧云计算方法”之间。
- 页面主体左侧为横切面 canvas，右侧为选中云块参数面板。
- 下方提供日出/日落模式、太阳时间/高度角、预设场景和云块列表。
- 云块列表显示每个云块的距离、云底、云顶、状态和颜色。

## 验收

- 用户能从 Home menu 打开火烧云模拟器页面。
- 页面能显示公里/米坐标、太阳、光线、多个云块和状态颜色。
- 调整模拟时间后，云块照亮/遮挡/变暗状态实时更新。
- 选择云块后，可以用输入控件精确调整 `distanceKm`、`baseHeightM`、`topHeightM`、`coverage` 和 `opticalDepth`。
- 单元测试覆盖几何照亮、前方遮挡、厚云变暗和默认云层数据。
- 渲染验证覆盖页面加载、菜单切换、控件更新和桌面/移动基本布局。
## 2026-06-14 Refinements

- Axis scale: the simulator supports a `linear` / `log` coordinate mode for both X distance and Y height. Log mode uses safe offsets so 0km and 0m remain visible.
- Persistent darkness: simulations can request `includeLifecycle`, sampling the sunrise/sunset elevation sweep to mark clouds that stay `shadowed`, `unlit`, or low-brightness `dimmed` from start to end as `alwaysDark`.
- Visual rendering: cloud blocks should render as radar-like cloud blobs with overlapping lobes, inner contour rings, and scan-line texture rather than plain rectangles.
- UI readout: summary and cloud rows expose `alwaysDarkCount` / `全程黑云` so users can identify permanently dark clouds without inferring solely from color.

## 2026-06-27 Refinements

- Cloud size is a model input, not only a drawing input. `widthKm` participates in the light-path span, shadow gap, and shadow-band expansion, so wider blocking clouds can shadow more downstream cloud volume.
- The simulator keeps the cross-section view as the default because it explains distance, height, and the low-angle light path most explicitly.
- A second `facingSun` view projects the same simulated cloud states into a view facing the sunrise/sunset direction. In this mode distance becomes perspective depth, cloud width becomes apparent horizontal spread, and meter-level cloud thickness controls the vertical footprint.
- The front-facing view is a visualization of the same profile facts, not a separate forecast model. The cloud list, summary, blocking, dimming, and always-dark states remain driven by `simulateFireCloudProfile`.

## 2026-06-27 Mini Program Native Version

- The mini program registers `pages/simulator/index` so the firecloud simulator is available without a web-view.
- Home shortcuts and the shared topbar include `data-target="simulator"` and route to `/pages/simulator/index`; the entry sits before the methodology page to match the product hierarchy.
- The native simulator keeps the same core facts as the Web simulator: sunrise/sunset mode, cross-section view, facing-sun view, minute offset, kilometer distance, meter cloud base/top, coverage, `widthKm`, and optical depth.
- The mini program renderer uses `canvas-id="firecloudSimulatorCanvas"` with a lightweight native canvas drawing. It does not copy Web DOM/CSS or Chart.js behavior.
- Acceptance tests cover app routing, home/topbar entry points, the simulator canvas, view toggles, physical cloud fields, `alwaysDarkCount`, and the model/renderer function names.
