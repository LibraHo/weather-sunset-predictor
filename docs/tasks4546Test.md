# 任务 45 & 46 测试程序文档

**版本**: 1.0
**日期**: 2026-03-05
**测试文件**: `tests/quality/tasks4546Test.js`

---

## 测试范围

### 任务 45: 测试与灰度发布

#### 45.1 单元测试 (11 项)
- `45.1.1`: BaseWeatherProvider 基类已定义
- `45.1.2`: estimateVisibility 方法存在
- `45.1.3`: OpenMeteoProvider 已实现
- `45.1.4`: Provider 名称正确（'openmeteo'）
- `45.1.5`: fetchWeatherData 方法存在
- `45.1.6`: ForecastSequenceValidator 已实现
- `45.1.7`: 验证器正确处理正常数据
- `45.1.8`: 正常数据质量标记为 'excellent'
- `45.1.9`: 正常数据无问题
- `45.1.10`: ProviderOrchestrator 已实现
- `45.1.11`: Primary Provider 默认为 Open-Meteo
- `45.1.12`: Fallback Provider 默认为 Windy
- `45.1.13`: fetchWeatherData 方法存在

#### 45.2 集成测试 (4 项)
- `45.2.1`: 主数据源响应成功
- `45.2.2`: 返回数据不为空
- `45.2.3`: 数据源标识正确
- `45.2.4`: 数据质量标记存在
- `45.2.5`: 降级场景（需手动测试）

#### 45.3 双读对比脚本 (2 项)
- `45.3.1`: 脚本文件存在
- `45.3.2`: 脚本可执行

### 任务 46: 迁移执行建议 (5 项)
- `46.1`: 迁移建议文档存在 (`docs/migration-advice.md`)
- `46.2`: 文档包含所有必需章节
- `46.3`: 文档提及所有数据源
- `46.4`: 包含降级策略说明
- `46.5`: 任务 46 完成总结文档存在 (`docs/task46-summary.md`)

---

## 运行方法

### 前置条件
1. 后端服务运行中：`http://localhost:3000`
2. Node.js 版本 ≥ 16
3. 项目依赖已安装：`npm install`

### 执行测试

```bash
# 进入项目根目录
cd /home/node/.openclaw/workspace-coder/weather-sunset-predictor

# 运行测试程序
node tests/quality/tasks4546Test.js
```

### 预期输出

```
========================================
任务 45 & 46 验证测试程序
========================================

========== 任务 45.1: Provider adapter 映射、序列校验、orchestrator 降级逻辑 ==========
✅ 45.1.1: BaseWeatherProvider 基类已定义
✅ 45.1.2: estimateVisibility 方法存在
✅ 45.1.3: OpenMeteoProvider 已实现
...
✅ 45.1.13: fetchWeatherData 方法存在

========== 任务 45.2: 集成测试（主备切换） ==========
✅ 45.2.1: 主数据源响应成功
✅ 45.2.2: 返回数据不为空
✅ 45.2.3: 数据源标识正确
✅ 45.2.4: 数据质量标记存在
⚠️  45.2.5 降级场景需要手动测试：临时禁用 Open-Meteo API，验证自动切换到 Windy

========== 任务 45.3: 双读对比脚本 ==========
✅ 45.3.1: 双读对比脚本文件存在
✅ 45.3.2: 双读对比脚本可执行

========== 任务 46: 迁移建议文档 ==========
✅ 46.1: 迁移建议文档存在
✅ 46.2: 文档包含所有必需章节
✅ 46.3: 文档提及所有数据源
✅ 46.4: 包含降级策略说明
✅ 46.5: 任务 46 完成总结文档存在

========================================
测试结果汇总
========================================
总计: 22 项测试
通过: 22 项
失败: 0 项

✅ 所有测试通过！
```

---

## 手动测试步骤

### 任务 45.2.5: 降级场景测试

**目的**: 验证 Primary 数据源失败时，自动切换到 Fallback

**步骤**:

1. **临时破坏 Primary 数据源**
   ```bash
   # 方法 1: 修改环境变量
   export PRIMARY_WEATHER_PROVIDER='nonexistent'
   
   # 方法 2: 修改 ProviderOrchestrator.js 中的 URL
   # 编辑 server/services/ProviderOrchestrator.js
   # 将 OpenMeteo URL 改为无效地址
   ```

2. **重启后端服务**
   ```bash
   cd server
   pkill -f 'node index.js' || true
   nohup node index.js > /tmp/backend.log 2>&1 &
   ```

3. **测试降级行为**
   ```bash
   # 请求天气数据，应返回 Windy 数据
   curl http://localhost:3000/api/weather/forecast?lat=39.9&lon=116.4
   
   # 检查日志，应包含 "Primary 失败" 和 "触发降级" 消息
   tail -f /tmp/backend.log
   ```

4. **恢复配置**
   ```bash
   # 重启服务，恢复为 Primary 数据源
   /home/ubuntu/.openclaw/skills/weather-sunset-deploy/restart.sh
   ```

### 任务 45.3: 双读对比脚本测试

**运行完整对比**:

```bash
# 对比北京地区 168 小时数据
node tests/quality/dualReadComparison.js 39.9 116.4

# 预期输出:
# - Open-Meteo: 168h, 质量=standard, 延迟=XXXms
# - Windy: 168h, 质量=standard, 延迟=XXXms
# - 数据量、时间戳一致性、数值差异分析
```

---

## 测试通过标准

### 必须通过的测试
- **任务 45.1**: 所有 13 项单元测试必须通过
- **任务 45.2**: 前 4 项集成测试必须通过（第 5 项为手动测试）
- **任务 45.3**: 2 项脚本测试必须通过
- **任务 46**: 所有 5 项文档测试必须通过

### 可选的测试
- 任务 45.2.5: 降级场景测试（建议在生产灰度前手动测试一次）

---

## 故障排除

### 后端服务未运行

**错误**: `HTTP 请求失败: ECONNREFUSED`

**解决**:
```bash
# 检查服务状态
curl http://localhost:3000/health

# 启动服务
/home/ubuntu/.openclaw/skills/weather-sunset-deploy/restart.sh
```

### 模块导入失败

**错误**: `Cannot find module '...'`

**解决**:
```bash
# 安装依赖
npm install

# 检查文件是否存在
ls -la server/services/providers/
ls -la server/services/validators/
```

### 测试超时

**错误**: 后端响应时间 > 10 秒

**解决**:
- 检查网络连接
- 检查后端日志：`tail -f /tmp/backend.log`
- 检查 Open-Meteo API 是否正常

---

## 测试报告模板

运行测试后，请将结果记录在以下模板中：

```markdown
## 测试执行报告

**执行时间**: 2026-03-05 HH:MM UTC
**执行人**: 姓名
**环境**: 本地 / 测试服务器

### 测试结果

#### 任务 45.1 单元测试
- 通过: X/13
- 失败: Y/13
- 失败项: 列出失败测试名称和错误信息

#### 任务 45.2 集成测试
- 通过: X/4
- 失败: Y/4
- 失败项: 列出失败测试名称和错误信息
- 降级测试 (45.2.5): 是否手动测试？（是/否）

#### 任务 45.3 双读对比脚本
- 通过: X/2
- 失败: Y/2
- 失败项: 列出失败测试名称和错误信息
- 完整对比结果: 是否运行？（是/否）

#### 任务 46 迁移建议文档
- 通过: X/5
- 失败: Y/5
- 失败项: 列出失败测试名称和错误信息

### 总体评估

**总计**: 通过 X/22, 失败 Y/22

**结论**:
- 所有测试通过，可以继续后续任务 (任务 47)
- 部分测试失败，需要修复后重新测试
```

---

## 下一步

测试全部通过后，可以继续执行：

1. **任务 47**: 功能支持差异与降级策略落地
   - 47.1: 建立"需求到字段"映射清单
   - 47.2: 实现彩云分层云量估算器

2. **Phase 12**: Windy 降级与移除 (任务 51-54)
