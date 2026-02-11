# 实现计划：天气晚霞预测器

## 概述

本实现计划将天气晚霞预测器分解为离散的编码步骤，从核心数据模型开始，逐步构建服务层、控制层和UI层。每个任务都包含具体的实现目标和需求追溯。

## 已完成的核心任务

- [x] 1. 项目初始化和基础结构
- [x] 2. 实现核心数据模型
- [x] 3. 实现存储服务
- [x] 4. 实现Windy API服务
- [x] 5. 实现地理编码服务
- [x] 6. 实现晚霞预测算法服务
- [x] 7. 实现控制层
- [x] 8. 实现错误处理模块
- [x] 9. 实现UI交互逻辑
- [x] 10. 实现响应式CSS样式
- [x] 11. 集成所有组件

## 历史任务（已完成，精简归档）

为避免任务清单过长，以下将 Phase 1~6 的已完成内容精简为归档摘要；详细实现步骤与测试记录请参考 Git 历史与相关提交。

- [x] 任务 12：天气界面优化（需求11）
- [x] 任务 13：朝霞晚霞预测增强功能（需求12）
- [x] 任务 14：最近搜索历史（需求13）
- [x] 任务 15：后端代理 Windy API 与密钥保护（需求15）
- [x] 任务 16：统一设置面板（需求16）
- [x] 任务 17：个性化设置（需求17）
- [x] 任务 18：集成 Windy Map Forecast 地图预测 API（需求18）
- [x] 任务 19：周边火烧云可视化（需求19）
- [x] 任务 20：多语言支持（需求14）
- [x] 任务 21：后端代理模式与API配置优化
- [x] 任务 22：Python GFS 数据处理服务
- [x] 任务 23：Node.js 集成 GFS API
- [x] 任务 24：文档和部署
- [x] 任务 25：UI 毛玻璃效果（需求21）
- [x] 任务 26：前后端分离架构重构（需求22）

---

## 代码质量优化任务（Phase 7）

### 任务 27：UX 改进 — alert() 替换为 Toast 通知

- [x] 27.1 创建 ToastService 通知组件
  - 实现 show(message, type, duration) 方法
  - 支持 success / error / warning / info 四种类型
  - 自动消失（默认3秒），支持手动关闭
  - 响应式布局，移动端适配
  - 毛玻璃效果与现有 UI 一致
  - _关联需求：10, 21_

- [x] 27.2 替换所有 alert() 调用
  - AppController.js 中的 alert()
  - WeatherController.js 中的 alert()
  - LanguageSelector.js 中的 alert()
  - NotificationService.js 中的 alert()
  - 确保每处替换使用正确的通知类型
  - _关联需求：10_

- [x] 27.3 添加 ToastService 单元测试
  - 测试各类型通知显示/隐藏
  - 测试自动消失和手动关闭
  - 测试多条通知排队显示

### 任务 28：AppController 拆分重构

- [ ] 28.1 提取 ChartRenderController
  - 从 AppController 提取图表渲染逻辑（_renderSimpleChart 等方法）
  - 约 200-300 行代码
  - 保持与 WeatherController 的接口不变
  - _关联需求：11_

- [x] 28.2 提取 UIStateController
  - 提取 showLoading, showError, showSuccess, showAPIKeyModal 等 UI 状态方法
  - 提取 showLocationError, clearLocationError 等位置错误方法
  - 约 200-300 行代码
  - _关联需求：10_

- [x] 28.3 提取 FavoriteController
  - 提取收藏位置管理逻辑（loadFavoriteLocations, toggleFavorite 等）
  - 提取搜索历史管理逻辑（loadSearchHistory, clearSearchHistory 等）
  - 约 150-200 行代码
  - _关联需求：12, 13_

- [ ] 28.4 更新 AppController 为协调者
  - AppController 仅保留初始化和事件绑定逻辑
  - 通过依赖注入使用新提取的控制器
  - 目标：AppController 减少到 800 行以下
  - 更新所有相关测试
  - _关联需求：全部_

### 任务 29：后端集成测试补充

- [x] 29.1 预测 API 集成测试
  - POST /api/prediction/calculate 端点测试
  - POST /api/prediction/surrounding 端点测试
  - POST /api/prediction/enhanced 端点测试
  - POST /api/prediction/enhanced/batch 端点测试
  - 验证请求参数校验、响应格式、错误处理
  - _关联需求：22_

- [x] 29.2 火烧云 API 集成测试
  - GET /api/firecloud/overlay 端点测试
  - GET /api/firecloud/health 端点测试
  - POST /api/firecloud/cache/clear 端点测试
  - 验证参数范围、缓存行为、超时处理
  - _关联需求：20_

- [ ] 29.3 天气数据 API 集成测试
  - GET /api/weather/forecast 端点测试
  - GET /api/config/map-key 端点测试
  - GET /health 端点测试
  - 验证代理转发、错误传播、CORS 配置
  - _关联需求：15_

### 任务 30：E2E 测试补充

- [x] 30.1 主题持久化 E2E 测试
  - 切换主题 → 刷新页面 → 验证主题保持
  - 自动模式跟随系统 prefers-color-scheme
  - 三种主题（light/dark/auto）完整流程
  - _关联需求：17_

- [x] 30.2 设置面板 E2E 测试
  - 语言切换 → 验证 UI 文本变化
  - 单位切换（°C/°F, m/s/km/h）→ 验证数据展示
  - 默认位置设置 → 刷新 → 验证自动加载
  - _关联需求：16, 17_

- [x] 30.3 搜索历史和收藏 E2E 测试
  - 搜索城市 → 验证历史记录出现
  - 收藏位置 → 刷新 → 验证收藏列表
  - LRU 5 条限制验证
  - _关联需求：12, 13_
  - 备注：30.x 用例已补齐，需在本地安装 Playwright 浏览器后二次验收。

### 任务 31：后端 API 文档

- [ ] 31.1 创建 OpenAPI 3.0 规范文件
  - 覆盖所有后端端点（天气、预测、火烧云、健康检查）
  - 包含请求/响应 Schema 和示例
  - 分组标签：天气数据、预测API、火烧云覆盖层、系统
  - _关联需求：22_

- [ ] 31.2 清理代码中的 TODO 注释
  - 移除已完成的 TODO
  - 为仍有效的 TODO 添加上下文说明
  - _关联：代码质量_

---

## 执行计划：Phase 7 分工

### Agent 1（UX + 重构）
| 优先级 | 任务 | 预计工时 |
|--------|------|----------|
| 1 | 27.1-27.3 alert() 替换 | 1-2h |
| 2 | 28.1-28.4 AppController 拆分 | 3-4h |

### Agent 2（测试 + 文档）
| 优先级 | 任务 | 预计工时 |
|--------|------|----------|
| 1 | 31.1-31.2 API 文档 + TODO 清理 | 1-2h |
| 2 | 29.1-29.3 后端集成测试 | 2-3h |
| 3 | 30.1-30.3 E2E 测试补充 | 1-2h |

---

## 紧急任务：测试修复 (83 failures / 11 suites)

> **状态：修复中** (2026-02-10 发现，已修复 60/83)
> 全量测试 600 个。当前：571 通过，23 失败，6 跳过。
> **前置条件**：必须先运行 `cd server && npm install` 安装后端依赖。
> 以下 3 个任务完全独立、零依赖，可并行分配给不同 agent。
> 每个 agent 只需关注自己的任务范围，修完后运行对应验证命令确认通过。
>
> **增量验证（2026-02-10）**：运行任务 34/35/36 关联的 8 个测试文件（`--runInBand --silent`）后，结果为 **8 suites 全部通过，119 通过 / 0 失败**。
> - 通过：`api-service.property.test.js`、`controller.property.test.js`、`WindyAPIService.test.js`、`controller-interaction.test.js`、`models.property.test.js`、`rendering.property.test.js`、`storage.property.test.js`、`error-handling.property.test.js`
> - 说明：此前两处失败（`global.fetch.mockClear` mock 问题、controller 属性断言与当前实现不一致）已修复并回归通过。

### 任务 32：后端服务依赖安装 (36 failures) ✅ 已修复

- [x] 32.1 安装 server/node_modules 依赖 (36 tests 全部修复)
  - **真实根因**：`server/node_modules` 未安装（缺少 axios 等依赖），导致 CommonJS 模块加载失败
  - **修复方式**：`cd server && npm install`
  - import 写法 `(await import(...)).default` 本身没有问题
  - _修复日期：2026-02-10_

该部分为历史紧急修复任务（32~36），现已完成并归档。

- [x] 32 后端服务依赖安装修复
- [x] 33 prediction.route 测试修复
- [x] 34 前端 Property-based 测试修复
- [x] 35 controller.property.test.js 修复
- [x] 36 WindyAPIService + controller-interaction 测试修复

**最新验证（归档基线）**
- Test Suites: 31 passed, 31 total
- Tests: 667 passed, 6 skipped, 673 total

**验证命令：**
```bash
node --experimental-vm-modules node_modules/.bin/jest --no-coverage --runInBand --silent
```

---

## Phase 8：测试覆盖率达标（需求 23）

> **目标**：所有 Jest 覆盖率阈值全部通过（Statements ≥ 80%，Branches ≥ 75%，Functions ≥ 90%，Lines ≥ 80%）
> **当前基线**：31 suites 全通过，667/673 测试通过；覆盖率约 42%（语句），远低于阈值
> **分两阶段**：阶段一修正配置（1~2 任务），阶段二按优先级补测试（P0→P3）

### 任务 37：Jest 覆盖率配置修正（阶段一）

- [ ] 37.1 更新 `jest.config.js` 的 `collectCoverageFrom`
  - 排除 `src/locales/**`（纯翻译数据，无业务逻辑）
  - 排除 `src/services/Mock*.js`（离线开发测试替身）
  - 排除 `src/app.js`（应用入口文件，难以有意义地单测）
  - 排除 `server/scripts/**`（Python 脚本封装，由 pytest 覆盖）
  - 确保排除后现有 667 个测试依然全部通过
  - _关联需求：23.6_

- [ ] 37.2 验证配置修正效果
  - 运行 `npm run test:coverage`，记录新的覆盖率基线
  - 预期：语句覆盖率从 42% 提升至约 55-58%
  - 将新基线数据更新到 design.md 第 28.5 节的路径表格
  - _关联需求：23.1-23.5_

### 任务 38：P0 工具类测试补全

- [ ] 38.1 `UnitConverter.js` 全量测试（`tests/unit/utils/UnitConverter.test.js`）
  - 温度转换：`toFahrenheit()`、`toCelsius()` 边界值（0°C、-40°C/°F、极值）
  - 风速转换：`msToKmh()`、`msToMph()`、`kmhToMs()` 精度验证
  - 格式化方法：`formatTemperature()`、`formatWindSpeed()` 含单位字符串
  - 空值/NaN 输入的防御性处理
  - 目标覆盖率：函数 100%，语句 100%
  - _关联需求：17, 23.8_

- [ ] 38.2 `ConfigService.js` 全量测试（`tests/unit/services/ConfigService.test.js`）
  - 读取默认配置值
  - `getApiMode()`、`isProxyMode()` 返回值正确性
  - 配置合并/覆盖逻辑
  - 目标覆盖率：函数 ≥ 95%，语句 ≥ 90%
  - _关联需求：15, 23.8_

### 任务 39：P1 服务层测试补全

- [ ] 39.1 `StorageService.js` 覆盖率补全（`tests/unit/services/StorageService.test.js`）
  - 补充当前未覆盖的方法：`saveFavoriteLocations()`、`getFavoriteLocations()`、`saveDefaultLocation()`、`getDefaultLocation()`
  - 补充当前未覆盖的分支：`try/catch` 存储异常处理、`JSON.parse` 失败回退
  - 通知设置读写：`saveNotificationSettings()`、`getNotificationSettings()`
  - 单位/主题设置读写：`saveUnitSettings()`、`getUnitSettings()`
  - 目标：将语句覆盖率从 54% 提升至 ≥ 85%
  - _关联需求：12, 13, 17, 23.10_

- [ ] 39.2 `ThemeService.js` 单元测试（`tests/unit/services/ThemeService.test.js`）
  - `setTheme('light'|'dark'|'auto')` 验证 `document.documentElement.dataset.theme` 设置
  - `getTheme()` 返回当前主题
  - `applyStoredTheme()` 从 Storage 读取并应用
  - `watchSystemTheme()` 监听 `prefers-color-scheme` 媒体查询（mock `matchMedia`）
  - 目标：函数覆盖率 ≥ 90%，语句覆盖率 ≥ 80%
  - _关联需求：17, 23.10_

- [ ] 39.3 `NotificationService.js` 单元测试（`tests/unit/services/NotificationService.test.js`）
  - mock `global.Notification`（`requestPermission`、`permission`）
  - `requestPermission()` 各返回值（granted/denied/default）的分支覆盖
  - `notify()` 发送通知参数验证
  - `scheduleNotification()` 定时逻辑（mock `setTimeout`）
  - 权限拒绝时的降级处理
  - 目标：函数覆盖率从 27% 提升至 ≥ 80%
  - _关联需求：12, 23.13_

### 任务 40：P2 算法服务测试补全

- [ ] 40.1 `SurroundingPointsService.js` 核心逻辑测试（`tests/unit/services/SurroundingPointsService.test.js`）
  - `calculateSurroundingPoints(lat, lon, radiusKm)` 返回 8 方向坐标计算正确性
  - `fetchSurroundingWeather()` mock `fetch` 并验证并行调用逻辑（`Promise.all`）
  - `aggregateScores()` 聚合评分计算
  - 网络失败时单个方向的错误隔离（不影响其他 7 个方向）
  - 目标：语句覆盖率从 6% 提升至 ≥ 70%
  - _关联需求：19, 23.10_

- [ ] 40.2 `SunsetPrediction.js` 模型分支补全（`tests/unit/models/SunsetPrediction.test.js`）
  - 补充 `toJSON()` / `fromJSON()` 边界输入（null/undefined 字段）
  - 补充 `getQualityLabel()` 各阈值分支（>70, 40-70, <40）
  - 目标：语句覆盖率从 72% 提升至 ≥ 90%
  - _关联需求：5, 6, 23.9_

### 任务 41：P3 Canvas/Leaflet 服务测试

- [ ] 41.1 建立 Canvas Mock 基础设施（`tests/__mocks__/canvas.js`）
  - 实现 `HTMLCanvasElement.prototype.getContext` 的 Jest mock
  - 覆盖常用 2D Context 方法：`clearRect`、`beginPath`、`moveTo`、`lineTo`、`stroke`、`fill`、`arc`、`fillText`、`fillRect`、`strokeRect`
  - 覆盖渐变工厂方法：`createLinearGradient`、`createRadialGradient`（返回带 `addColorStop` mock 的对象）
  - 在 `jest.config.js` 的 `setupFilesAfterFramework` 中引入
  - _关联需求：23.13_

- [ ] 41.2 `RadarChartService.js` 单元测试（`tests/unit/services/RadarChartService.test.js`）
  - 依赖 41.1 的 Canvas Mock
  - `renderRadarChart(canvas, data)` 验证 mock 方法被正确调用
  - `calculatePolygonPoints()` 极坐标转笛卡尔坐标数学正确性
  - 数据为空/评分全零时的降级渲染
  - 目标：语句覆盖率从 1.26% 提升至 ≥ 70%
  - _关联需求：19, 23.13_

- [ ] 41.3 `FireCloudOverlayService.js` 单元测试（`tests/unit/services/FireCloudOverlayService.test.js`）
  - 依赖 41.1 的 Canvas Mock，并 mock `fetch`
  - `generateOverlay(lat, lon)` 验证请求参数和 Canvas 绘制调用
  - `updateOverlay()` 更新逻辑
  - 后端请求失败时回退到前端 Canvas 降级路径
  - 目标：语句覆盖率从 6.84% 提升至 ≥ 65%
  - _关联需求：20, 23.13_

- [ ] 41.4 建立 Leaflet Mock（`tests/__mocks__/leaflet.js`）
  - 实现 `L.map()`、`L.tileLayer()`、`L.imageOverlay()`、`L.latLngBounds()` 的链式调用 mock
  - 导出为 ES Module 格式与 Jest moduleNameMapper 兼容
  - _关联需求：23.13_

- [ ] 41.5 `WindyMapService.js` 单元测试（`tests/unit/services/WindyMapService.test.js`）
  - 依赖 41.4 的 Leaflet Mock
  - `initMap(containerId)` 验证 Leaflet 初始化调用
  - `setLocation(lat, lon)` 验证地图平移
  - `addFireCloudOverlay(imageUrl, bounds)` 验证 `L.imageOverlay` 调用
  - 地图未初始化时调用方法的防御处理
  - 目标：语句覆盖率从 0% 提升至 ≥ 65%
  - _关联需求：18, 20, 23.13_

### 任务 42：P4 UI 组件测试补充（可选）

> 优先级低于 P0-P3；若 P3 完成后覆盖率已达标则此任务可推迟。

- [ ] 42.1 `LanguageSelector.js` 单元测试
  - mock `document.querySelector` 和 DOM 事件
  - `init()` 方法绑定事件验证
  - `setLanguage(code)` 触发 i18n 切换
  - _关联需求：14, 23.11_

- [ ] 42.2 `SettingsPanel.js` 核心逻辑测试
  - mock DOM 元素
  - `open()` / `close()` 面板显示隐藏
  - 设置保存回调调用验证
  - _关联需求：16, 23.11_

### 任务 43：覆盖率达标验证与 CI 门禁

- [ ] 43.1 运行完整覆盖率报告并验证所有阈值通过
  - 执行 `npm run test:coverage`
  - 确认无 `Jest: "global" coverage threshold ... not met` 错误
  - 确认原有 667 个通过测试未受影响
  - _关联需求：23.1-23.5_

- [ ] 43.2 更新 `tasks.md` 标记 Phase 8 完成
  - 记录最终覆盖率数据（各项指标）
  - 更新 CLAUDE.md 中的测试状态说明

---

## Phase 8 执行顺序

```
任务 37（配置）→ 任务 38（P0）→ 任务 39（P1）→ 任务 40（P2）
       ↓
  任务 41.1（Canvas Mock）
       ├→ 任务 41.2（RadarChart）
       ├→ 任务 41.3（FireCloudOverlay）
       └→ 任务 41.4（Leaflet Mock）→ 任务 41.5（WindyMap）
       ↓
  [可选] 任务 42 → 任务 43（验证）
```

**并行机会**：任务 38 和 39 完全独立，可分配给不同 Agent 并行执行。任务 41.2、41.3、41.5 依赖 Mock 基础设施（41.1、41.4）但相互独立，Mock 就绪后可并行。
