# Theme Token Audit — 2026-04-26
本审计用于排查未纳入霞客主题系统的硬编码颜色，避免后续 UI 需要逐处救火。
## Summary
- CSS component-level hard-coded color declarations: `336`
- JS/SVG/Canvas hard-coded color hits: `243`

## Priority
1. 朝晚霞新版卡片：用户当前反馈最集中，先收口。
2. 24小时图表：线条/grid/axis 应全部 token 化。
3. 天气信息/7天：卡片、评分、风向、日出日落色 token 化。
4. 雷达/地图：保留业务热力色，但迁移到 radar/map token。

## CSS Findings

### 全局/头部/基础组件 (38)
- `styles/main.css:131` — `color: var(--color-text, #1f2937);`
- `styles/main.css:160` — `background: linear-gradient(120deg, var(--header-surface) 0%, rgba(255, 237, 205, 0.72) 100%);`
- `styles/main.css:190` — `text-shadow: 0 1px 0 rgba(255, 255, 255, 0.35);`
- `styles/main.css:195` — `background: rgba(255, 255, 255, 0.45);`
- `styles/main.css:196` — `border: 1px solid rgba(255, 255, 255, 0.65);`
- `styles/main.css:197` — `box-shadow: 0 4px 12px rgba(122, 74, 18, 0.14);`
- `styles/main.css:213` — `background: rgba(255, 255, 255, 0.7);`
- `styles/main.css:250` — `background: var(--color-surface, rgba(30, 30, 50, 0.97));`
- `styles/main.css:251` — `border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.15));`
- `styles/main.css:264` — `color: var(--color-text, #f0f0f0);`
- `styles/main.css:299` — `background: rgba(74, 144, 226, 0.2);`
- `styles/main.css:304` — `color: #fff;`
- `styles/main.css:305` — `border-color: rgba(255, 255, 255, 0.25);`
- `styles/main.css:323` — `border: 1px solid rgba(255, 255, 255, 0.45);`
- `styles/main.css:324` — `background: rgba(255, 255, 255, 0.16);`
- `styles/main.css:325` — `color: #ffffff;`
- `styles/main.css:333` — `background: #ffffff;`
- `styles/main.css:335` — `border-color: #ffffff;`
- `styles/main.css:340` — `box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.45);`
- `styles/main.css:402` — `background: var(--glass-bg, rgba(255,255,255,0.7));`
- `styles/main.css:407` — `color: #2f3948;`
- `styles/main.css:410` — `border: 1px dashed rgba(76, 93, 122, 0.3);`
- `styles/main.css:434` — `box-shadow: 0 4px 12px rgba(0,0,0,0.1);`
- `styles/main.css:449` — `.score-excellent .score-range { color: #4caf50; }`
- `styles/main.css:450` — `.score-good .score-range { color: #ff9800; }`
- `styles/main.css:451` — `.score-fair .score-range { color: #9e9e9e; }`
- `styles/main.css:452` — `.score-poor .score-range { color: #f44336; }`
- `styles/main.css:482` — `background: var(--glass-bg, rgba(255, 255, 255, 0.5));`
- `styles/main.css:530` — `box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.3);`
- `styles/main.css:540` — `color: white;`
- `styles/main.css:544` — `background-color: #3a7bc8;`
- `styles/main.css:556` — `background-color: #e8e8e8;`
- `styles/main.css:569` — `background-color: rgba(255, 255, 255, 0.2);`
- `styles/main.css:587` — `box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.1);`
- `styles/main.css:652` — `background: rgba(74, 144, 226, 0.14);`
- `styles/main.css:668` — `background: linear-gradient(135deg, #2ea043, #45c65a);`
- `styles/main.css:670` — `box-shadow: 0 4px 16px rgba(46, 160, 67, 0.42);`
- `styles/main.css:680` — `background-color: rgba(0, 0, 0, 0.5);`

### 天气信息/当前天气 (29)
- `styles/main.css:720` — `background-color: #ffebee;`
- `styles/main.css:735` — `background-color: #e8f5e9;`
- `styles/main.css:802` — `background: radial-gradient(circle at top left, rgba(255, 195, 113, 0.28), transparent 45%),`
- `styles/main.css:815` — `border: 1px solid rgba(255, 255, 255, 0.38);`
- `styles/main.css:816` — `background: linear-gradient(145deg, rgba(255, 255, 255, 0.42), rgba(255, 255, 255, 0.18));`
- `styles/main.css:818` — `box-shadow: 0 10px 24px rgba(29, 46, 74, 0.15);`
- `styles/main.css:859` — `border: 1px solid rgba(255, 255, 255, 0.4);`
- `styles/main.css:860` — `background: linear-gradient(145deg, rgba(30, 80, 160, 0.82) 0%, rgba(70, 40, 130, 0.72) 100%);`
- `styles/main.css:873` — `color: #ffffff;`
- `styles/main.css:875` — `text-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);`
- `styles/main.css:892` — `color: #ffffff;`
- `styles/main.css:893` — `text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);`
- `styles/main.css:916` — `color: #ffffff;`
- `styles/main.css:923` — `color: rgba(255, 255, 255, 0.92);`
- `styles/main.css:927` — `text-shadow: 0 1px 6px rgba(0, 0, 0, 0.4);`
- `styles/main.css:938` — `border: 1px solid rgba(255, 255, 255, 0.4);`
- `styles/main.css:940` — `background: rgba(255, 255, 255, 0.08);`
- `styles/main.css:948` — `box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);`
- `styles/main.css:953` — `background: rgba(255, 255, 255, 0.12);`
- `styles/main.css:955` — `box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);`
- `styles/main.css:962` — `color: rgba(52, 67, 89, 0.85);`
- `styles/main.css:973` — `color: #1f2a3d;`
- `styles/main.css:984` — `background: rgba(255, 255, 255, 0.15);`
- `styles/main.css:985` — `border-color: rgba(255, 255, 255, 0.55);`
- `styles/main.css:1156` — `color: white;`
- `styles/main.css:1161` — `color: white;`
- `styles/main.css:1166` — `color: white;`
- `styles/main.css:1171` — `color: white;`
- `styles/main.css:1244` — `color: #ff9800;`

### 朝晚霞预测旧样式/紧凑卡片 (55)
- `styles/main.css:1506` — `color: #4caf50;`
- `styles/main.css:1510` — `color: #4caf50;`
- `styles/main.css:1514` — `color: #ffc107;`
- `styles/main.css:1518` — `color: #ff9800;`
- `styles/main.css:1522` — `color: #f44336;`
- `styles/main.css:1544` — `color: white;`
- `styles/main.css:1545` — `background: #9e9e9e;`
- `styles/main.css:1558` — `background: linear-gradient(135deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0) 100%);`
- `styles/main.css:1563` — `background: linear-gradient(135deg, #4caf50 0%, #66bb6a 100%);`
- `styles/main.css:1570` — `background: linear-gradient(135deg, #ffc107 0%, #ffca28 100%);`
- `styles/main.css:1578` — `background: linear-gradient(135deg, #ff9800 0%, #ffa726 100%);`
- `styles/main.css:1585` — `background: linear-gradient(135deg, #f44336 0%, #ef5350 100%);`
- `styles/main.css:1593` — `background: linear-gradient(135deg, #4caf50 0%, #66bb6a 100%);`
- `styles/main.css:1600` — `background: linear-gradient(135deg, #ffc107 0%, #ffca28 100%);`
- `styles/main.css:1608` — `background: linear-gradient(135deg, #ff9800 0%, #ffa726 100%);`
- `styles/main.css:1615` — `background: linear-gradient(135deg, #f44336 0%, #ef5350 100%);`
- `styles/main.css:1703` — `background-color: #e0e0e0;`
- `styles/main.css:1789` — `border: 3px solid #4caf50;`
- `styles/main.css:1790` — `box-shadow: 0 2px 12px rgba(0,0,0,0.08);`
- `styles/main.css:1795` — `border-color: #4caf50;`
- `styles/main.css:1796` — `color: #4caf50;`
- `styles/main.css:1800` — `border-color: #ffc107;`
- `styles/main.css:1801` — `color: #ffc107;`
- `styles/main.css:1805` — `border-color: #ff9800;`
- `styles/main.css:1806` — `color: #ff9800;`
- `styles/main.css:1810` — `border-color: #f44336;`
- `styles/main.css:1811` — `color: #f44336;`
- `styles/main.css:1940` — `outline: 2px solid rgba(74, 144, 226, 0.75);`
- `styles/main.css:1987` — `background: var(--color-surface, rgba(30, 30, 50, 0.97));`
- `styles/main.css:1988` — `border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.15));`
- `styles/main.css:2022` — `background: rgba(255, 255, 255, 0.06);`
- `styles/main.css:2047` — `border-top: 1px dashed rgba(255, 255, 255, 0.12);`
- `styles/main.css:2087` — `color: #9e9e9e;`
- `styles/main.css:2090` — `.score-display.quality-excellent .score-big-number { color: #22c55e; }`
- `styles/main.css:2091` — `.score-display.quality-good .score-big-number { color: #f59e0b; }`
- `styles/main.css:2092` — `.score-display.quality-fair .score-big-number { color: #f97316; }`
- `styles/main.css:2093` — `.score-display.quality-poor .score-big-number { color: #ef4444; }`
- `styles/main.css:2122` — `border: 1px solid rgba(255, 255, 255, 0.08);`
- `styles/main.css:2175` — `.compact-extra-golden .hour-label { color: #e6a800; }`
- `styles/main.css:2176` — `.compact-extra-blue   .hour-label { color: #4a90d9; }`
- `styles/main.css:2322` — `background: rgba(255, 243, 224, 0.3);`
- `styles/main.css:2326` — `background: rgba(255, 183, 77, 0.08);`
- `styles/main.css:2334` — `border: 1px solid rgba(255, 255, 255, 0.08);`
- `styles/main.css:2360` — `background: rgba(255, 255, 255, 0.055);`
- `styles/main.css:2361` — `border: 1px solid rgba(255, 255, 255, 0.06);`
- `styles/main.css:2384` — `background: rgba(255, 255, 255, 0.06);`
- `styles/main.css:2387` — `color: #16a34a;`
- `styles/main.css:2390` — `color: #2563eb;`
- `styles/main.css:2393` — `color: #4ade80;`
- `styles/main.css:2396` — `color: #60a5fa;`
- `styles/main.css:2436` — `background: rgba(255,255,255,0.15);`
- `styles/main.css:2439` — `.prediction-card.quality-excellent::before { background: linear-gradient(90deg,#38bdf8,#d946ef,#f97316,#facc15); height: 4px; }`
- `styles/main.css:2440` — `.prediction-card.quality-good::before     { background: linear-gradient(90deg,#f59e0b,#fcd34d); }`
- `styles/main.css:2441` — `.prediction-card.quality-fair::before     { background: linear-gradient(90deg,#f97316,#fb923c); }`
- `styles/main.css:2442` — `.prediction-card.quality-poor::before     { background: linear-gradient(90deg,#ef4444,#f87171); }`

### 天气预报/7天/地图/图表 (28)
- `styles/main.css:2469` — `background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);`
- `styles/main.css:2470` — `color: white;`
- `styles/main.css:2481` — `background: linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%);`
- `styles/main.css:2603` — `border-left: 3px solid #ff9800;`
- `styles/main.css:2612` — `border-left: 3px solid #ff5722;`
- `styles/main.css:2632` — `background-color: rgba(59, 130, 246, 0.08);`
- `styles/main.css:2677` — `background-color: #e8e8e8;`
- `styles/main.css:2683` — `color: white;`
- `styles/main.css:2701` — `border-bottom: 1px solid rgba(255, 255, 255, 0.12);`
- `styles/main.css:2702` — `background: linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 0%, transparent 100%);`
- `styles/main.css:2716` — `border: 1px solid rgba(76,93,122,0.12);`
- `styles/main.css:2728` — `border-color: #5da3f0;`
- `styles/main.css:2778` — `background: linear-gradient(90deg, #2196f3, #ff5722);`
- `styles/main.css:2791` — `color: #2196f3;`
- `styles/main.css:2795` — `color: #ff5722;`
- `styles/main.css:2867` — `color: #2563eb;`
- `styles/main.css:2915` — `background-color: #e8e8e8;`
- `styles/main.css:2923` — `color: white;`
- `styles/main.css:2971` — `background-color: var(--color-surface, rgba(30,41,59,0.8));`
- `styles/main.css:2976` — `background: var(--color-surface, rgba(30,41,59,0.8));`
- `styles/main.css:2981` — `background-color: rgba(255, 255, 255, 0.06);`
- `styles/main.css:3270` — `background-color: rgba(244, 67, 54, 0.1);`
- `styles/main.css:3352` — `background: linear-gradient(90deg, #90caf9, #2196f3);`
- `styles/main.css:3390` — `background: rgba(33, 150, 243, 0.08);`
- `styles/main.css:3417` — `border-left: 4px solid #fbc02d;`
- `styles/main.css:3422` — `background: rgba(251, 192, 45, 0.08);`
- `styles/main.css:3423` — `border-left-color: #fbc02d;`
- `styles/main.css:3587` — `background-color: rgba(244, 67, 54, 0.1);`

### forecast section / PWA / toast (42)
- `styles/main.css:3610` — `background-color: #e8e8e8;`
- `styles/main.css:3685` — `background: linear-gradient(180deg, rgba(255,255,255,0.62) 0%, rgba(255,255,255,0.36) 100%);`
- `styles/main.css:3688` — `border: 1px solid rgba(255,255,255,0.45);`
- `styles/main.css:3689` — `box-shadow: 0 8px 20px rgba(24,39,75,0.08);`
- `styles/main.css:3699` — `box-shadow: 0 12px 24px rgba(24,39,75,0.13);`
- `styles/main.css:3704` — `color: #2f3948;`
- `styles/main.css:3709` — `color: rgba(47,57,72,0.65);`
- `styles/main.css:3732` — `color: rgba(47,57,72,0.75);`
- `styles/main.css:3739` — `#forecast-section .fcard-row-score.quality-excellent { color: #2f9e44; }`
- `styles/main.css:3740` — `#forecast-section .fcard-row-score.quality-good { color: #d39e00; }`
- `styles/main.css:3741` — `#forecast-section .fcard-row-score.quality-fair { color: #d97706; }`
- `styles/main.css:3742` — `#forecast-section .fcard-row-score.quality-poor { color: #dc2626; }`
- `styles/main.css:3747` — `background: linear-gradient(180deg, rgba(255, 255, 255, 0.62) 0%, rgba(255, 255, 255, 0.36) 100%);`
- `styles/main.css:3750` — `border: 1px solid rgba(255, 255, 255, 0.45);`
- `styles/main.css:3751` — `box-shadow: 0 8px 20px rgba(24, 39, 75, 0.08);`
- `styles/main.css:3758` — `box-shadow: 0 12px 24px rgba(24, 39, 75, 0.12);`
- `styles/main.css:3765` — `border-bottom: 1px solid rgba(76, 93, 122, 0.18);`
- `styles/main.css:3772` — `color: #2f3948;`
- `styles/main.css:3782` — `color: rgba(47, 57, 72, 0.72);`
- `styles/main.css:3796` — `border: 1px solid rgba(76, 93, 122, 0.2);`
- `styles/main.css:3797` — `background: rgba(255, 255, 255, 0.86);`
- `styles/main.css:3822` — `color: #2f3948;`
- `styles/main.css:3827` — `color: rgba(47, 57, 72, 0.72);`
- `styles/main.css:3839` — `color: #2f3948;`
- `styles/main.css:3851` — `color: rgba(47, 57, 72, 0.85);`
- `styles/main.css:3928` — `color: #2f3948;`
- `styles/main.css:3933` — `color: #6b7280;`
- `styles/main.css:3960` — `color: #2f9e44;`
- `styles/main.css:3964` — `color: #d39e00;`
- `styles/main.css:3968` — `color: #d97706;`
- `styles/main.css:3972` — `color: #dc2626;`
- `styles/main.css:3979` — `background-color: #f0f0f0;`
- `styles/main.css:3980` — `color: #999;`
- `styles/main.css:4113` — `background: linear-gradient(120deg, var(--header-surface) 0%, rgba(255, 237, 205, 0.72) 100%);`
- `styles/main.css:4126` — `box-shadow: 0 -4px 30px rgba(0, 0, 0, 0.05);`
- `styles/main.css:4256` — `.toast-success { border-left: 4px solid #4caf50; }`
- `styles/main.css:4257` — `.toast-error { border-left: 4px solid #f44336; }`
- `styles/main.css:4258` — `.toast-warning { border-left: 4px solid #ff9800; }`
- `styles/main.css:4259` — `.toast-info { border-left: 4px solid #2196f3; }`
- `styles/main.css:4275` — `color: #C49A3C;`
- `styles/main.css:4281` — `color: #C49A3C;`
- `styles/main.css:4288` — `color: #C49A3C;`

### 暗色/auto 主题与地图 (77)
- `styles/main.css:4385` — `border-bottom: 0.5px solid rgba(255, 200, 120, 0.15);`
- `styles/main.css:4386` — `box-shadow: 0 1px 0 rgba(255,200,120,0.08), 0 4px 20px rgba(0,0,0,0.4);`
- `styles/main.css:4404` — `border-bottom: 0.5px solid rgba(255, 200, 120, 0.15);`
- `styles/main.css:4405` — `box-shadow: 0 1px 0 rgba(255,200,120,0.08), 0 4px 20px rgba(0,0,0,0.4);`
- `styles/main.css:4416` — `background: linear-gradient(145deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02));`
- `styles/main.css:4417` — `border-color: rgba(255, 255, 255, 0.08);`
- `styles/main.css:4418` — `box-shadow: 0 10px 24px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.06);`
- `styles/main.css:4424` — `color: rgba(255, 255, 255, 0.92);`
- `styles/main.css:4427` — `color: rgba(255, 255, 255, 0.92);`
- `styles/main.css:4430` — `background: linear-gradient(145deg, rgba(20, 40, 90, 0.85) 0%, rgba(50, 20, 90, 0.75) 100%);`
- `styles/main.css:4431` — `border-color: rgba(255, 255, 255, 0.08);`
- `styles/main.css:4432` — `box-shadow: inset 0 1px 0 rgba(255,255,255,0.06);`
- `styles/main.css:4435` — `background-color: rgba(59, 130, 246, 0.08);`
- `styles/main.css:4440` — `background: rgba(255, 255, 255, 0.04);`
- `styles/main.css:4441` — `border-color: rgba(255, 255, 255, 0.08);`
- `styles/main.css:4442` — `box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);`
- `styles/main.css:4446` — `background: rgba(255, 255, 255, 0.08);`
- `styles/main.css:4447` — `box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);`
- `styles/main.css:4451` — `color: rgba(255, 255, 255, 0.75);`
- `styles/main.css:4455` — `color: rgba(255, 255, 255, 0.95);`
- `styles/main.css:4459` — `background: rgba(255, 255, 255, 0.10);`
- `styles/main.css:4460` — `border-color: rgba(255, 255, 255, 0.20);`
- `styles/main.css:4471` — `background: linear-gradient(145deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02));`
- `styles/main.css:4472` — `border-color: rgba(255, 255, 255, 0.08);`
- `styles/main.css:4473` — `box-shadow: 0 10px 24px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.06);`
- `styles/main.css:4479` — `color: rgba(255, 255, 255, 0.92);`
- `styles/main.css:4482` — `color: rgba(255, 255, 255, 0.92);`
- `styles/main.css:4485` — `background: linear-gradient(145deg, rgba(20, 40, 90, 0.85) 0%, rgba(50, 20, 90, 0.75) 100%);`
- `styles/main.css:4486` — `border-color: rgba(255, 255, 255, 0.08);`
- `styles/main.css:4487` — `box-shadow: inset 0 1px 0 rgba(255,255,255,0.06);`
- `styles/main.css:4490` — `background-color: rgba(59, 130, 246, 0.08);`
- `styles/main.css:4494` — `background: rgba(255, 255, 255, 0.04);`
- `styles/main.css:4495` — `border-color: rgba(255, 255, 255, 0.08);`
- `styles/main.css:4496` — `box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);`
- `styles/main.css:4500` — `background: rgba(255, 255, 255, 0.08);`
- `styles/main.css:4501` — `box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);`
- `styles/main.css:4505` — `color: rgba(255, 255, 255, 0.75);`
- `styles/main.css:4509` — `color: rgba(255, 255, 255, 0.95);`
- `styles/main.css:4513` — `background: rgba(255, 255, 255, 0.10);`
- `styles/main.css:4514` — `border-color: rgba(255, 255, 255, 0.20);`
- `styles/main.css:4580` — `background: var(--color-surface, #f8f7f4);`
- `styles/main.css:4585` — `border: 1px solid var(--color-border, rgba(0,0,0,0.1));`
- `styles/main.css:4596` — `color: var(--color-text-secondary, #6b7280);`
- `styles/main.css:4603` — `background: var(--color-primary, #f97316);`
- `styles/main.css:4604` — `color: white;`
- `styles/main.css:4605` — `box-shadow: 0 2px 8px rgba(249, 115, 22, 0.3);`
- `styles/main.css:4609` — `background: var(--color-surface-hover, rgba(0,0,0,0.05));`
- `styles/main.css:4610` — `color: var(--color-text, #111827);`
- `styles/main.css:4683` — `color: var(--color-text-secondary, #6b7280);`
- `styles/main.css:4705` — `color: var(--color-text-light, #9ca3af);`
- `styles/main.css:4749` — `border: 1px solid var(--color-border, rgba(255,255,255,0.15));`
- `styles/main.css:4750` — `background: var(--color-surface-2, rgba(255,255,255,0.06));`
- `styles/main.css:4751` — `color: var(--color-text-secondary, #9ca3af);`
- `styles/main.css:4761` — `background: var(--color-surface-3, rgba(255,255,255,0.12));`
- `styles/main.css:4762` — `color: var(--color-text, #f3f4f6);`
- `styles/main.css:4763` — `border-color: var(--color-primary-muted, rgba(251,146,60,0.4));`
- `styles/main.css:4767` — `color: #fb923c;`
- `styles/main.css:4768` — `border-color: rgba(251,146,60,0.5);`
- `styles/main.css:4769` — `background: rgba(251,146,60,0.08);`
- `styles/main.css:4773` — `color: #60a5fa;`
- `styles/main.css:4774` — `border-color: rgba(96,165,250,0.5);`
- `styles/main.css:4775` — `background: rgba(96,165,250,0.08);`
- `styles/main.css:4782` — `border: 1px solid var(--color-border, rgba(255,255,255,0.15));`
- `styles/main.css:4784` — `background: var(--color-surface-2, rgba(255,255,255,0.06));`
- `styles/main.css:4794` — `color: var(--color-text-secondary, #9ca3af);`
- `styles/main.css:4800` — `border-right: 1px solid var(--color-border, rgba(255,255,255,0.15));`
- `styles/main.css:4804` — `color: var(--color-text, #f3f4f6);`
- `styles/main.css:4805` — `background: rgba(255,255,255,0.08);`
- `styles/main.css:4809` — `background: rgba(251,146,60,0.15);`
- `styles/main.css:4810` — `color: #fb923c;`
- `styles/main.css:4828` — `background: rgba(255, 107, 53, 0.5);`
- `styles/main.css:4897` — `border: 1px solid rgba(255, 120, 0, 0.5);`
- `styles/main.css:4899` — `background: rgba(0, 0, 0, 0.4);`
- `styles/main.css:4910` — `background: rgba(255, 100, 0, 0.8);`
- `styles/main.css:4911` — `border-color: rgba(255, 200, 50, 0.9);`
- `styles/main.css:4979` — `box-shadow: 0 18px 45px rgba(91, 103, 145, 0.16);`
- `styles/main.css:4992` — `.prediction-app-card:hover { transform: none; box-shadow: 0 18px 45px rgba(91, 103, 145, 0.18); }`

### 朝晚霞新版卡片/需求46补丁 (42)
- `styles/main.css:5001` — `background: rgba(255,255,255,0.78);`
- `styles/main.css:5002` — `color: #4B5563;`
- `styles/main.css:5003` — `box-shadow: 0 8px 20px rgba(91,103,145,0.13);`
- `styles/main.css:5014` — `background: linear-gradient(135deg, #5DA8FF 0%, #9B5CF6 100%);`
- `styles/main.css:5015` — `color: #fff;`
- `styles/main.css:5021` — `box-shadow: 0 12px 24px rgba(117, 113, 255, 0.24);`
- `styles/main.css:5029` — `border: 1px solid rgba(255,255,255,0.72);`
- `styles/main.css:5030` — `box-shadow: 0 10px 30px rgba(91, 103, 145, 0.12);`
- `styles/main.css:5050` — `background: linear-gradient(135deg, #8CC8FF 0%, #F2A0DF 52%, #FFB86B 100%);`
- `styles/main.css:5051` — `box-shadow: inset 0 0 18px rgba(255,255,255,0.42);`
- `styles/main.css:5074` — `.score-gauge-number { font-size: 3.25rem; line-height: 1; font-weight: 800; color: #C13BEE; letter-spacing: -0.06em; }`
- `styles/main.css:5075` — `.score-gauge-total { font-size: 1.22rem; color: #B8BBC6; font-weight: 700; margin-left: 2px; }`
- `styles/main.css:5076` — `.score-gauge-grade { margin-top: 32px; font-size: 1.35rem; font-weight: 800; color: #A855F7; }`
- `styles/main.css:5078` — `.score-gauge-center .score-breakdown-hint-trigger { margin-top: 5px; color: #9B5CF6; opacity: 0.9; }`
- `styles/main.css:5090` — `background: rgba(249,250,252,0.86);`
- `styles/main.css:5093` — `.app-info-label { color: #666B76; font-size: 0.88rem; min-width: 0; }`
- `styles/main.css:5094` — `.app-info-value { color: var(--app-text); font-size: 0.95rem; font-weight: 800; white-space: nowrap; font-variant-numeric: tabular-nums; }`
- `styles/main.css:5097` — `.cloud-condition-item + .cloud-condition-item { padding-top: 12px; border-top: 1px solid #EEF0F5; }`
- `styles/main.css:5099` — `.cloud-condition-label { color: #3F4655; font-weight: 700; }`
- `styles/main.css:5101` — `.cloud-condition-track { margin-top: 9px; height: 8px; border-radius: 999px; background: #E5E7EB; overflow: hidden; }`
- `styles/main.css:5118` — `.analysis-group-positive .analysis-group-label { background: #EAF8EE; color: #1FA34A; }`
- `styles/main.css:5119` — `.analysis-group-neutral .analysis-group-label { background: #EAF3FF; color: #2F80ED; }`
- `styles/main.css:5120` — `.analysis-group-warning .analysis-group-label { background: #FFF4E6; color: #F97316; }`
- `styles/main.css:5128` — `border: 1px solid #EEF0F5;`
- `styles/main.css:5129` — `background: rgba(255,255,255,0.78);`
- `styles/main.css:5132` — `.analysis-item-positive .analysis-item-icon { background: #EAF8EE; color: #1FA34A; }`
- `styles/main.css:5133` — `.analysis-item-neutral .analysis-item-icon { background: #EAF3FF; color: #2F80ED; font-family: Georgia, serif; }`
- `styles/main.css:5134` — `.analysis-item-warning .analysis-item-icon { background: #FFF4E6; color: #F97316; }`
- `styles/main.css:5146` — `background: linear-gradient(135deg, #EAF8EE 0%, #F3FFF7 100%);`
- `styles/main.css:5147` — `color: #16A34A;`
- `styles/main.css:5151` — `.prediction-app-footer { text-align: center; color: #A0A7B8; font-size: 0.88rem; margin: 4px 0 2px; }`
- `styles/main.css:5273` — `box-shadow: 0 18px 45px rgba(91, 103, 145, 0.16);`
- `styles/main.css:5322` — `border-left: 1px solid #EEF0F5;`
- `styles/main.css:5595` — `background: rgba(255,255,255,0.06);`
- `styles/main.css:5596` — `border-color: rgba(255,255,255,0.10);`
- `styles/main.css:5605` — `background: rgba(255,255,255,0.16);`
- `styles/main.css:5608` — `background: rgba(34, 197, 94, 0.12);`
- `styles/main.css:5609` — `border: 1px solid rgba(34, 197, 94, 0.20);`
- `styles/main.css:6078` — `background: var(--sunset-time-border, #ff9800) !important;`
- `styles/main.css:6079` — `color: #fff !important;`
- `styles/main.css:6080` — `box-shadow: 0 2px 8px rgba(255,152,0,0.28) !important;`
- `styles/main.css:6084` — `background: rgba(255,255,255,0.72) !important;`

### 近期追加补丁/7天/亮色修复 (25)
- `styles/main.css:6252` — `color: #4EA3FF;`
- `styles/main.css:6437` — `box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);`
- `styles/main.css:6469` — `color: #fff !important;`
- `styles/main.css:6474` — `background: var(--glass-bg-hover, rgba(0,0,0,0.05)) !important;`
- `styles/main.css:6475` — `color: var(--color-text, #111827) !important;`
- `styles/main.css:6512` — `color: var(--color-primary, #f97316);`
- `styles/main.css:6899` — `background: rgba(255, 248, 238, 0.78) !important;`
- `styles/main.css:6900` — `border-color: rgba(186, 132, 72, 0.18) !important;`
- `styles/main.css:6905` — `background: rgba(169, 121, 70, 0.14) !important;`
- `styles/main.css:6914` — `box-shadow: 0 8px 20px rgba(117, 79, 39, 0.08), inset 0 1px 0 rgba(255,255,255,0.75);`
- `styles/main.css:6921` — `background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%) !important;`
- `styles/main.css:6922` — `color: #fffaf2 !important;`
- `styles/main.css:6923` — `box-shadow: 0 4px 12px rgba(217, 119, 6, 0.28) !important;`
- `styles/main.css:6930` — `background: rgba(255, 252, 246, 0.74) !important;`
- `styles/main.css:6931` — `border-color: rgba(186, 132, 72, 0.16) !important;`
- `styles/main.css:6954` — `background: rgba(255, 248, 238, 0.78) !important;`
- `styles/main.css:6955` — `border-color: rgba(186, 132, 72, 0.18) !important;`
- `styles/main.css:6958` — `background: rgba(169, 121, 70, 0.14) !important;`
- `styles/main.css:6965` — `box-shadow: 0 8px 20px rgba(117, 79, 39, 0.08), inset 0 1px 0 rgba(255,255,255,0.75);`
- `styles/main.css:6969` — `background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%) !important;`
- `styles/main.css:6970` — `color: #fffaf2 !important;`
- `styles/main.css:6971` — `box-shadow: 0 4px 12px rgba(217, 119, 6, 0.28) !important;`
- `styles/main.css:6975` — `background: rgba(255, 252, 246, 0.74) !important;`
- `styles/main.css:6976` — `border-color: rgba(186, 132, 72, 0.16) !important;`
- `styles/main.css:6999` — `color: var(--color-primary, #d97706);`

## JS / SVG / Canvas Findings

### `src/app.js` (2)
- `src/app.js:203` — `errorDiv.style.cssText = 'position: fixed; top: 20px; left: 50%; transform: translateX(-50%); z-index: 9999; max-width: 500px; background: #d32f2f; color: white; padding: 16px 24px; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);';`
- `src/app.js:219` — `retryBtn.style.cssText = 'margin-top: 12px; padding: 8px 16px; background: var(--color-card-bg); color: #d32f2f; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;';`

### `src/controllers/AppController.js` (1)
- `src/controllers/AppController.js:277` — `infoDiv.style.cssText = 'background: #e3f2fd; color: #1976d2; padding: 12px; border-radius: 4px; margin-top: 16px; font-size: 0.9rem;';`

### `src/controllers/ChartRenderController.js` (11)
- `src/controllers/ChartRenderController.js:12` — `return this.renderSimpleChart(data, id, 'temp', this.i18n.t('weather.temperature'), unit, '#ff6b6b');`
- `src/controllers/ChartRenderController.js:14` — `renderPrecipitationChart: (data, id) => this.renderSimpleChart(data, id, 'precipitation', this.i18n.t('weather.precipitation'), 'mm', '#4dabf7'),`
- `src/controllers/ChartRenderController.js:15` — `renderHumidityChart: (data, id) => this.renderSimpleChart(data, id, 'humidity', this.i18n.t('weather.humidity'), '%', '#51cf66'),`
- `src/controllers/ChartRenderController.js:18` — `return this.renderSimpleChart(data, id, 'windSpeed', this.i18n.t('weather.windSpeed'), unit, '#748ffc');`
- `src/controllers/ChartRenderController.js:20` — `renderPressureChart: (data, id) => this.renderSimpleChart(data, id, 'pressure', this.i18n.t('weather.pressure'), 'hPa', '#ffa94d'),`
- `src/controllers/ChartRenderController.js:21` — `renderCloudChart: (data, id) => this.renderSimpleChart(data, id, 'cloudCover', this.i18n.t('weather.cloudCover'), '%', '#868e96')`
- `src/controllers/ChartRenderController.js:147` — `const gridColor = resolveCssVar('--chart-grid-color', isDarkTheme ? 'rgba(255,255,255,0.38)' : 'rgba(51,51,51,0.18)');`
- `src/controllers/ChartRenderController.js:148` — `const textColor = resolveCssVar('--color-text', isDarkTheme ? 'rgba(255,255,255,0.92)' : '#333333');`
- `src/controllers/ChartRenderController.js:149` — `const cardBg = resolveCssVar('--color-card-bg', isDarkTheme ? 'rgba(15,22,40,0.85)' : '#ffffff');`
- `src/controllers/ChartRenderController.js:150` — `const pointStroke = isDarkTheme ? 'rgba(15,22,40,0.95)' : cardBg;`
- `src/controllers/ChartRenderController.js:153` — `html += `<h3 style="text-align: center; margin-bottom: 16px; color: var(--color-text); font-size: ${titleFontSize};">${label}${this.i18n.t('charts.trend')} (${unit})</h3>`;`

### `src/controllers/WeatherController.js` (8)
- `src/controllers/WeatherController.js:1198` — `container.innerHTML = '<p style="text-align:center;color:var(--color-text-light,#aaa);font-size:13px;padding:12px 0;">加载周边数据中…</p>';`
- `src/controllers/WeatherController.js:1232` — `container.innerHTML = `<p style="text-align:center;color:var(--color-text-light,#aaa);font-size:13px;padding:12px 0;">雷达加载超时，稍后自动重试</p>`;`
- `src/controllers/WeatherController.js:1493` — `container.innerHTML = `<p style="color: var(--color-text-light);">${this.i18n.t('surrounding.noData') || '当前周边区域火烧云观赏条件一般'}</p>`;`
- `src/controllers/WeatherController.js:1502` — `qualityClass = 'color: #4caf50;';`
- `src/controllers/WeatherController.js:1505` — `qualityClass = 'color: #ffc107;';`
- `src/controllers/WeatherController.js:1510` — `<div class="direction-item" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--border-color, #e0e0e0); cursor: pointer;" data-index="${index}">`
- `src/controllers/WeatherController.js:1702` — `statusEl.innerHTML = `<span style="color: var(--color-success, #4caf50);">✓ ${this.i18n.t('overlay.active') || '覆盖层已显示'}</span>`;`
- `src/controllers/WeatherController.js:1704` — `statusEl.innerHTML = `<span style="color: var(--color-error, #f44336);">✗ ${error || (this.i18n.t('overlay.error') || '覆盖层生成失败')}</span>`;`

### `src/controllers/PredictionController.js` (16)
- `src/controllers/PredictionController.js:1194` — `{ label: '高云', value: Number(clouds.high ?? 0), color: '#4EA3FF' },`
- `src/controllers/PredictionController.js:1195` — `{ label: '中云', value: Number(clouds.mid ?? 0), color: '#8B9DFF' },`
- `src/controllers/PredictionController.js:1196` — `{ label: '低云', value: Number(clouds.low ?? 0), color: '#B7C0CF' }`
- `src/controllers/PredictionController.js:1229` — `if (value >= 80) return ['#F97316', '#FACC15', '#E11D48'];`
- `src/controllers/PredictionController.js:1233` — `{ max: 20, color: '#9CA3AF' },`
- `src/controllers/PredictionController.js:1234` — `{ max: 40, color: '#FDBA74' },`
- `src/controllers/PredictionController.js:1235` — `{ max: 60, color: '#FB923C' },`
- `src/controllers/PredictionController.js:1236` — `{ max: 80, color: '#F97316' }`
- `src/controllers/PredictionController.js:1238` — `const color = stops.find(stop => value < stop.max)?.color || '#EA580C';`
- `src/controllers/PredictionController.js:1259` — `<circle cx="90" cy="90" r="${radius}" fill="none" stroke="#EEF1F7" stroke-width="12"/>`
- `src/controllers/PredictionController.js:1264` — `<div><span class="score-gauge-number" style="color:${scoreTheme[1]}">${forecast.score.toFixed(0)}</span><span class="score-gauge-total">/100</span></div>`
- `src/controllers/PredictionController.js:1267` — `<div class="score-gauge-grade" style="color:${scoreTheme[1]}">${forecast.scoreLabel}</div>`
- `src/controllers/PredictionController.js:1528` — `<span class="cloud-mini-bar-track"><span class="cloud-mini-bar-fill" style="width:${Math.min(high,100)}%;background:#90caf9;"></span></span>`
- `src/controllers/PredictionController.js:1533` — `<span class="cloud-mini-bar-track"><span class="cloud-mini-bar-fill" style="width:${Math.min(mid,100)}%;background:#64b5f6;"></span></span>`
- `src/controllers/PredictionController.js:1537` — `<span class="cloud-mini-bar-track"><span class="cloud-mini-bar-fill" style="width:${Math.min(low,100)}%;background:#42a5f5;"></span></span>`
- `src/controllers/PredictionController.js:1676` — `if (parts.length) analysis += `<br><span style="color:#888;font-size:11px;">${parts.join(' | ')}</span>`;`

### `src/utils/GlobalErrorBoundary.js` (9)
- `src/utils/GlobalErrorBoundary.js:198` — `background: rgba(0, 0, 0, 0.9);`
- `src/utils/GlobalErrorBoundary.js:221` — `color: #d32f2f;`
- `src/utils/GlobalErrorBoundary.js:226` — `color: #666;`
- `src/utils/GlobalErrorBoundary.js:240` — `background: #f5f5f5;`
- `src/utils/GlobalErrorBoundary.js:250` — `color: #333;`
- `src/utils/GlobalErrorBoundary.js:296` — `background: #d32f2f;`
- `src/utils/GlobalErrorBoundary.js:297` — `color: white;`
- `src/utils/GlobalErrorBoundary.js:300` — `box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);`
- `src/utils/GlobalErrorBoundary.js:342` — `color: white;`

### `src/components/RadarCompass.js` (37)
- `src/components/RadarCompass.js:25` — `bg:         v('--color-card-bg')     || '#ffffff',`
- `src/components/RadarCompass.js:26` — `border:     v('--color-border')      || 'rgba(0,0,0,0.10)',`
- `src/components/RadarCompass.js:27` — `ring:       v('--radar-ring')        || 'rgba(100,130,180,0.25)',`
- `src/components/RadarCompass.js:28` — `axisMain:   v('--radar-axis-main')   || 'rgba(100,130,180,0.30)',`
- `src/components/RadarCompass.js:29` — `axisSub:    v('--radar-axis-sub')    || 'rgba(100,130,180,0.12)',`
- `src/components/RadarCompass.js:30` — `labelFill:  v('--color-text')        || '#333333',`
- `src/components/RadarCompass.js:31` — `labelBg:    v('--color-bg')          || 'rgba(255,255,255,0.75)',`
- `src/components/RadarCompass.js:32` — `title:      v('--color-text')        || '#333333',`
- `src/components/RadarCompass.js:33` — `subtitle:   v('--color-text-light')  || '#666666',`
- `src/components/RadarCompass.js:34` — `legendText: v('--color-text-light')  || '#666666',`
- `src/components/RadarCompass.js:35` — `center:     v('--radar-center')      || 'rgba(249,115,22,0.9)',`
- `src/components/RadarCompass.js:37` — `cloudLow:   v('--radar-cloud-low')   || 'rgba(138,156,186,0.95)',`
- `src/components/RadarCompass.js:38` — `cloudMid:   v('--radar-cloud-mid')   || 'rgba(184,198,218,0.88)',`
- `src/components/RadarCompass.js:39` — `cloudHigh:  v('--radar-cloud-high')  || 'rgba(218,226,238,0.72)',`
- `src/components/RadarCompass.js:40` — `ringLow:    'rgba(100,150,220,0.08)',`
- `src/components/RadarCompass.js:41` — `ringMid:    'rgba(130,160,200,0.06)',`
- `src/components/RadarCompass.js:42` — `ringHigh:   'rgba(160,170,200,0.05)',`
- `src/components/RadarCompass.js:197` — `color: this._parseRgba(theme.cloudLow, { r: 138, g: 156, b: 186, a: 0.95 }),`
- `src/components/RadarCompass.js:209` — `color: this._parseRgba(theme.cloudMid, { r: 184, g: 198, b: 218, a: 0.88 }),`
- `src/components/RadarCompass.js:221` — `color: this._parseRgba(theme.cloudHigh, { r: 218, g: 226, b: 238, a: 0.72 }),`
- `src/components/RadarCompass.js:313` — `const ringStroke = T.ring || 'rgba(100,130,180,0.25)';`
- `src/components/RadarCompass.js:327` — `fill="rgba(15,23,42,0.85)"/>`
- `src/components/RadarCompass.js:329` — `fill="#ffffff" text-anchor="middle">${lbl}</text>`;`
- `src/components/RadarCompass.js:340` — `stroke="${main ? (T.axisMain || 'rgba(100,130,180,0.30)') : (T.axisSub || 'rgba(100,130,180,0.12)')}"`
- `src/components/RadarCompass.js:349` — `font-size="12" font-weight="800" fill="${T.labelFill || '#334155'}">${lbl}</text>`;`
- `src/components/RadarCompass.js:370` — `fill="${T.subtitle || '#666666'}">日出</text>`;`
- `src/components/RadarCompass.js:377` — `fill="${T.subtitle || '#666666'}">日落</text>`;`
- `src/components/RadarCompass.js:384` — `fill="${T.subtitle || '#666666'}">日落</text>`;`
- `src/components/RadarCompass.js:387` — `const center = `<circle cx="${cx}" cy="${cy}" r="4" fill="${T.center || 'rgba(249,115,22,0.9)'}" stroke="rgba(0,0,0,0.2)" stroke-width="1.5"/>`;`
- `src/components/RadarCompass.js:392` — `[T.cloudLow || 'rgba(138,156,186,0.95)', '低云'],`
- `src/components/RadarCompass.js:393` — `[T.cloudMid || 'rgba(184,198,218,0.88)', '中云'],`
- `src/components/RadarCompass.js:394` — `[T.cloudHigh || 'rgba(218,226,238,0.72)', '高云'],`
- `src/components/RadarCompass.js:401` — `<text x="${legendOffsetX + 27 + i * 58}" y="10" font-size="11" font-weight="700" fill="${T.title || '#334155'}">${l}</text>``
- `src/components/RadarCompass.js:405` — `<div style="border:1px solid ${T.border || 'rgba(0,0,0,0.1)'};border-radius:12px;`
- `src/components/RadarCompass.js:406` — `background:${T.bg || '#ffffff'};padding:10px 10px 8px;font-family:${zhFont};">`
- `src/components/RadarCompass.js:408` — `<div style="font-size:13px;font-weight:600;color:${T.title || '#333333'};">周边云况雷达</div>`
- `src/components/RadarCompass.js:409` — `<div style="font-size:11px;color:${T.subtitle || '#666666'};">20km · 连续云场</div>`

### `src/components/ChinaMapCanvas.js` (31)
- `src/components/ChinaMapCanvas.js:222` — `color: 'rgba(255,255,255,0.9)',`
- `src/components/ChinaMapCanvas.js:223` — `fillColor: 'rgba(255,140,0,0.95)',`
- `src/components/ChinaMapCanvas.js:817` — `const textColor = isDark ? '#fff' : '#333';`
- `src/components/ChinaMapCanvas.js:829` — `fillColor: isDark ? 'rgba(255,120,0,0.8)' : 'rgba(0,0,0,0.6)',`
- `src/components/ChinaMapCanvas.js:830` — `color: isDark ? 'rgba(255,120,0,1)' : 'rgba(0,0,0,0.8)',`
- `src/components/ChinaMapCanvas.js:842` — `color: ${textColor};`
- `src/components/ChinaMapCanvas.js:843` — `text-shadow: ${isDark ? '0 1px 2px rgba(0,0,0,0.8)' : '0 1px 2px rgba(255,255,255,0.8)'};`
- `src/components/ChinaMapCanvas.js:891` — `this._map.getContainer().style.backgroundColor = '#1a1f35';`
- `src/components/ChinaMapCanvas.js:895` — `color: 'rgba(255, 120, 0, 0.4)',  // 边界线：橙色`
- `src/components/ChinaMapCanvas.js:896` — `fillColor: 'rgba(255, 120, 0, 0.05)',`
- `src/components/ChinaMapCanvas.js:927` — `this._map.getContainer().style.backgroundColor = '#f0f0f0';`
- `src/components/ChinaMapCanvas.js:931` — `color: 'rgba(0, 0, 0, 0.3)',  // 边界线：深灰色`
- `src/components/ChinaMapCanvas.js:932` — `fillColor: 'rgba(0, 0, 0, 0.02)',`
- `src/components/ChinaMapCanvas.js:968` — `'background:rgba(30,30,40,0.88)',`
- `src/components/ChinaMapCanvas.js:969` — `'color:#eee',`
- `src/components/ChinaMapCanvas.js:1003` — `{ score: 0, label: '<40', color: 'rgba(255,255,255,0.08)' },`
- `src/components/ChinaMapCanvas.js:1004` — `{ score: 40, label: '40', color: isSunrise ? 'rgba(255,230,210,0.18)' : 'rgba(255,230,210,0.14)' },`
- `src/components/ChinaMapCanvas.js:1005` — `{ score: 50, label: '50', color: isSunrise ? 'rgba(255,185,150,0.30)' : 'rgba(255,185,150,0.22)' },`
- `src/components/ChinaMapCanvas.js:1006` — `{ score: 60, label: '60', color: isSunrise ? 'rgba(248,132,82,0.46)' : 'rgba(248,132,54,0.36)' },`
- `src/components/ChinaMapCanvas.js:1007` — `{ score: 70, label: '70+', color: isSunrise ? 'rgba(218,78,28,0.65)' : 'rgba(218,78,28,0.55)' },`
- `src/components/ChinaMapCanvas.js:1010` — `{ score: 0, label: '0', color: isSunrise ? 'rgba(255,230,210,0.06)' : 'rgba(255,230,210,0.05)' },`
- `src/components/ChinaMapCanvas.js:1011` — `{ score: 20, label: '20', color: isSunrise ? 'rgba(255,205,175,0.16)' : 'rgba(255,205,175,0.13)' },`
- `src/components/ChinaMapCanvas.js:1012` — `{ score: 40, label: '40', color: isSunrise ? 'rgba(255,184,126,0.28)' : 'rgba(255,184,126,0.22)' },`
- `src/components/ChinaMapCanvas.js:1013` — `{ score: 55, label: '55', color: isSunrise ? 'rgba(238,120,90,0.44)' : 'rgba(238,120,90,0.34)' },`
- `src/components/ChinaMapCanvas.js:1014` — `{ score: 70, label: '70+', color: isSunrise ? 'rgba(218,78,28,0.65)' : 'rgba(218,78,28,0.55)' },`
- `src/components/ChinaMapCanvas.js:1095` — `.setContent('<span style="color:#aaa;">查询中…</span>')`
- `src/components/ChinaMapCanvas.js:1121` — `const scoreColor = isHigh ? '#ff8c00' : (score !== null && score >= 30 ? '#ffc107' : '#aaa');`
- `src/components/ChinaMapCanvas.js:1129` — `<div style="color:${scoreColor};font-size:15px;font-weight:700;">${scoreText}</div>`
- `src/components/ChinaMapCanvas.js:1130` — `${cloudHumidityLine ? `<div style="color:#b5b5b5;font-size:11px;">${cloudHumidityLine}</div>` : ''}`
- `src/components/ChinaMapCanvas.js:1131` — `<div style="color:#888;font-size:10px;margin-top:2px;">${this._currentPeriod === 'sunrise' ? '朝霞' : '晚霞'} · 当前时段</div>`
- `src/components/ChinaMapCanvas.js:1135` — `loadingPopup.setContent(`<span style="color:#f66;">查询失败: ${err.message}</span>`);`

### `src/components/SettingsPanel.js` (7)
- `src/components/SettingsPanel.js:172` — `<small class="setting-hint" style="color: var(--color-warning, #f59e0b);" id="provider-issues">-</small>`
- `src/components/SettingsPanel.js:505` — `<div class="favorite-location-item" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-top: 1px solid var(--border-color, #e0e0e0);">`
- `src/components/SettingsPanel.js:508` — `? `<span style="color: var(--accent-color, #4CAF50); font-size: 12px;">⭐ ${this.i18n.t('settings.currentDefaultLocation')}</span>``
- `src/components/SettingsPanel.js:512` — `border: 1px solid var(--accent-color, #4CAF50);`
- `src/components/SettingsPanel.js:513` — `color: var(--accent-color, #4CAF50);`
- `src/components/SettingsPanel.js:536` — `background: var(--accent-color, #4CAF50) !important;`
- `src/components/SettingsPanel.js:537` — `color: white !important;`

### `src/services/MockWindyMapService.js` (3)
- `src/services/MockWindyMapService.js:57` — `mockMap.style.cssText = 'width:100%;height:100%;position:relative;background:#1a1a2e;border-radius:8px;overflow:hidden;';`
- `src/services/MockWindyMapService.js:61` — `title.style.cssText = 'position:absolute;top:10px;left:50%;transform:translateX(-50%);color:white;z-index:10;font-size:18px;font-weight:bold;text-shadow:1px 1px 3px rgba(0,0,0,0.8);';`
- `src/services/MockWindyMapService.js:65` — `info.style.cssText = 'position:absolute;bottom:10px;left:10px;color:rgba(255,255,255,0.7);z-index:10;font-size:12px;';`

### `src/services/RadarChartService.js` (28)
- `src/services/RadarChartService.js:12` — `excellent: '#4caf50', // 绿色 - 优秀`
- `src/services/RadarChartService.js:13` — `good: '#ffc107',       // 黄色 - 良好`
- `src/services/RadarChartService.js:14` — `fair: '#9e9e9e',       // 灰色 - 一般`
- `src/services/RadarChartService.js:15` — `poor: '#f44336',       // 红色 - 较差`
- `src/services/RadarChartService.js:16` — `grid: '#e0e0e0',       // 网格线颜色`
- `src/services/RadarChartService.js:17` — `text: '#333333',       // 文本颜色`
- `src/services/RadarChartService.js:18` — `background: '#ffffff'  // 背景颜色`
- `src/services/RadarChartService.js:23` — `excellent: '#66bb6a',`
- `src/services/RadarChartService.js:24` — `good: '#ffb74d',`
- `src/services/RadarChartService.js:25` — `fair: '#bdbdbd',`
- `src/services/RadarChartService.js:26` — `poor: '#ef5350',`
- `src/services/RadarChartService.js:27` — `grid: '#333333',`
- `src/services/RadarChartService.js:28` — `text: '#e0e0e0',`
- `src/services/RadarChartService.js:29` — `background: '#1e1e1e'`
- `src/services/RadarChartService.js:191` — `ctx.fillStyle = 'rgba(76, 175, 80, 0.3)';`
- `src/services/RadarChartService.js:325` — `<tr style="background: #f5f5f5;">`
- `src/services/RadarChartService.js:326` — `<th style="padding: 8px; border: 1px solid #ddd;">方位</th>`
- `src/services/RadarChartService.js:327` — `<th style="padding: 8px; border: 1px solid #ddd;">距离</th>`
- `src/services/RadarChartService.js:328` — `<th style="padding: 8px; border: 1px solid #ddd;">评分</th>`
- `src/services/RadarChartService.js:329` — `<th style="padding: 8px; border: 1px solid #ddd;">状态</th>`
- `src/services/RadarChartService.js:337` — `statusClass = 'color: #4caf50;';`
- `src/services/RadarChartService.js:340` — `statusClass = 'color: #ffc107;';`
- `src/services/RadarChartService.js:343` — `statusClass = 'color: #9e9e9e;';`
- `src/services/RadarChartService.js:346` — `statusClass = 'color: #f44336;';`
- `src/services/RadarChartService.js:352` — `<td style="padding: 8px; border: 1px solid #ddd;">${point.name} (${point.label})</td>`
- `src/services/RadarChartService.js:353` — `<td style="padding: 8px; border: 1px solid #ddd;">${point.distance}km</td>`
- `src/services/RadarChartService.js:354` — `<td style="padding: 8px; border: 1px solid #ddd;">${point.score}分</td>`
- `src/services/RadarChartService.js:355` — `<td style="padding: 8px; border: 1px solid #ddd; ${statusClass}">${statusText}</td>`

### `src/services/FireCloudOverlayService.js` (4)
- `src/services/FireCloudOverlayService.js:253` — `gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha})`);`
- `src/services/FireCloudOverlayService.js:254` — `gradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${alpha * 0.5})`);`
- `src/services/FireCloudOverlayService.js:255` — `gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);`
- `src/services/FireCloudOverlayService.js:266` — `ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';`

### `src/services/WindyMapService.js` (6)
- `src/services/WindyMapService.js:248` — `wind: { low: '#4fc3f7', high: '#e53935' },   // 蓝→红`
- `src/services/WindyMapService.js:249` — `temp: { low: '#42a5f5', high: '#ef5350' },   // 蓝→红`
- `src/services/WindyMapService.js:250` — `clouds: { low: '#b0bec5', high: '#37474f' }, // 浅灰→深灰`
- `src/services/WindyMapService.js:251` — `rain: { low: '#e3f2fd', high: '#1565c0' }    // 浅蓝→深蓝`
- `src/services/WindyMapService.js:264` — `color: '#fff',`
- `src/services/WindyMapService.js:311` — `return `rgb(${r},${g},${b})`;`

### `src/services/ChinaRasterOverlay.js` (8)
- `src/services/ChinaRasterOverlay.js:598` — `? 'rgba(255, 236, 246, 0.48)'`
- `src/services/ChinaRasterOverlay.js:599` — `: 'rgba(255, 224, 238, 0.22)';`
- `src/services/ChinaRasterOverlay.js:619` — `ctx.fillStyle = 'rgba(255, 246, 252, 0.72)';`
- `src/services/ChinaRasterOverlay.js:620` — `ctx.strokeStyle = 'rgba(114, 49, 109, 0.35)';`
- `src/services/ChinaRasterOverlay.js:657` — `ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${Math.max(0.22, a)})`;`
- `src/services/ChinaRasterOverlay.js:670` — `ctx.strokeStyle = 'rgba(255, 245, 100, 0.95)';`
- `src/services/ChinaRasterOverlay.js:683` — `ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';`
- `src/services/ChinaRasterOverlay.js:684` — `ctx.fillStyle = 'rgba(255, 245, 180, 0.98)';`

### `src/services/ChinaSpotsOverlay.js` (15)
- `src/services/ChinaSpotsOverlay.js:170` — `haloColor: `rgba(${glow.r}, ${glow.g}, ${glow.b}, ${alpha(0.19, scoreNorm, zoomOpacityFactor)})`,`
- `src/services/ChinaSpotsOverlay.js:171` — `plumeColor: `rgba(${glow.r}, ${glow.g}, ${glow.b}, ${alpha(0.15, scoreNorm, zoomOpacityFactor)})`,`
- `src/services/ChinaSpotsOverlay.js:172` — `innerColor: `rgba(${warm.r}, ${warm.g}, ${warm.b}, ${alpha(0.76, scoreNorm, zoomOpacityFactor)})`,`
- `src/services/ChinaSpotsOverlay.js:173` — `midColor: `rgba(${glow.r}, ${glow.g}, ${glow.b}, ${alpha(0.38, scoreNorm, zoomOpacityFactor)})`,`
- `src/services/ChinaSpotsOverlay.js:174` — `outerColor: `rgba(${glow.r}, ${glow.g}, ${glow.b}, 0)``
- `src/services/ChinaSpotsOverlay.js:252` — `'border: 2px solid rgba(255,120,0,0.7)',`
- `src/services/ChinaSpotsOverlay.js:254` — `'background: rgba(0,0,0,0.6)',`
- `src/services/ChinaSpotsOverlay.js:255` — `'color: #fff',`
- `src/services/ChinaSpotsOverlay.js:289` — `this._button.style.background = 'rgba(255, 100, 0, 0.85)';`
- `src/services/ChinaSpotsOverlay.js:290` — `this._button.style.borderColor = 'rgba(255,200,50,0.9)';`
- `src/services/ChinaSpotsOverlay.js:291` — `this._button.style.boxShadow = '0 0 8px rgba(255,120,0,0.6)';`
- `src/services/ChinaSpotsOverlay.js:293` — `this._button.style.background = 'rgba(0,0,0,0.6)';`
- `src/services/ChinaSpotsOverlay.js:294` — `this._button.style.borderColor = 'rgba(255,120,0,0.7)';`
- `src/services/ChinaSpotsOverlay.js:396` — `plumeGrad.addColorStop(1.0, 'rgba(255, 180, 80, 0)');`
- `src/services/ChinaSpotsOverlay.js:404` — `haloGrad.addColorStop(1.0, 'rgba(255, 180, 80, 0)');`

### `src/services/HeatmapLayer.js` (4)
- `src/services/HeatmapLayer.js:9` — `{ min: 80, color: [255, 69, 0],   alpha: 0.75 },  // #FF4500 深橙红：顶级`
- `src/services/HeatmapLayer.js:10` — `{ min: 65, color: [255, 140, 0],  alpha: 0.65 },  // #FF8C00 橙色：优质`
- `src/services/HeatmapLayer.js:11` — `{ min: 40, color: [255, 209, 102], alpha: 0.5  },  // #FFD166 金黄：还行`
- `src/services/HeatmapLayer.js:225` — `ctx.fillStyle = `rgba(${r},${g},${b},${(a / 255).toFixed(2)})`;`

### `src/services/NativeFireCloudRenderer.js` (1)
- `src/services/NativeFireCloudRenderer.js:161` — `ctx.fillStyle = `rgba(${r_},${g},${b},${(a / 255 * this.opacity).toFixed(2)})`;`

### `src/services/ShareCardGenerator.js` (52)
- `src/services/ShareCardGenerator.js:16` — `bg: ['#111827', '#2A1748', '#5B2C64'],`
- `src/services/ShareCardGenerator.js:17` — `accent: '#FFB35C',`
- `src/services/ShareCardGenerator.js:18` — `accent2: '#FF7A5A',`
- `src/services/ShareCardGenerator.js:19` — `card: 'rgba(17,24,39,0.68)',`
- `src/services/ShareCardGenerator.js:20` — `cardStroke: 'rgba(255,255,255,0.16)',`
- `src/services/ShareCardGenerator.js:21` — `gaugeColors: ['#FFB35C', '#F59E0B', '#93C5FD'],`
- `src/services/ShareCardGenerator.js:24` — `bg: ['#0B1020', '#191336', '#321736'],`
- `src/services/ShareCardGenerator.js:25` — `accent: '#FF9F45',`
- `src/services/ShareCardGenerator.js:26` — `accent2: '#F97316',`
- `src/services/ShareCardGenerator.js:27` — `card: 'rgba(15,23,42,0.72)',`
- `src/services/ShareCardGenerator.js:28` — `cardStroke: 'rgba(255,255,255,0.14)',`
- `src/services/ShareCardGenerator.js:29` — `gaugeColors: ['#FF9F45', '#F59E0B', '#93C5FD'],`
- `src/services/ShareCardGenerator.js:86` — `horizon.addColorStop(0, 'rgba(255,158,76,0.28)');`
- `src/services/ShareCardGenerator.js:87` — `horizon.addColorStop(0.45, 'rgba(244,114,72,0.13)');`
- `src/services/ShareCardGenerator.js:88` — `horizon.addColorStop(1, 'rgba(0,0,0,0)');`
- `src/services/ShareCardGenerator.js:93` — `coolGlow.addColorStop(0, 'rgba(59,130,246,0.16)');`
- `src/services/ShareCardGenerator.js:94` — `coolGlow.addColorStop(1, 'rgba(0,0,0,0)');`
- `src/services/ShareCardGenerator.js:99` — `ctx.fillStyle = 'rgba(255,255,255,0.018)';`
- `src/services/ShareCardGenerator.js:126` — `ctx.fillStyle = '#FFFFFF';`
- `src/services/ShareCardGenerator.js:132` — `ctx.fillStyle = 'rgba(255,255,255,0.58)';`
- `src/services/ShareCardGenerator.js:137` — `ctx.fillStyle = 'rgba(255,255,255,0.62)';`
- `src/services/ShareCardGenerator.js:150` — `outer.addColorStop(0, 'rgba(255,255,255,0.95)');`
- `src/services/ShareCardGenerator.js:151` — `outer.addColorStop(0.55, 'rgba(255,192,138,0.95)');`
- `src/services/ShareCardGenerator.js:152` — `outer.addColorStop(1, 'rgba(255,120,80,0.92)');`
- `src/services/ShareCardGenerator.js:154` — `outer.addColorStop(0, 'rgba(255,255,255,0.95)');`
- `src/services/ShareCardGenerator.js:155` — `outer.addColorStop(0.55, 'rgba(255,176,96,0.95)');`
- `src/services/ShareCardGenerator.js:156` — `outer.addColorStop(1, 'rgba(255,88,38,0.92)');`
- `src/services/ShareCardGenerator.js:166` — `ctx.fillStyle = 'rgba(255,255,255,0.22)';`
- `src/services/ShareCardGenerator.js:170` — `ctx.fillStyle = '#FFFFFF';`
- `src/services/ShareCardGenerator.js:179` — `ctx.strokeStyle = 'rgba(255,255,255,0.45)';`
- `src/services/ShareCardGenerator.js:203` — `ctx.fillStyle = 'rgba(255,255,255,0.62)';`
- `src/services/ShareCardGenerator.js:208` — `ctx.fillStyle = '#FFFFFF';`
- `src/services/ShareCardGenerator.js:213` — `ctx.fillStyle = 'rgba(255,255,255,0.88)';`
- `src/services/ShareCardGenerator.js:221` — `ctx.fillStyle = 'rgba(255,255,255,0.54)';`
- `src/services/ShareCardGenerator.js:229` — `ctx.fillStyle = 'rgba(255,255,255,0.12)';`
- `src/services/ShareCardGenerator.js:234` — `pg.addColorStop(0, '#FBBF24');`
- `src/services/ShareCardGenerator.js:242` — `ctx.fillStyle = 'rgba(255,255,255,0.44)';`
- `src/services/ShareCardGenerator.js:262` — `ctx.fillStyle = '#FFFFFF';`
- `src/services/ShareCardGenerator.js:269` — `ctx.fillStyle = 'rgba(255,255,255,0.75)';`
- `src/services/ShareCardGenerator.js:284` — `this._glassCard(ctx, cardX, cardY, cardW, cardH, { ...theme, card: 'rgba(15,23,42,0.52)' }, 22);`
- `src/services/ShareCardGenerator.js:293` — `ctx.fillStyle = '#FFFFFF';`
- `src/services/ShareCardGenerator.js:301` — `ctx.fillStyle = 'rgba(255,255,255,0.7)';`
- `src/services/ShareCardGenerator.js:326` — `{ label: '高云', value: high, color: '#FDE68A' },`
- `src/services/ShareCardGenerator.js:327` — `{ label: '中云', value: mid, color: '#FDBA74' },`
- `src/services/ShareCardGenerator.js:328` — `{ label: '低云', value: low, color: low >= 50 ? '#FB7185' : '#93C5FD' },`
- `src/services/ShareCardGenerator.js:335` — `ctx.fillStyle = 'rgba(255,255,255,0.7)';`
- `src/services/ShareCardGenerator.js:340` — `ctx.fillStyle = '#FFFFFF';`
- `src/services/ShareCardGenerator.js:349` — `ctx.fillStyle = 'rgba(255,255,255,0.2)';`
- `src/services/ShareCardGenerator.js:393` — `this._glassCard(ctx, cardX, cardY, cardW, cardH, { ...theme, card: 'rgba(255,255,255,0.10)' }, 22);`
- `src/services/ShareCardGenerator.js:395` — `ctx.fillStyle = '#FFFFFF';`
- `src/services/ShareCardGenerator.js:410` — `ctx.strokeStyle = 'rgba(255,255,255,0.25)';`
- `src/services/ShareCardGenerator.js:417` — `ctx.fillStyle = 'rgba(255,255,255,0.6)';`
