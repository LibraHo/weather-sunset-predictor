# 任务 47.3: 实现 Windy 特有字段替代策略

**完成时间**: 2026-03-05
**Git 分支**: `feat/task47-windy-field-alternatives`

---

## 完成内容

### 1. 实现计划文档 (`docs/task47.3-implementation.md`)

创建了详细的实现计划，包括：

**问题分析**：
- Windy 特有字段（`convPrecip`, `cape`）只有 Windy 支持
- Open-Meteo 和彩云不返回这些字段
- 缺失时可能导致算法异常或评分偏低

**解决方案**：
- 方案 1: 安全检查 + 默认值（推荐）
  - `cape` 缺失时使用中性值 500 J/kg
  - `convPrecip` 缺失时使用零值
- 方案 2: 权重调整（替代方案）
  - 将 CAPE 权重分配给云量和湿度

**实现步骤**：
1. 添加安全检查函数 (`getSafeCAPE()`, `getSafeConvPrecip()`)
2. 修改光路评分函数 (`scoreLightPath()`) 使用安全函数
3. 更新 `providerMeta` 记录缺失字段信息

**测试计划**：
- 单元测试：缺失 CAPE 字段时使用中性值
- 单元测试：缺失对降水量字段时使用零值
- 集成测试：Open-Meteo 数据源（无 CAPE/convPrecip）评分正常

---

### 2. 关键发现

**必需字段（所有提供商支持）**：
- `temp`, `humidity`, `cloudCover`, `windSpeed`, `pressure`, `visibility`, `precipitation`, `windDirection`
- `lowClouds`, `midClouds`, `highClouds`

**可降级字段（Windy 特有）**：
- `convPrecip` - 仅 Windy 支持
- `cape` - 仅 Windy 支持

**降级处理**：
```javascript
// 安全获取 CAPE 值
function getSafeCAPE(weatherData) {
  if (weatherData.cape === undefined || weatherData.cape === null) {
    return 500; // 中等稳定性
  }
  return weatherData.cape;
}

// 安全获取对降水量值
function getSafeConvPrecip(weatherData) {
  if (weatherData.convPrecip === undefined || weatherData.convPrecip === null) {
    return 0; // 无对降水
  }
  return weatherData.convPrecip;
}
```

---

## 待实施内容

### 任务 47.3
- [ ] 实现 `getSafeCAPE()` 函数
- [ ] 实现 `getSafeConvPrecip()` 函数
- [ ] 修改 `scoreLightPath()` 使用安全函数
- [ ] 更新 `providerMeta` 记录缺失字段
- [ ] 单元测试：缺失 CAPE 字段
- [ ] 单元测试：缺失对降水量字段
- [ ] 集成测试：Open-Meteo 数据源

---

## 文件更新

- [x] `docs/task47.3-implementation.md` - 实现计划
- [ ] `server/services/EnhancedPredictionService.js` - 实现安全函数
- [ ] `server/services/ProviderOrchestrator.js` - 记录缺失字段
- [ ] `tests/unit/services/EnhancedPredictionService.test.js` - 单元测试

---

## 下一步

继续实施代码修改：
1. 在 `EnhancedPredictionService.js` 中实现安全函数
2. 修改光路评分算法
3. 添加单元测试
4. 提交并推送到 GitHub
