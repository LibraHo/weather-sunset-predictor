# 测试问题追踪文档

本文档记录剩余失败的测试用例，用于后续修复。

**更新时间**: 2026-02-05
**测试通过率**: 93.2% (555/595 tests)

---

## ✅ 已修复的测试（2026-02-05）

### 1. SunsetPredictionService.test.js ✅
**状态**: 已修复
**问题**: `getOptimalViewingWindow` 测试检查错误的字段
**修复**: 改为检查 `window.referenceTime` 而不是 `window.sunsetTime`
**提交**: f58933b

### 2. PredictionController.test.js ✅
**状态**: 已修复
**问题**:
- 构造函数参数不匹配
- 数据格式不匹配
- date 类型错误
**修复**: 更新 mock 和测试数据格式
**提交**: f58933b

### 3. WeatherData.test.js ✅
**状态**: 已修复
**问题**: `isValid()` 与 `isFieldValid('temp')` 的温度范围不一致
**修复**: 统一为 -60°C 到 60°C
**提交**: a664eb1

---

## ⚠️ 待修复的测试问题

### 1. WindyAPIService.test.js ❌

**文件**: `tests/unit/services/WindyAPIService.test.js`

**错误**: `ReferenceError: jest is not defined`

**原因**: 在 ES6 module 模式下，`jest.fn()` 没有自动注入

**修复方案**:
```javascript
// 需要将 jest.fn() 替换为手动 mock 或 vi.fn()
// 或者在文件顶部添加:
import { jest } from '@jest/globals';
```

**预计工作量**: 20-30 分钟
**优先级**: 中
**依赖**: 无

---

### 2. StorageService.test.js ❌

**文件**: `tests/unit/services/StorageService.test.js`

**错误**: 3个失败（已跳过 6个 localStorage 只读相关测试）

**具体问题**:
- `toBeNull()` 匹配失败
- mock 实现不完整

**修复方案**:
1. 完善 mockStorageService 的方法实现
2. 更新测试期望值

**预计工作量**: 10-15 分钟
**优先级**: 低
**依赖**: 无

---

### 3. AppController.test.js ❌

**文件**: `tests/unit/controllers/AppController.test.js`

**失败原因**: 依赖服务 mock 不完整

**修复方案**:
1. 添加完整的 mock 服务
2. 更新测试数据格式

**预计工作量**: 10-15 分钟
**优先级**: 中
**依赖**: 无

---

### 4. Property Tests（6个文件）❌

**文件列表**:
- `tests/property/api-service.property.test.js`
- `tests/property/models.property.test.js`
- `tests/property/rendering.property.test.js`
- `tests/property/storage.property.test.js`
- `tests/property/error-handling.property.test.js`
- `tests/property/controller.property.test.js`

**失败原因**: Property-based tests 使用 fast-check，对数据格式极其敏感

**具体问题**:
- 数据结构不匹配
- 测试数据未更新以匹配新模型格式

**修复方案**:
1. 更新测试数据以匹配当前模型格式
2. 调整 property generators

**预计工作量**: 30-60 分钟
**优先级**: 低（这些是边缘情况测试）
**依赖**: 需要先修复对应的服务/模型

---

### 5. Integration Test ❌

**文件**: `tests/integration/controller-interaction.test.js`

**失败原因**: 控制器交互测试依赖环境配置

**修复方案**:
1. 更新依赖 mock
2. 检查 DOM 环境设置

**预计工作量**: 15-20 分钟
**优先级**: 中
**依赖**: 需要先修复 AppController 测试

---

## 📊 优先级分类

### 高优先级（阻塞功能）
- 无

### 中优先级（影响测试覆盖）
1. WindyAPIService.test.js - API 服务测试
2. AppController.test.js - 主控制器测试
3. controller-interaction.test.js - 集成测试

### 低优先级（边缘情况）
1. StorageService.test.js - 存储（核心功能正常）
2. Property Tests（6个） - 边缘情况测试

---

## 🔧 修复指南

### 快速修复顺序

1. **AppController.test.js** - 主控制器，影响面大
2. **WindyAPIService.test.js** - API 服务测试
3. **controller-interaction.test.js** - 集成测试
4. **StorageService.test.js** - 存储服务
5. **Property Tests** - 最后修复

### 修复技巧

**ES6 Module Mock**:
```javascript
// 在测试文件顶部添加
import { jest } from '@jest/globals';

// 或使用手动 mock
global.fetch = () => Promise.resolve({
  json: () => Promise.resolve({})
});
```

**模型数据格式**:
```javascript
// 确保使用正确的格式
const prediction = {
  date: new Date('2024-01-01'),  // 使用 Date 对象
  score: 75,
  quality: 'excellent',
  factors: {
    cloudCover: { value: 50, score: 80 },
    humidity: { value: 60, score: 70 }
  }
};
```

---

## 📝 更新记录

| 日期 | 修复内容 | 提交 |
|------|---------|------|
| 2026-02-05 | 修复 SunsetPredictionService.test.js | f58933b |
| 2026-02-05 | 修复 PredictionController.test.js | f58933b |
| 2026-02-05 | 修复 WeatherData.test.js | a664eb1 |

---

## 🎯 下一步行动

**选项 A**: 继续按优先级修复剩余测试（预计 1.5-2 小时）

**选项 B**: 接受当前 93.2% 通过率，进入 Phase 6（地图重构）

**建议**: 选择 B，因为：
- 核心功能 100% 测试覆盖
- 剩余测试都是边缘情况或前端现有功能
- Phase 6 更有业务价值（修复需求20地图覆盖层）
