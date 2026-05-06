# 霞客（Sunset Voyager）设计规范

> 适用范围：霞客网站全部 UI，包括首页、天气信息、7 天/24 小时预报、朝霞/晚霞预测、云况雷达、地图与设置面板。

## 设计方向

霞客的视觉关键词是：**自然、温暖、通透、克制、专业**。

界面应该像“日出日落前后的天空”——有暖色、层次和空气感，但不能变成糖果色、科技蓝紫、强对比霓虹或杂乱渐变。

## 核心原则

1. **主题变量优先**
   - 组件不得随意写死颜色。
   - 新增颜色必须先进入主题 token，再被组件引用。
   - 允许业务语义色，但也必须 token 化，例如评分、云层、地图热力。

2. **亮色和暗色是两套完整设计，不是简单反色**
   - 亮色：暖白、米色、日光、轻玻璃。
   - 暗色：深蓝黑、夜空、低亮度暖光、玻璃层次。

3. **统一组件语言**
   - 卡片、分段开关、图表容器、预测面板、天气指标，应使用统一圆角、阴影、边框和背景层级。
   - `xiake-toggle / xiake-toggle-btn` 是分段切换模板，后续所有类似切换控件必须复用。

4. **SVG 图标优先**
   - 不使用 emoji 作为正式 UI 图标。
   - SVG 要语义明确：降水像雨滴，风像风线，云层像云，不要抽象到用户看不懂。

5. **紧凑但不拥挤**
   - 移动端优先控制高度和行距。
   - 不靠硬挤、换行补救；需要重新设计排布时就重排结构。

## 亮色模式规范

### 氛围

亮色模式应是 **暖白日光玻璃感**：

- 背景：暖白 / 米色 / 轻微朝霞渐变。
- 卡片：半透明暖白玻璃，不发灰、不发蓝、不脏。
- 强调色：暖橙、琥珀、日光金。
- 文字：深棕黑，不用纯黑造成割裂。
- 边框：低透明度暖棕/金色。

### 推荐 token 方向

```css
--theme-bg: #f7f1e7;
--theme-bg-gradient: radial/linear warm sunrise gradient;
--theme-card-bg: rgba(255, 252, 246, 0.88-0.96);
--theme-card-border: rgba(186, 132, 72, 0.16-0.24);
--theme-text: #3d2b1f;
--theme-text-muted: #7a6554;
--theme-accent: #d97706;
--theme-accent-strong: #f59e0b;
--theme-accent-soft: rgba(217, 119, 6, 0.10-0.18);
--theme-shadow: warm low-opacity brown shadow;
```

### 避免

- 大面积蓝紫渐变。
- 冷灰玻璃卡片。
- 白底上强紫、强蓝按钮。
- 每个模块自己发明一套浅色背景。

## 暗色模式规范

### 氛围

暗色模式应是 **夜空深蓝玻璃感**：

- 背景：深蓝黑、午夜蓝，而不是纯黑。
- 卡片：深色半透明玻璃，边框低亮度发光。
- 强调色：暖橙/日光金作为视觉焦点，蓝色只用于辅助信息。
- 文字：接近白但不纯白，弱文字降低透明度。

### 推荐 token 方向

```css
--theme-bg: #0a0f1e;
--theme-card-bg: rgba(18, 28, 52, 0.60-0.85);
--theme-card-border: rgba(255, 255, 255, 0.08-0.12);
--theme-text: rgba(255, 255, 255, 0.92);
--theme-text-muted: rgba(255, 255, 255, 0.50-0.70);
--theme-accent: #fb923c;
--theme-accent-strong: #fbbf24;
--theme-accent-soft: rgba(251, 146, 60, 0.10-0.18);
--theme-shadow: deep black + subtle inner highlight;
```

### 避免

- 纯黑背景。
- 高饱和霓虹蓝紫污染主界面。
- 亮色模式遗留的白色卡片直接套进暗色。

## 语义色规范

语义色必须集中定义，组件引用变量：

```css
--color-excellent
--color-good
--color-fair
--color-error
--color-warning
--chart-temp-color
--chart-precipitation-color
--chart-humidity-color
--chart-wind-color
--chart-pressure-color
--chart-cloud-color
--cloud-high-color
--cloud-mid-color
--cloud-low-color
--map-score-low-color
--map-score-mid-color
--map-score-high-color
```


## 当前落地 token（2026-04-26）

### 全局主题 token

```css
--theme-bg
--theme-card-bg
--theme-card-border
--theme-text
--theme-text-muted
--theme-accent
--theme-accent-strong
--theme-accent-soft
--theme-panel-soft
```

### 语义与业务 token

```css
--status-success-soft
--status-success-border
--status-info-soft
--status-warning-soft
--score-track-color
--score-poor-color
--score-fair-color
--score-good-color
--score-excellent-start
--score-excellent-mid
--score-excellent-end
--cloud-high-color
--cloud-mid-color
--cloud-low-color
--cloud-track-color
--chart-temp-color
--chart-precipitation-color
--chart-humidity-color
--chart-wind-color
--chart-pressure-color
--chart-cloud-color
--chart-point-stroke
--map-score-low-color
--map-score-mid-color
--map-score-high-color

/* 雷达 UI token */
--radar-bg
--radar-border
--radar-ring
--radar-axis-main
--radar-axis-sub
--radar-label-fill
--radar-label-bg
--radar-title
--radar-subtitle
--radar-legend-text
--radar-legend-bg
--radar-center
--radar-center-stroke
--radar-ring-low
--radar-ring-mid
--radar-ring-high
--radar-cloud-low
--radar-cloud-mid
--radar-cloud-high

/* 地图 UI token */
--map-bg
--map-bg-dark
--map-boundary-stroke
--map-boundary-fill
--map-boundary-stroke-dark
--map-boundary-fill-dark
--map-city-fill
--map-city-stroke
--map-city-text
--map-city-text-shadow
--map-city-fill-dark
--map-city-stroke-dark
--map-city-text-dark
--map-city-text-shadow-dark
--map-legend-bg
--map-legend-text
--map-legend-border
--map-focus-fill
--map-focus-stroke
--map-score-text-high
--map-score-text-mid
--map-score-text-low
--map-score-text-error
--map-popup-bg
--map-popup-text
--map-popup-muted-text
--map-popup-hint-text
--map-popup-loading-text
--map-popup-border
```

### 雷达/地图 token 收口 v2（2026-04-26）

- `RadarCompass.js`：补齐 radar token fallback，保留云层业务语义色值不变。
- `ChinaMapCanvas.js`：城市标注、边界、legend、点击 popup 的 UI 颜色从 map token 读取。
- `styles/main.css`：新增 radar/map 相关 token 与 `.china-map-legend` / `.china-click-popup` 主题样式。
- 业务色阶（40/50/60/70+）不改，仅做 token 化承载。

### 允许保留但必须归档的颜色

- 地图热力、云层等级、评分等级、图表折线属于业务语义色，可以保留色相差异，但必须通过上述 token 进入组件。
- Canvas/SVG 无法完全使用 CSS cascade 时，也应先从 CSS variable 读取，fallback 只作为兜底。
- `white/black/rgba` 用于阴影、透明遮罩、可访问性文字时允许存在，但新增前必须说明用途。

## 模块规范

### 朝霞/晚霞预测

- 预测卡片必须跟随主题变量。
- 分数、云量、分析、结论 banner 不得写死糖果蓝紫色。
- 预测面板必须与“实时天气信息”共用同一套玻璃语言：亮色为暖白/米色玻璃，暗色为夜空深蓝玻璃；禁止单独使用 iOS 糖果渐变或高饱和蓝紫粉底色。
- 日出/日落方向必须显示明确方位；如有箭头，箭头应跟随方位角旋转。
- 高云/中云/低云行：标签在左、百分比在右，必须同排，不允许百分比掉到第二排。
- 评分明细面板必须解释所有会显著改变最终分的规则：基础分、画布、光路、渲染系数、厚高云封顶、沙尘灰幕封顶、高云载体保底。
- 文字分析必须和算法判定一致：高云多但沙尘/PM10/AOD 极高时，不能只显示“高云充沛”这类乐观结论；清透高云被保底时，也要说明“高云载体清晰”。

### 天气信息 / 7 天 / 24 小时

- 切换控件统一使用 `xiake-toggle / xiake-toggle-btn`。
- 24 小时图表 grid、axis、label、line 色必须从 chart token 或主题变量读取。
- 7 天卡片底部信息应整体排布优化，不靠挤压换行。

### Home Menu 页面

- Home Menu 下的预测、计算方法、地图、分享地图、API 接入都必须复用同一个主站 header、主题变量、footer 与 card 框架。
- 所有 Home Menu panel 必须受同一套系统设置控制：主题切换、语言切换、RTL/LTR、按钮状态和全局 toast 都要覆盖到；禁止出现设置无法影响的孤立页面。
- 禁止为了新增子页面单独复制一套“相似但不一致”的顶栏、菜单或主题样式。
- 若需要保留旧路径（如 `/api-apply.html`），只能作为跳转入口，最终落到主站 HomeTabs panel 内。

### 云况雷达 / 地图

- 可保留业务色（热力、云层、评分），但必须进入 radar/map token。
- 不允许在 Canvas/SVG 代码里散落无法追踪的硬编码颜色。

## 开发检查清单

每次 UI PR 必查：

- [ ] 新增/修改颜色是否使用主题 token？
- [ ] 亮色模式是否仍是暖白玻璃体系？
- [ ] 暗色模式是否仍是夜空深蓝玻璃体系？
- [ ] 是否引入了新的硬编码 hex/rgb？如有，是否属于 token 定义？
- [ ] 移动端和桌面端是否分别检查？
- [ ] 图表 / SVG / Canvas 是否读取主题变量？
- [ ] 不使用 emoji 做正式 UI 图标。

## 硬编码颜色排查命令

```bash
# CSS 组件层硬编码颜色
python3 - <<'PY'
import re
from pathlib import Path
css=Path('styles/main.css').read_text().splitlines()
color_re=re.compile(r'#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|\b(?:white|black)\b')
prop_re=re.compile(r'\b(color|background(?:-color)?|border(?:-color|-left|-top|-bottom|-right)?|box-shadow|text-shadow|outline|fill|stroke)\s*:')
for i,line in enumerate(css,1):
    stripped=line.strip()
    if stripped.startswith('--'):
        continue
    if color_re.search(line) and prop_re.search(line):
        print(f'{i}: {stripped}')
PY

# JS / SVG / Canvas 硬编码颜色
grep -RIn --include='*.js' -E "#[0-9a-fA-F]{3,8}|rgba?\(|linear-gradient|color:" src
```
