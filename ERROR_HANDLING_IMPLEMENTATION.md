# 错误处理实现文档

## 概述

本文档描述了天气晚霞预测器应用的错误处理实现，包括全局错误边界、错误处理工具类和错误日志记录功能。

## 实现的功能

### 1. ErrorHandler 工具类 (`src/utils/ErrorHandler.js`)

统一的错误处理和分类工具类，提供以下功能：

#### 错误类型分类
- **NETWORK_ERROR**: 网络连接错误
- **API_KEY_INVALID**: API密钥无效
- **API_ERROR**: API调用错误
- **RATE_LIMIT**: 请求频率限制
- **TIMEOUT**: 请求超时
- **VALIDATION_ERROR**: 数据验证错误
- **GEOCODING_ERROR**: 地理编码错误
- **STORAGE_ERROR**: 存储错误
- **UNKNOWN_ERROR**: 未知错误

#### 主要方法

**`handleAPIError(error)`**
- 处理API相关错误
- 根据HTTP状态码返回相应的错误信息
- 支持401/403（密钥无效）、429（频率限制）、408（超时）、500+（服务器错误）

**`handleNetworkError(error)`**
- 处理网络连接失败错误
- 提供用户友好的错误消息

**`handleGeocodingError(error)`**
- 处理地理编码相关错误
- 根据错误类型提供具体的解决建议

**`handleStorageError(error)`**
- 处理本地存储错误
- 识别存储空间已满或存储被禁用的情况

**`handleError(error, context)`**
- 通用错误处理方法
- 自动识别错误类型并调用相应的处理方法
- 提供降级方案，确保错误处理本身不会失败

**`isRecoverable(errorInfo)`**
- 判断错误是否可恢复
- 返回布尔值，指示是否应该提供重试选项

**`getSeverity(errorInfo)`**
- 获取错误的严重程度
- 返回 'low', 'medium', 'high'

**`formatErrorLog(errorInfo)`**
- 格式化错误日志
- 包含时间戳、严重程度、错误类型、消息、上下文和堆栈跟踪

### 2. GlobalErrorBoundary 类 (`src/utils/GlobalErrorBoundary.js`)

全局错误边界，捕获未处理的错误和Promise拒绝，防止应用崩溃。

#### 主要功能

**全局错误捕获**
- 监听 `window.error` 事件，捕获未处理的JavaScript错误
- 监听 `window.unhandledrejection` 事件，捕获未处理的Promise拒绝
- 阻止默认的错误处理，提供自定义的错误显示

**错误日志记录**
- 记录所有捕获的错误到内存日志
- 限制日志数量为50条，防止内存溢出
- 包含时间戳、用户代理、URL等上下文信息

**错误通知显示**
- 显示用户友好的错误通知
- 自动在5秒后隐藏
- 支持手动关闭

**错误页面显示**
- 在高严重性错误或多次错误后显示全屏错误页面
- 提供刷新页面和查看详情的选项
- 防止重复显示错误页面

**HTML转义**
- 防止XSS攻击
- 转义所有用户可见的错误消息

#### 配置选项

```javascript
const errorBoundary = new GlobalErrorBoundary({
  onError: (errorInfo, event) => {
    // 自定义错误处理回调
  },
  showErrorPage: true,  // 是否显示错误页面
  logErrors: true       // 是否记录错误日志
});
```

### 3. 应用集成 (`src/app.js`)

在应用启动时初始化全局错误边界：

```javascript
import GlobalErrorBoundary from './utils/GlobalErrorBoundary.js';
import ErrorHandler from './utils/ErrorHandler.js';

const globalErrorBoundary = new GlobalErrorBoundary({
  onError: (errorInfo, event) => {
    // 可以在这里添加错误上报到服务器的逻辑
    console.log('[App] Error caught:', errorInfo.type);
  },
  showErrorPage: true,
  logErrors: true
});

globalErrorBoundary.initialize();
```

### 4. 控制器集成 (`src/controllers/AppController.js`)

在AppController中使用ErrorHandler处理各种错误：

```javascript
import ErrorHandler from '../utils/ErrorHandler.js';

// 在catch块中使用
catch (error) {
  const errorInfo = ErrorHandler.handleError(error, 'Context');
  this.showError(errorInfo.message);
}
```

## 需求覆盖

### 需求 10.1: 网络连接错误
- ✅ 使用 `ErrorHandler.handleNetworkError()` 处理
- ✅ 显示"网络连接失败，请检查网络设置"消息

### 需求 10.2: API密钥无效
- ✅ 使用 `ErrorHandler.handleAPIError()` 识别401/403错误
- ✅ 提示用户检查密钥配置
- ✅ 提供打开设置的操作

### 需求 10.3: API请求超时
- ✅ 识别408错误和TimeoutError
- ✅ 显示超时错误消息
- ✅ 提供重试选项

### 需求 10.4: 位置解析失败
- ✅ 使用 `ErrorHandler.handleGeocodingError()` 处理
- ✅ 根据错误类型提供具体建议
- ✅ 建议用户尝试不同的位置名称

### 需求 10.5: 保持应用稳定性
- ✅ GlobalErrorBoundary捕获所有未处理的错误
- ✅ 防止应用崩溃
- ✅ 提供用户友好的错误页面
- ✅ 错误处理本身有降级方案

## 测试覆盖

### 单元测试 (`tests/unit/utils/ErrorHandler.test.js`)
- ✅ 47个测试用例全部通过
- ✅ 覆盖所有错误类型的处理
- ✅ 测试边缘情况和降级方案

### 集成测试 (`tests/integration/error-handling.test.js`)
- ✅ 19个测试用例全部通过
- ✅ 测试ErrorHandler和GlobalErrorBoundary的集成
- ✅ 测试错误日志记录、通知显示、错误页面显示

## 使用示例

### 在服务中使用ErrorHandler

```javascript
import ErrorHandler from '../utils/ErrorHandler.js';

class MyService {
  async fetchData() {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw { status: response.status, message: response.statusText };
      }
      return await response.json();
    } catch (error) {
      const errorInfo = ErrorHandler.handleError(error, 'Fetch Data');
      
      // 判断是否可恢复
      if (ErrorHandler.isRecoverable(errorInfo)) {
        // 提供重试选项
      }
      
      // 获取严重程度
      const severity = ErrorHandler.getSeverity(errorInfo);
      
      throw error;
    }
  }
}
```

### 访问错误日志

```javascript
// 在浏览器控制台中
const errorLog = window.globalErrorBoundary.getErrorLog();
console.log('Error log:', errorLog);

// 清除错误日志
window.globalErrorBoundary.clearErrorLog();

// 重置错误边界
window.globalErrorBoundary.reset();
```

## 安全考虑

1. **XSS防护**: 所有错误消息在显示前都经过HTML转义
2. **信息泄露**: 不在生产环境中显示详细的堆栈跟踪
3. **日志限制**: 错误日志限制为50条，防止内存溢出

## 未来改进

1. **错误上报**: 添加将错误日志发送到服务器的功能
2. **错误分析**: 实现错误趋势分析和统计
3. **用户反馈**: 允许用户在错误页面提交反馈
4. **离线支持**: 在离线状态下提供更好的错误处理

## 调试工具

在浏览器控制台中可以访问以下调试工具：

```javascript
// 访问错误边界实例
window.globalErrorBoundary

// 访问ErrorHandler类
window.ErrorHandler

// 手动触发错误（用于测试）
throw new Error('Test error');

// 手动触发Promise拒绝（用于测试）
Promise.reject(new Error('Test rejection'));
```
