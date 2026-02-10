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
