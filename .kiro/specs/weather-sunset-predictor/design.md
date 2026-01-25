# 设计文档

## 概述

天气晚霞预测器是一个单页Web应用程序，使用原生JavaScript、HTML和CSS构建。应用通过Windy API获取气象数据，运用气象学原理分析火烧云（晚霞）出现的可能性。

核心设计理念：
- 客户端渲染，无需后端服务器
- 数据存储在浏览器本地存储（LocalStorage）
- RESTful API调用Windy服务
- 模块化JavaScript架构，便于维护和测试

## 架构

### 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        浏览器环境                              │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                   UI层（View）                        │   │
│  │  - 位置输入组件                                        │   │
│  │  - 天气显示组件                                        │   │
│  │  - 晚霞预测组件                                        │   │
│  │  - 设置组件                                           │   │
│  └────────────┬─────────────────────────────────────────┘   │
│               │                                              │
│  ┌────────────▼─────────────────────────────────────────┐   │
│  │              控制层（Controller）                      │   │
│  │  - AppController: 应用主控制器                        │   │
│  │  - WeatherController: 天气数据控制器                  │   │
│  │  - PredictionController: 预测逻辑控制器               │   │
│  └────────────┬─────────────────────────────────────────┘   │
│               │                                              │
│  ┌────────────▼─────────────────────────────────────────┐   │
│  │              服务层（Services）                        │   │
│  │  - WindyAPIService: API调用服务                       │   │
│  │  - GeocodingService: 地理编码服务                     │   │
│  │  - StorageService: 本地存储服务                       │   │
│  │  - SunsetPredictionService: 晚霞预测算法              │   │
│  └────────────┬─────────────────────────────────────────┘   │
│               │                                              │
│  ┌────────────▼─────────────────────────────────────────┐   │
│  │              数据层（Models）                          │   │
│  │  - WeatherData: 天气数据模型                          │   │
│  │  - Location: 位置数据模型                             │   │
│  │  - SunsetPrediction: 预测结果模型                     │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
└───────────────────────┬───────────────────────────────────────┘
                        │
                        │ HTTPS
                        ▼
            ┌───────────────────────┐
            │    Windy API 服务      │
            │  Point Forecast API   │
            └───────────────────────┘
```

### 技术栈

- **前端框架**: 原生JavaScript (ES6+)
- **样式**: CSS3 with Flexbox/Grid
- **HTTP客户端**: Fetch API
- **存储**: LocalStorage API
- **地理位置**: Geolocation API
- **通知**: Notification API（需求12）
- **图表**: Chart.js 或原生Canvas（需求11）
- **天文计算**: SunCalc.js（需求12）
- **构建工具**: 无需构建（可选：Vite用于开发服务器）

## 新功能设计决策

### 需求11：天气界面优化

**设计决策理由**：
1. **7天概览 + 24小时详细视图**：采用两级信息架构，避免信息过载。用户可以快速浏览7天概况，然后深入查看感兴趣日期的详细数据。
2. **参数切换器**：允许用户在不同气象参数间切换，而不是同时显示所有图表，减少页面复杂度和渲染负担。
3. **图表类型选择**：
   - 温度、湿度、风速、气压使用折线图：适合展示连续变化趋势
   - 降水使用柱状图：适合展示离散事件
   - 云量使用面积图：直观展示覆盖程度
4. **颜色编码**：使用直觉化的颜色映射（温度：蓝→橙→红，降水：蓝色系），提升可读性。
5. **移动端优化**：图表支持横向滚动，确保在小屏幕上也能查看完整的24小时数据。

### 需求12：朝霞晚霞预测增强功能

**设计决策理由**：
1. **朝霞和晚霞独立评分**：日出和日落的气象条件可能不同，独立评分提供更准确的预测。
2. **黄金时段和蓝调时段**：为摄影爱好者提供专业时间建议，这些时段是拍摄的最佳时机。
3. **太阳方位角**：仅在高质量预测（评分>70）时计算和显示，避免信息过载，同时为专业用户提供有价值的信息。
4. **云层分层**：高云、中云、低云对朝霞/晚霞的影响不同，分层显示帮助用户理解预测依据。
5. **通知提醒**：使用浏览器原生Notification API，轻量且无需后端支持。用户可自定义阈值，避免过度打扰。
6. **收藏位置**：支持多位置管理，方便用户快速切换常用地点（如家、工作地点、常去的拍摄地）。

### 需求13：最近搜索历史

**设计决策理由**：
1. **LRU策略**：限制为5个记录，平衡功能性和存储效率。5个记录足以覆盖大多数用户的常用位置。
2. **时间戳管理**：使用时间戳进行排序和去重，确保最新搜索始终在最前面。
3. **下拉列表UI**：点击输入框时显示历史，不占用额外屏幕空间，符合用户习惯。
4. **单个删除 + 全部清除**：提供灵活的管理选项，用户可以精细控制历史记录。
5. **去重逻辑**：搜索已存在的位置时更新时间戳而非创建重复记录，保持列表整洁。

### 需求14：多语言支持

**设计决策理由**：

#### 1. 架构选择：轻量级自实现方案

**理由**：
- 项目是原生JavaScript应用，无构建系统
- 翻译量适中（约200-300个文本键），无需重型框架
- 完全控制实现细节，便于调试和维护
- 打包体积小，加载速度快

**对比**：
- ✅ **自实现**：~5KB代码，完全可控
- ❌ **i18next**：~30KB gzipped，功能过度

#### 2. 核心设计：I18n类

```javascript
class I18n {
  constructor() {
    this.currentLanguage = 'zh-CN';
    this.translations = {};
    this.supportedLanguages = {
      'zh-CN': { name: '简体中文', direction: 'ltr' },
      'zh-TW': { name: '繁體中文', direction: 'ltr' },
      'en-US': { name: 'English', direction: 'ltr' },
      'ja-JP': { name: '日本語', direction: 'ltr' },
      'ko-KR': { name: '한국어', direction: 'ltr' },
      'vi-VN': { name: 'Tiếng Việt', direction: 'ltr' },
      'fr-FR': { name: 'Français', direction: 'ltr' },
      'es-ES': { name: 'Español', direction: 'ltr' },
      'it-IT': { name: 'Italiano', direction: 'ltr' },
      'ar-SA': { name: 'العربية', direction: 'rtl' }
    };
  }

  // 核心方法
  t(key, params) → string           // 翻译文本（支持插值）
  formatDate(date, options) → string  // 日期格式化
  formatTime(date) → string            // 时间格式化
  formatNumber(num, options) → string // 数字格式化（千分位）
  formatPercent(value, decimals) → string // 百分比格式化
  changeLanguage(lang) → void         // 切换语言
  getLanguage() → string             // 获取当前语言
  isRTL() → boolean                  // 是否RTL语言
}
```

**设计特点**：
- 支持嵌套翻译键（如 `prediction.sunrise`）
- 支持参数插值（如 `{{score}}`）
- 自动语言检测（基于浏览器语言）
- 语言偏好持久化（LocalStorage）
- RTL自动支持（设置 `dir="rtl"` 和 `.rtl` 类）

#### 3. 翻译文件组织

```
src/
├── i18n.js                          # I18n核心类
└── locales/
    ├── index.js                     # 加载入口
    ├── zh-CN.js                     # 简体中文
    ├── zh-TW.js                     # 繁体中文
    ├── en-US.js                     # 英语（美国）
    ├── ja-JP.js                     # 日语
    ├── ko-KR.js                     # 韩语
    ├── vi-VN.js                     # 越南语
    ├── fr-FR.js                     # 法语
    ├── es-ES.js                     # 西班牙语
    ├── it-IT.js                     # 意大利语
    └── ar-SA.js                     # 阿拉伯语（RTL）
```

**翻译键命名规范**：
- 使用点号分隔的层级结构（如 `app.title`）
- 小写字母和连字符（如 `best-time-label`）
- 描述性命名（如 `cloud-level-perfect`）

**示例翻译文件结构**：
```javascript
export default {
  app: { title: '晚霞预测器' },
  prediction: {
    sunrise: '朝霞预测',
    sunset: '晚霞预测',
    score: '得分'
  },
  status: {
    noFireCloud: '无火烧云',
    highProbability: '大概率出现漂亮晚霞'
  }
}
```

#### 4. 日期和数字格式化

**使用原生Intl API实现**：

```javascript
// 日期格式化
new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  weekday: 'long'
}).format(date);  // "2026年1月25日 星期日"

new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true
}).format(date);  // "7:29 AM"

// 数字格式化
new Intl.NumberFormat('zh-CN').format(1234.56);  // "1,234.56"
new Intl.NumberFormat('de-DE').format(1234.56);  // "1.234,56"

// 百分比格式化
new Intl.NumberFormat('zh-CN', { style: 'percent' }).format(0.85);  // "85%"
```

**支持的语言特定格式**：
- **日期**：中国（年月日）、美国（月日,年）、阿拉伯语（日 月 年）
- **时间**：中国（24小时制）、美国（12小时制 AM/PM）
- **数字**：千分位符号（逗号 vs 点）、小数点符号
- **货币**：货币符号位置（前置 vs 后置）

#### 5. RTL（Right-to-Left）支持

**RTL语言特点**：
- 阿拉伯语、希伯来语等从右到左书写
- 需要镜像UI元素（图标、箭头等）
- 文字方向、文本对齐需要反转

**实现方式**：
```css
/* 设置RTL方向 */
.rtl {
  direction: rtl;
}

/* 镜像翻转图标 */
.rtl .icon-arrow {
  transform: scaleX(-1);
}

/* 交换左右边距 */
.rtl .ml-2 {
  margin-right: var(--spacing);
  margin-left: 0;
}
```

**自动处理**：
```javascript
// 自动设置HTML属性
document.documentElement.lang = 'ar-SA';
document.documentElement.dir = 'rtl';

// 添加RTL类名
document.body.classList.add('rtl');
```

**需要镜像的元素**：
- 箭头图标（← → →）
- 时间轴图标
- 进度条方向
- 边距和间距

#### 6. 语言切换器

**UI组件设计**：
```javascript
class LanguageSelector {
  render() {
    // 返回语言选择下拉菜单
    // 包含：语言代码、语言名称（本地语言）
  }
}
```

**放置位置**：
- 设置模态框中
- 导航栏中
- 页脚中

**切换流程**：
1. 用户选择新语言
2. 显示确认对话框（防止误操作）
3. 保存到LocalStorage
4. 刷新页面应用新语言
5. 保留用户数据（位置、API密钥、收藏等）

#### 7. 翻译键设计

**翻译键结构**：
```
app.*                         - 应用级别
buttons.*                     - 按钮文本
location.*                    - 位置相关
weather.*                     - 天气信息
prediction.*                  - 预测相关
status.*                      - 状态描述
clouds.*                      - 云层描述
errors.*                      - 错误消息
settings.*                    - 设置界面
```

**插值支持**：
```javascript
t('time.hoursAgo', { hours: 2 })  // "2小时前"
t('prediction.score', { score: 85 })  // "得分：85"
```

#### 8. 浏览器语言检测

**自动检测逻辑**：
```javascript
detectLanguage() {
  const browserLang = navigator.language; // "zh-CN", "en-US", "ar-SA"

  // 精确匹配
  if (this.supportedLanguages[browserLang]) {
    return browserLang;
  }

  // 语言代码匹配（如 "zh" 匹配 "zh-CN"）
  const langCode = browserLang.split('-')[0];
  const matchedLang = Object.keys(this.supportedLanguages)
    .find(lang => lang.startsWith(langCode));

  return matchedLang || 'zh-CN'; // 默认中文
}
```

**回退机制**：
- 检测失败 → 使用默认语言（简体中文）
- 翻译缺失 → 回退到默认语言对应文本
- 格式化失败 → 使用toLocaleString()等原生方法

#### 9. 性能优化

**优化策略**：
1. **翻译文件按需加载**：只加载当前语言的翻译
2. **翻译缓存**：缓存已翻译的文本避免重复查找
3. **惰性更新**：仅在语言切换时更新界面
4. **最小化DOM操作**：批量更新翻译文本

**估算影响**：
- i18n.js：~5KB未压缩
- 每个语言文件：~3KB未压缩
- 总计：~14KB（支持3种语言）

#### 10. 与现有架构集成

**修改文件**：
1. **index.html**：引入i18n系统和RTL样式
2. **src/i18n.js**：新建核心类
3. **src/locales/*js**：新建翻译文件
4. **src/controllers/*Controller.js**：使用 `i18n.t()` 替换硬编码文本
5. **styles/rtl.css**：新建RTL样式
6. **src/main.js**：初始化i18n系统

**集成点**：
- AppController初始化：加载i18n系统
- 所有Controller方法：使用 `i18n.t()` 获取翻译文本
- WeatherController/PredictionController：使用 `i18n.formatDate/Time/Number()`
- HTML渲染：使用 `t()` 而不是硬编码文本

#### 11. 扩展性设计

**添加新语言步骤**：
1. 创建新的语言文件（如 `ja-JP.js`）
2. 在 `i18n.js` 的 `supportedLanguages` 中注册
3. 在 `locales/index.js` 中导入并注册
4. 如需RTL支持，在 `rtl.css` 中添加特定样式

**添加新的格式化类型**：
```javascript
// 货币格式化
formatCurrency(amount, currency) {
  return new Intl.NumberFormat(this.currentLanguage, {
    style: 'currency',
    currency: currency
  }).format(amount);
}
```

#### 12. 兼容性保证

**浏览器支持**：
- Chrome/Edge：✅ 完全支持
- Firefox：✅ 完全支持
- Safari：✅ 完全支持
- IE11：⚠️ 部分支持（需要Intl和Fetch polyfills）

**Polyfills**（如需支持旧浏览器）：
- Intl API（ Intl polyfill ）
- Fetch API（ whatwg-fetch ）
- Promise（promise-polyfill）



## 组件和接口

### 1. 数据模型（Models）

#### Location
```javascript
class Location {
  constructor(lat, lon, name) {
    this.lat = lat;      // 纬度 (-90 to 90)
    this.lon = lon;      // 经度 (-180 to 180)
    this.name = name;    // 位置名称
  }
  
  isValid() {
    return this.lat >= -90 && this.lat <= 90 &&
           this.lon >= -180 && this.lon <= 180;
  }
}
```

#### WeatherData
```javascript
class WeatherData {
  constructor(timestamp, temp, humidity, cloudCover, windSpeed, pressure, visibility, precipitation, windDirection, highClouds, midClouds, lowClouds) {
    this.timestamp = timestamp;        // Unix时间戳
    this.temp = temp;                  // 温度（摄氏度）
    this.humidity = humidity;          // 相对湿度（0-100）
    this.cloudCover = cloudCover;      // 总云量（0-100）
    this.windSpeed = windSpeed;        // 风速（km/h）
    this.pressure = pressure;          // 气压（hPa）
    this.visibility = visibility;      // 能见度（km）
    this.precipitation = precipitation; // 降水量（mm）或降水概率（%）
    this.windDirection = windDirection; // 风向（度数，0-360）
    this.highClouds = highClouds;      // 高云量（>6km，0-100）
    this.midClouds = midClouds;        // 中云量（2-6km，0-100）
    this.lowClouds = lowClouds;        // 低云量（<2km，0-100）
  }
}
```

**设计决策**：扩展WeatherData模型以支持需求11（天气界面优化）和需求12（云层分层信息）。新增字段包括降水数据、风向、以及分层云量数据，这些数据对于专业摄影爱好者和详细天气可视化至关重要。

#### SunsetPrediction
```javascript
class SunsetPrediction {
  constructor(date, score, quality, factors, sunsetTime, sunriseTime, type, goldenHour, blueHour, sunAzimuth, cloudLayers) {
    this.date = date;              // 日期
    this.score = score;            // 预测评分（0-100）
    this.quality = quality;        // 质量等级：'excellent', 'good', 'fair'
    this.factors = factors;        // 影响因素对象
    this.sunsetTime = sunsetTime;  // 日落时间
    this.sunriseTime = sunriseTime; // 日出时间
    this.type = type;              // 预测类型：'sunrise' 或 'sunset'
    this.goldenHour = goldenHour;  // 黄金时段 {start, end}
    this.blueHour = blueHour;      // 蓝调时段 {start, end}
    this.sunAzimuth = sunAzimuth;  // 太阳方位角（度数，仅当score>70时计算）
    this.cloudLayers = cloudLayers; // 云层分层信息 {high, mid, low, description}
  }
  
  getQualityLabel() {
    if (this.score >= 70) return '优秀';
    if (this.score >= 40) return '良好';
    return '一般';
  }
}
```

**设计决策**：扩展SunsetPrediction模型以支持需求12（朝霞晚霞预测增强功能）。新增字段包括：
- 日出时间和预测类型，支持朝霞和晚霞的独立预测
- 黄金时段和蓝调时段，为摄影爱好者提供专业时间建议
- 太阳方位角，帮助用户确定最佳拍摄方向
- 云层分层信息，提供更详细的气象分析

### 2. 服务层（Services）

#### WindyAPIService
负责与Windy API通信。

```javascript
class WindyAPIService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseURL = 'https://api.windy.com/api/point-forecast/v2';
  }
  
  async fetchWeatherData(lat, lon, hours = 168) {
    // 发送POST请求到Windy API
    // 请求参数：temp, rh, clouds, wind, pressure, visibility, precip
    // 需求11：支持获取7天（168小时）数据
    // 需求12：请求云层分层数据（lclouds, mclouds, hclouds）
    // 返回：WeatherData数组（最多168小时预测）
  }
  
  validateAPIKey() {
    // 验证API密钥有效性
  }
}
```

**设计决策**：扩展WindyAPIService以支持需求11（7天天气数据）和需求12（云层分层数据）。默认获取168小时（7天）数据，并请求额外的气象参数（降水、分层云量）。

#### GeocodingService
将位置名称转换为坐标。

```javascript
class GeocodingService {
  async geocode(locationName) {
    // 使用浏览器Geolocation API或第三方服务
    // 返回：Location对象
  }
  
  async getCurrentLocation() {
    // 获取用户当前GPS位置
    // 返回：Location对象
  }
}
```

#### StorageService
管理本地存储。

```javascript
class StorageService {
  saveAPIKey(apiKey) {
    localStorage.setItem('windy_api_key', apiKey);
  }
  
  getAPIKey() {
    return localStorage.getItem('windy_api_key');
  }
  
  cacheWeatherData(location, data, timestamp) {
    // 缓存天气数据，30分钟有效期
  }
  
  getCachedWeatherData(location) {
    // 获取缓存数据，检查是否过期
  }
  
  // 需求13：搜索历史管理
  saveSearchHistory(location) {
    // 保存位置到搜索历史，最多5个
    // 如果位置已存在，移到最前面
    // 如果超过5个，删除最早的记录
  }
  
  getSearchHistory() {
    // 获取搜索历史列表，按时间倒序
    return [];
  }
  
  removeSearchHistoryItem(locationKey) {
    // 删除单个历史记录
  }
  
  clearSearchHistory() {
    // 清除全部历史记录
  }
  
  // 需求12：收藏位置管理
  saveFavoriteLocation(location) {
    // 保存收藏位置
  }
  
  getFavoriteLocations() {
    // 获取所有收藏位置
    return [];
  }
  
  removeFavoriteLocation(locationKey) {
    // 删除收藏位置
  }
  
  // 需求12：通知提醒设置
  saveNotificationSettings(settings) {
    // 保存通知设置（是否启用、阈值等）
  }
  
  getNotificationSettings() {
    // 获取通知设置
    return { enabled: false, threshold: 70 };
  }
}
```

**设计决策**：扩展StorageService以支持需求13（搜索历史）和需求12（收藏位置、通知设置）。搜索历史采用LRU（最近最少使用）策略，限制为5个以避免存储膨胀。收藏位置和通知设置独立存储，便于用户管理。

#### SunsetPredictionService
核心预测算法。

```javascript
class SunsetPredictionService {
  constructor() {
    this.weights = {
      cloudCover: 0.35,
      humidity: 0.25,
      visibility: 0.20,
      lowClouds: 0.20
    };
  }
  
  calculatePrediction(weatherData, sunsetTime, type = 'sunset') {
    // 分析气象数据
    // 计算各因素得分
    // 返回：SunsetPrediction对象
  }
  
  scoreCloudCover(cloudCover) {
    // 中高层云量评分：30-70%最佳
    // 使用正态分布曲线
  }
  
  scoreHumidity(humidity) {
    // 湿度评分：30-70%最佳
  }
  
  scoreVisibility(visibility) {
    // 能见度评分：越高越好
  }
  
  scoreLowClouds(lowCloudCover) {
    // 低层云评分：越少越好
  }
  
  // 需求12：天文时间计算
  getSunsetTime(date, lat, lon) {
    // 计算指定日期和位置的日落时间
    // 使用天文算法（如SunCalc库）
  }
  
  getSunriseTime(date, lat, lon) {
    // 计算指定日期和位置的日出时间
  }
  
  getGoldenHour(sunTime, type) {
    // 计算黄金时段
    // 日出后30-60分钟或日落前30-60分钟
    return { start: Date, end: Date };
  }
  
  getBlueHour(sunTime, type) {
    // 计算蓝调时段
    // 日出前20-30分钟或日落后20-30分钟
    return { start: Date, end: Date };
  }
  
  getSunAzimuth(date, time, lat, lon) {
    // 计算太阳方位角（0-360度）
    // 仅当预测评分>70时调用
  }
  
  analyzeCloudLayers(highClouds, midClouds, lowClouds) {
    // 分析云层分层对朝霞/晚霞的影响
    // 返回：{high, mid, low, description}
    // 例如："中高云适中，有利于火烧云形成"
  }
}
```

**设计决策**：扩展SunsetPredictionService以支持需求12的专业功能。新增天文计算方法（日出/日落、黄金/蓝调时段、太阳方位角）和云层分析方法。考虑使用SunCalc等成熟的天文计算库以确保精度。

#### ChartService
数据可视化服务（需求11）。

```javascript
class ChartService {
  constructor() {
    this.chartLibrary = null; // 可选：Chart.js 或原生Canvas
  }
  
  renderTemperatureChart(hourlyData, containerId) {
    // 渲染24小时温度折线图
    // 使用蓝→橙→红渐变色
  }
  
  renderPrecipitationChart(hourlyData, containerId) {
    // 渲染降水柱状图
    // 使用蓝色系
  }
  
  renderHumidityChart(hourlyData, containerId) {
    // 渲染湿度折线图或面积图
  }
  
  renderWindChart(hourlyData, containerId) {
    // 渲染风速折线图，带风向箭头
  }
  
  renderPressureChart(hourlyData, containerId) {
    // 渲染气压折线图
  }
  
  renderCloudChart(hourlyData, containerId) {
    // 渲染云量面积图或柱状图
  }
  
  highlightKeyPoints(chartData) {
    // 在图表上标注关键数值点
  }
}
```

**设计决策**：新增ChartService以支持需求11的数据可视化功能。可以使用轻量级图表库（如Chart.js）或原生Canvas实现。每种气象参数使用不同的图表类型和颜色编码，提升可读性。支持移动端横向滚动。

#### NotificationService
浏览器通知服务（需求12）。

```javascript
class NotificationService {
  constructor(storageService) {
    this.storageService = storageService;
  }
  
  async requestPermission() {
    // 请求浏览器通知权限
    return await Notification.requestPermission();
  }
  
  checkPredictionAndNotify(predictions) {
    // 检查预测评分是否达到阈值
    // 如果达到，发送通知
    const settings = this.storageService.getNotificationSettings();
    if (!settings.enabled) return;
    
    predictions.forEach(pred => {
      if (pred.score >= settings.threshold) {
        this.sendNotification(pred);
      }
    });
  }
  
  sendNotification(prediction) {
    // 发送浏览器通知
    // 包含日期、时间、评分信息
    new Notification('晚霞预测提醒', {
      body: `${prediction.date} ${prediction.type === 'sunset' ? '晚霞' : '朝霞'}评分：${prediction.score}`,
      icon: '/icon.png'
    });
  }
}
```

**设计决策**：新增NotificationService以支持需求12的通知提醒功能。使用浏览器原生Notification API，支持用户自定义阈值。通知内容包含日期、时间和评分，帮助用户快速决策。

### 3. 控制层（Controllers）

#### AppController
应用主控制器，协调各组件。

```javascript
class AppController {
  constructor() {
    this.storageService = new StorageService();
    this.weatherController = new WeatherController();
    this.predictionController = new PredictionController();
    this.notificationService = new NotificationService(this.storageService);
  }
  
  async initialize() {
    // 检查API密钥
    // 初始化UI
    // 加载上次位置（如果有）
    // 需求12：请求通知权限（如果用户启用了通知）
    // 需求13：加载搜索历史
  }
  
  async handleLocationChange(location) {
    // 处理位置变更
    // 获取天气数据
    // 更新预测
    // 需求13：保存到搜索历史
  }
  
  // 需求13：搜索历史管理
  loadSearchHistory() {
    // 加载并显示搜索历史
  }
  
  handleHistoryItemClick(location) {
    // 点击历史记录，加载该位置的天气
  }
  
  removeHistoryItem(locationKey) {
    // 删除单个历史记录
  }
  
  clearAllHistory() {
    // 清除全部历史记录
  }
  
  // 需求12：收藏位置管理
  addFavoriteLocation(location) {
    // 添加收藏位置
  }
  
  loadFavoriteLocations() {
    // 加载并显示收藏位置
  }
  
  removeFavoriteLocation(locationKey) {
    // 删除收藏位置
  }
  
  switchToFavoriteLocation(location) {
    // 切换到收藏位置
  }
  
  // 需求12：通知设置管理
  updateNotificationSettings(settings) {
    // 更新通知设置
    this.storageService.saveNotificationSettings(settings);
  }
}
```

**设计决策**：扩展AppController以支持需求13（搜索历史）和需求12（收藏位置、通知管理）。新增历史记录管理、收藏位置管理、通知设置管理等功能。协调各个控制器和服务，确保数据流畅通。

#### WeatherController
管理天气数据获取和显示。

```javascript
class WeatherController {
  constructor(apiService, storageService, chartService) {
    this.apiService = apiService;
    this.storageService = storageService;
    this.chartService = chartService;
    this.currentView = 'overview'; // 'overview' 或 'hourly'
    this.selectedDay = 'today'; // 'today' 或 'tomorrow'
    this.selectedParameter = 'temp'; // 'temp', 'precip', 'humidity', 'wind', 'pressure', 'clouds'
  }
  
  async fetchWeather(location) {
    // 检查缓存
    // 如果缓存有效，返回缓存数据
    // 否则调用API获取新数据（7天/168小时）
  }
  
  updateWeatherDisplay(weatherData) {
    // 更新UI显示天气信息
  }
  
  // 需求11：7天概览
  renderWeeklyOverview(weatherData) {
    // 显示未来7天的每日概览
    // 包含日期、最高/最低温度、天气图标、降水概率
  }
  
  // 需求11：24小时详细预报
  renderHourlyForecast(weatherData, day) {
    // 显示今天或明天的24小时预报
    // 根据selectedParameter渲染对应图表
  }
  
  switchParameter(parameter) {
    // 切换显示的气象参数
    this.selectedParameter = parameter;
    this.renderHourlyForecast(this.weatherData, this.selectedDay);
  }
  
  switchDay(day) {
    // 切换查看今天或明天
    this.selectedDay = day;
    this.renderHourlyForecast(this.weatherData, day);
  }
}
```

**设计决策**：扩展WeatherController以支持需求11的天气界面优化。新增视图切换功能（概览/详细）、参数切换功能（温度/降水/湿度等）、日期切换功能（今天/明天）。集成ChartService进行数据可视化。

#### PredictionController
管理晚霞预测逻辑。

```javascript
class PredictionController {
  constructor(predictionService, notificationService) {
    this.predictionService = predictionService;
    this.notificationService = notificationService;
  }
  
  async generatePredictions(weatherDataArray, location) {
    // 为未来3天生成预测
    // 需求12：分别生成朝霞和晚霞预测
    // 返回：SunsetPrediction数组（包含sunrise和sunset类型）
  }
  
  updatePredictionDisplay(predictions) {
    // 更新UI显示预测结果
    // 需求12：显示日出/日落时间、黄金/蓝调时段、太阳方位角、云层分层
  }
  
  // 需求12：云层分层显示
  renderCloudLayers(cloudLayers) {
    // 显示高云、中云、低云的覆盖百分比
    // 使用不同颜色或图标区分
    // 显示影响说明
  }
  
  // 需求12：检查并发送通知
  checkAndNotify(predictions) {
    this.notificationService.checkPredictionAndNotify(predictions);
  }
}
```

**设计决策**：扩展PredictionController以支持需求12的朝霞晚霞预测增强功能。生成独立的朝霞和晚霞预测，显示专业时间信息（黄金/蓝调时段）、太阳方位角、云层分层。集成NotificationService实现通知提醒。

### 4. UI组件（View）

#### HTML结构
```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>天气晚霞预测器</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div id="app">
    <!-- API密钥配置模态框 -->
    <div id="api-key-modal" class="modal">
      <div class="modal-content">
        <h2>配置Windy API密钥</h2>
        <input type="text" id="api-key-input" placeholder="输入API密钥">
        <button id="save-api-key">保存</button>
      </div>
    </div>
    
    <!-- 需求12：通知设置模态框 -->
    <div id="notification-modal" class="modal">
      <div class="modal-content">
        <h2>通知设置</h2>
        <label>
          <input type="checkbox" id="notification-enabled"> 启用通知提醒
        </label>
        <label>
          评分阈值：<input type="number" id="notification-threshold" min="0" max="100" value="70">
        </label>
        <button id="save-notification-settings">保存</button>
      </div>
    </div>
    
    <!-- 主界面 -->
    <header>
      <h1>🌅 晚霞预测器</h1>
      <button id="settings-btn">⚙️</button>
      <button id="notification-settings-btn">🔔</button>
    </header>
    
    <main>
      <!-- 位置选择 -->
      <section id="location-section">
        <div class="location-input-wrapper">
          <input type="text" id="location-input" placeholder="输入城市名称">
          <button id="search-btn">搜索</button>
          <button id="current-location-btn">📍 使用当前位置</button>
          
          <!-- 需求13：搜索历史下拉列表 -->
          <div id="search-history-dropdown" class="dropdown hidden">
            <div class="dropdown-header">
              <span>最近搜索</span>
              <button id="clear-all-history">清除全部</button>
            </div>
            <ul id="search-history-list">
              <!-- 动态填充历史记录 -->
            </ul>
            <div class="empty-history hidden">暂无搜索历史</div>
          </div>
        </div>
        
        <!-- 需求12：收藏位置 -->
        <div id="favorite-locations">
          <h3>收藏位置</h3>
          <ul id="favorite-list">
            <!-- 动态填充收藏位置 -->
          </ul>
          <button id="add-favorite-btn">⭐ 收藏当前位置</button>
        </div>
      </section>
      
      <!-- 需求11：天气面板 -->
      <section id="weather-section">
        <h2>天气信息</h2>
        
        <!-- 视图切换 -->
        <div class="view-toggle">
          <button id="overview-btn" class="active">7天概览</button>
          <button id="hourly-btn">详细预报</button>
        </div>
        
        <!-- 7天概览视图 -->
        <div id="weekly-overview" class="weather-view">
          <div id="weekly-cards">
            <!-- 动态填充7天天气卡片 -->
          </div>
        </div>
        
        <!-- 24小时详细视图 -->
        <div id="hourly-forecast" class="weather-view hidden">
          <!-- 日期选择 -->
          <div class="day-selector">
            <button id="today-btn" class="active">今天</button>
            <button id="tomorrow-btn">明天</button>
          </div>
          
          <!-- 参数选择 -->
          <div class="parameter-selector">
            <button data-param="temp" class="active">温度</button>
            <button data-param="precip">降水</button>
            <button data-param="humidity">湿度</button>
            <button data-param="wind">风速</button>
            <button data-param="pressure">气压</button>
            <button data-param="clouds">云量</button>
          </div>
          
          <!-- 图表容器 -->
          <div id="chart-container">
            <canvas id="weather-chart"></canvas>
          </div>
        </div>
      </section>
      
      <!-- 晚霞预测 -->
      <section id="prediction-section">
        <h2>朝霞晚霞预测</h2>
        <div id="prediction-display">
          <!-- 动态填充预测信息 -->
        </div>
      </section>
      
      <!-- 未来预测 -->
      <section id="forecast-section">
        <h2>未来3天预测</h2>
        <div id="forecast-timeline">
          <!-- 动态填充时间线 -->
          <!-- 需求12：显示朝霞和晚霞的独立预测 -->
        </div>
      </section>
    </main>
    
    <footer>
      <button id="refresh-btn">🔄 刷新数据</button>
    </footer>
  </div>
  
  <script type="module" src="app.js"></script>
</body>
</html>
```

**设计决策**：扩展HTML结构以支持需求11（天气界面优化）、需求12（朝霞晚霞预测增强）、需求13（搜索历史）。新增组件包括：
- 搜索历史下拉列表（需求13）
- 收藏位置列表（需求12）
- 通知设置模态框（需求12）
- 7天概览和24小时详细视图切换（需求11）
- 参数选择器和图表容器（需求11）
- 朝霞晚霞独立预测显示（需求12）

#### CSS设计原则
- 响应式设计：使用媒体查询适配移动端和桌面端
- 颜色方案：根据预测质量使用不同颜色（绿色/黄色/灰色）
- 动画：加载状态使用平滑过渡动画
- 可访问性：确保足够的对比度和可点击区域

## 数据模型

### API请求格式

**Windy API请求示例**：
```json
{
  "lat": 39.9042,
  "lon": 116.4074,
  "model": "gfs",
  "parameters": ["temp", "rh", "clouds", "wind", "pressure", "visibility", "precip", "lclouds", "mclouds", "hclouds"],
  "levels": ["surface"],
  "key": "YOUR_API_KEY"
}
```

**设计决策**：扩展API请求参数以支持需求11（降水数据）和需求12（云层分层数据）。新增参数包括：
- `precip`：降水量或降水概率
- `lclouds`：低层云量（<2km）
- `mclouds`：中层云量（2-6km）
- `hclouds`：高层云量（>6km）

**Windy API响应示例**：
```json
{
  "ts": [1640000000, 1640003600, ...],
  "temp-surface": [15.2, 14.8, ...],
  "rh-surface": [65, 68, ...],
  "clouds-surface": [45, 50, ...],
  "wind_u-surface": [3.2, 2.8, ...],
  "wind_v-surface": [1.5, 1.2, ...],
  "pressure-surface": [1013, 1012, ...],
  "visibility-surface": [10, 12, ...],
  "precip-surface": [0, 0.5, ...],
  "lclouds-surface": [20, 25, ...],
  "mclouds-surface": [30, 35, ...],
  "hclouds-surface": [15, 20, ...]
}
```

### LocalStorage数据结构

```javascript
{
  "windy_api_key": "string",
  "last_location": {
    "lat": number,
    "lon": number,
    "name": "string"
  },
  "weather_cache": {
    "location_key": {
      "data": [...],
      "timestamp": number
    }
  },
  // 需求13：搜索历史
  "search_history": [
    {
      "lat": number,
      "lon": number,
      "name": "string",
      "timestamp": number
    }
  ],
  // 需求12：收藏位置
  "favorite_locations": [
    {
      "lat": number,
      "lon": number,
      "name": "string"
    }
  ],
  // 需求12：通知设置
  "notification_settings": {
    "enabled": boolean,
    "threshold": number
  }
}
```

**设计决策**：扩展LocalStorage数据结构以支持需求13（搜索历史）和需求12（收藏位置、通知设置）。搜索历史包含时间戳用于排序和LRU策略，收藏位置独立存储便于管理。

## 正确性属性

*属性是一个特征或行为，应该在系统的所有有效执行中保持为真——本质上是关于系统应该做什么的形式化陈述。属性作为人类可读规范和机器可验证正确性保证之间的桥梁。*


### 属性 1：API密钥存储往返一致性
*对于任何*有效的API密钥字符串，将其保存到本地存储后再读取，应该得到相同的字符串值。
**验证需求：1.2**

### 属性 2：位置坐标有效性
*对于任何*成功的地理编码结果，返回的Location对象的纬度应该在-90到90之间，经度应该在-180到180之间。
**验证需求：2.2**

### 属性 3：API请求格式完整性
*对于任何*天气数据请求，发送的HTTP请求应该使用POST方法，并且请求体应该包含所有必需的气象参数（temp、rh、clouds、wind、pressure、visibility）。
**验证需求：3.2, 3.3**

### 属性 4：天气数据解析完整性
*对于任何*有效的Windy API响应，解析后的WeatherData数组长度应该等于响应中时间戳数组的长度。
**验证需求：3.4**

### 属性 5：天气显示单位格式正确性
*对于任何*WeatherData对象，渲染后的HTML字符串应该包含温度（°C）、湿度（%）、云量（%）和风速（km/h）的正确单位标识。
**验证需求：4.2, 4.3, 4.4**

### 属性 6：云量因素评分最优区间
*对于任何*云量值在30-70%范围内的天气数据，云量因素得分应该高于云量值在0-30%或70-100%范围外的天气数据。
**验证需求：5.1**

### 属性 7：湿度因素评分最优区间
*对于任何*湿度值在30-70%范围内的天气数据，湿度因素得分应该高于湿度值在范围外的天气数据。
**验证需求：5.2**

### 属性 8：能见度因素评分单调性
*对于任何*两个天气数据对象，如果数据A的能见度高于数据B，则数据A的能见度因素得分应该高于或等于数据B。
**验证需求：5.3**

### 属性 9：低层云因素评分单调性
*对于任何*两个天气数据对象，如果数据A的低层云量低于数据B，则数据A的低层云因素得分应该高于或等于数据B。
**验证需求：5.4**

### 属性 10：预测评分范围和分类正确性
*对于任何*天气数据输入，生成的SunsetPrediction对象的评分应该在0-100范围内，并且质量等级应该正确对应：评分≥70为"优秀"，40-69为"良好"，<40为"一般"。
**验证需求：5.5, 5.6, 5.7, 5.8**

### 属性 11：预测结果渲染完整性
*对于任何*SunsetPrediction对象，渲染后的HTML应该包含预测评分、质量等级和关键气象因素信息。
**验证需求：6.1, 6.3**

### 属性 12：颜色编码映射正确性
*对于任何*预测质量等级，getColorForQuality函数应该返回正确的颜色代码："优秀"→绿色，"良好"→黄色，"一般"→灰色。
**验证需求：6.2**

### 属性 13：最佳观赏时间计算正确性
*对于任何*日落时间，计算的最佳观赏时间窗口应该是日落时间前30分钟到日落时间后30分钟。
**验证需求：6.4**

### 属性 14：多日预测数量正确性
*对于任何*包含至少72小时数据的天气数据数组，生成的预测列表应该包含3个SunsetPrediction对象。
**验证需求：7.1**

### 属性 15：预测最高质量识别正确性
*对于任何*预测列表，标记为"最佳"的预测应该是列表中评分最高的预测。
**验证需求：7.5**

### 属性 16：缓存有效期行为正确性
*对于任何*缓存的天气数据，如果当前时间距离缓存时间戳小于30分钟，getCachedWeatherData应该返回缓存数据；如果超过30分钟，应该返回null。
**验证需求：9.4, 9.5**

### 属性 17：错误处理健壮性
*对于任何*无效输入（null、undefined、格式错误的数据），系统的核心函数应该返回错误对象或默认值，而不是抛出未捕获的异常。
**验证需求：10.5**

### 属性 18：搜索历史LRU策略正确性
*对于任何*搜索历史操作，当历史记录数量超过5个时，系统应该删除时间戳最早的记录；当搜索已存在的位置时，系统应该更新该位置的时间戳并移到列表最前面。
**验证需求：13.2, 13.3, 13.9**

### 属性 19：搜索历史排序正确性
*对于任何*搜索历史列表，返回的记录应该按时间戳倒序排列（最新的在最前面）。
**验证需求：13.6**

### 属性 20：收藏位置唯一性
*对于任何*收藏位置操作，系统不应该允许添加重复的位置（基于经纬度坐标判断）。
**验证需求：12.9, 12.10**

### 属性 21：通知阈值验证正确性
*对于任何*通知设置，阈值应该在0-100范围内，并且只有当预测评分大于或等于阈值时才触发通知。
**验证需求：12.7, 12.8**

### 属性 22：朝霞晚霞独立评分正确性
*对于任何*天气数据，系统应该为日出（朝霞）和日落（晚霞）生成独立的预测评分，两个评分可以不同。
**验证需求：12.4**

### 属性 23：黄金时段计算正确性
*对于任何*日出或日落时间，黄金时段应该是日出后30-60分钟或日落前30-60分钟。
**验证需求：12.2**

### 属性 24：蓝调时段计算正确性
*对于任何*日出或日落时间，蓝调时段应该是日出前20-30分钟或日落后20-30分钟。
**验证需求：12.3**

### 属性 25：云层分层数据完整性
*对于任何*包含云层分层数据的WeatherData对象，高云、中云、低云的百分比之和应该接近总云量（允许±10%的误差）。
**验证需求：12.11**

### 属性 26：7天天气数据长度正确性
*对于任何*成功的天气数据请求，返回的数据数组长度应该至少包含168个小时点（7天）。
**验证需求：11.1**

### 属性 27：图表数据点数量一致性
*对于任何*24小时图表渲染，图表的数据点数量应该等于24（每小时一个数据点）。
**验证需求：11.3**

### 属性 28：温度颜色编码单调性
*对于任何*温度值，较高的温度应该映射到较暖的颜色（蓝→橙→红渐变），颜色编码应该保持单调性。
**验证需求：11.11**

## 错误处理

### 错误类型和处理策略

#### 1. 网络错误
- **场景**：API请求失败、超时、无网络连接
- **处理**：
  - 捕获fetch错误
  - 显示用户友好的错误消息
  - 提供重试按钮
  - 如果有缓存数据，提示用户使用缓存数据

#### 2. API错误
- **场景**：API密钥无效、请求限制、服务器错误
- **处理**：
  - 解析API响应中的错误代码
  - 针对不同错误码显示特定消息
  - 401/403：提示检查API密钥
  - 429：提示请求过于频繁
  - 500：提示服务器错误，稍后重试

#### 3. 数据验证错误
- **场景**：API返回格式错误、缺少必需字段
- **处理**：
  - 在解析前验证数据结构
  - 使用默认值填充缺失字段
  - 记录错误到控制台（开发模式）
  - 显示"数据格式错误"消息

#### 4. 地理位置错误
- **场景**：用户拒绝位置权限、位置服务不可用、地理编码失败
- **处理**：
  - 捕获Geolocation API错误
  - 提示用户手动输入位置
  - 提供常用城市快捷选项

#### 5. 存储错误
- **场景**：LocalStorage已满、浏览器禁用存储
- **处理**：
  - 使用try-catch包装存储操作
  - 降级到内存存储
  - 提示用户清理浏览器数据

### 错误处理实现

```javascript
class ErrorHandler {
  static handleAPIError(error) {
    if (error.status === 401 || error.status === 403) {
      return {
        type: 'API_KEY_INVALID',
        message: 'API密钥无效，请检查配置',
        action: 'showAPIKeyModal'
      };
    }
    if (error.status === 429) {
      return {
        type: 'RATE_LIMIT',
        message: '请求过于频繁，请稍后再试',
        action: 'disableRefreshButton'
      };
    }
    return {
      type: 'API_ERROR',
      message: '获取天气数据失败，请稍后重试',
      action: 'showRetryButton'
    };
  }
  
  static handleNetworkError(error) {
    return {
      type: 'NETWORK_ERROR',
      message: '网络连接失败，请检查网络设置',
      action: 'showRetryButton'
    };
  }
  
  static handleValidationError(field, value) {
    return {
      type: 'VALIDATION_ERROR',
      message: `数据验证失败：${field}`,
      action: 'logError'
    };
  }
}
```

## 测试策略

### 测试方法

本项目采用**双重测试方法**，结合单元测试和基于属性的测试，以确保全面的代码覆盖和正确性验证。

#### 单元测试
- **目的**：验证特定示例、边缘情况和错误条件
- **工具**：Jest（JavaScript测试框架）
- **覆盖范围**：
  - 具体示例：特定输入的预期输出
  - 边缘情况：空数据、极端值、边界条件
  - 错误处理：无效输入、API错误、网络故障
  - 集成点：组件间交互、API调用

#### 基于属性的测试
- **目的**：验证跨所有输入的通用属性
- **工具**：fast-check（JavaScript属性测试库）
- **配置**：每个属性测试最少100次迭代
- **覆盖范围**：
  - 通用属性：对所有输入都应该成立的规则
  - 不变量：操作前后保持不变的条件
  - 往返属性：序列化/反序列化一致性
  - 单调性：输入增加时输出的预期变化

### 测试标注格式

每个基于属性的测试必须使用注释标注其对应的设计文档属性：

```javascript
// Feature: weather-sunset-predictor, Property 1: API密钥存储往返一致性
test('API key storage round trip', () => {
  fc.assert(
    fc.property(fc.string(), (apiKey) => {
      storageService.saveAPIKey(apiKey);
      const retrieved = storageService.getAPIKey();
      expect(retrieved).toBe(apiKey);
    }),
    { numRuns: 100 }
  );
});
```

### 测试组织结构

```
tests/
├── unit/
│   ├── models/
│   │   ├── Location.test.js
│   │   ├── WeatherData.test.js
│   │   └── SunsetPrediction.test.js
│   ├── services/
│   │   ├── WindyAPIService.test.js
│   │   ├── GeocodingService.test.js
│   │   ├── StorageService.test.js
│   │   ├── SunsetPredictionService.test.js
│   │   ├── ChartService.test.js          // 需求11
│   │   └── NotificationService.test.js   // 需求12
│   └── controllers/
│       ├── AppController.test.js
│       ├── WeatherController.test.js
│       └── PredictionController.test.js
├── property/
│   ├── storage.property.test.js
│   ├── geocoding.property.test.js
│   ├── api.property.test.js
│   ├── prediction.property.test.js
│   ├── caching.property.test.js
│   ├── search-history.property.test.js   // 需求13
│   ├── favorites.property.test.js        // 需求12
│   ├── notifications.property.test.js    // 需求12
│   └── charts.property.test.js           // 需求11
└── integration/
    ├── weather-flow.test.js
    ├── prediction-flow.test.js
    ├── search-history-flow.test.js       // 需求13
    └── notification-flow.test.js         // 需求12
```

### 关键测试场景

#### 1. 存储服务测试
- **单元测试**：
  - 保存和读取特定API密钥
  - 处理LocalStorage不可用情况
  - 清除存储数据
- **属性测试**：
  - 属性1：API密钥往返一致性

#### 2. 地理编码测试
- **单元测试**：
  - 解析常见城市名称
  - 处理无效位置名称
  - 验证坐标范围
- **属性测试**：
  - 属性2：位置坐标有效性

#### 3. API服务测试
- **单元测试**：
  - 构造正确的API请求
  - 解析API响应
  - 处理各种API错误
- **属性测试**：
  - 属性3：API请求格式完整性
  - 属性4：天气数据解析完整性

#### 4. 预测算法测试
- **单元测试**：
  - 特定天气条件的预测结果
  - 边缘情况（极端天气值）
  - 日落时间计算
- **属性测试**：
  - 属性6-9：各气象因素评分规则
  - 属性10：评分范围和分类
  - 属性13：最佳观赏时间计算

#### 5. 缓存测试
- **单元测试**：
  - 缓存数据保存和读取
  - 缓存过期处理
- **属性测试**：
  - 属性16：缓存有效期行为

#### 6. 渲染测试
- **单元测试**：
  - 天气信息HTML生成
  - 预测结果HTML生成
  - 颜色编码应用
- **属性测试**：
  - 属性5：天气显示单位格式
  - 属性11：预测结果渲染完整性
  - 属性12：颜色编码映射

#### 7. 搜索历史测试（需求13）
- **单元测试**：
  - 保存搜索历史
  - 加载搜索历史
  - 删除单个历史记录
  - 清除全部历史记录
  - 处理重复位置
- **属性测试**：
  - 属性18：搜索历史LRU策略正确性
  - 属性19：搜索历史排序正确性

#### 8. 收藏位置测试（需求12）
- **单元测试**：
  - 添加收藏位置
  - 删除收藏位置
  - 切换到收藏位置
  - 处理重复收藏
- **属性测试**：
  - 属性20：收藏位置唯一性

#### 9. 通知服务测试（需求12）
- **单元测试**：
  - 请求通知权限
  - 发送通知
  - 检查阈值
  - 更新通知设置
- **属性测试**：
  - 属性21：通知阈值验证正确性

#### 10. 图表服务测试（需求11）
- **单元测试**：
  - 渲染各类图表（温度、降水、湿度等）
  - 标注关键数值点
  - 颜色编码应用
  - 移动端横向滚动
- **属性测试**：
  - 属性27：图表数据点数量一致性
  - 属性28：温度颜色编码单调性

#### 11. 朝霞晚霞预测增强测试（需求12）
- **单元测试**：
  - 日出/日落时间计算
  - 黄金时段计算
  - 蓝调时段计算
  - 太阳方位角计算
  - 云层分层分析
  - 朝霞和晚霞独立评分
- **属性测试**：
  - 属性22：朝霞晚霞独立评分正确性
  - 属性23：黄金时段计算正确性
  - 属性24：蓝调时段计算正确性
  - 属性25：云层分层数据完整性

#### 12. 7天天气数据测试（需求11）
- **单元测试**：
  - 7天概览渲染
  - 24小时详细预报渲染
  - 参数切换
  - 日期切换
- **属性测试**：
  - 属性26：7天天气数据长度正确性

### 测试覆盖率目标

- **代码覆盖率**：≥80%
- **分支覆盖率**：≥75%
- **函数覆盖率**：≥90%
- **关键路径覆盖率**：100%（预测算法、API调用、错误处理）

### 持续集成

- 每次提交前运行所有测试
- 使用GitHub Actions或类似CI工具
- 测试失败时阻止合并
- 生成测试覆盖率报告

### 测试数据生成

使用fast-check的生成器创建测试数据：

```javascript
// 天气数据生成器
const weatherDataArbitrary = fc.record({
  timestamp: fc.integer({ min: Date.now(), max: Date.now() + 86400000 * 7 }),
  temp: fc.float({ min: -50, max: 50 }),
  humidity: fc.float({ min: 0, max: 100 }),
  cloudCover: fc.float({ min: 0, max: 100 }),
  windSpeed: fc.float({ min: 0, max: 200 }),
  pressure: fc.float({ min: 900, max: 1100 }),
  visibility: fc.float({ min: 0, max: 50 })
});

// 位置生成器
const locationArbitrary = fc.record({
  lat: fc.float({ min: -90, max: 90 }),
  lon: fc.float({ min: -180, max: 180 }),
  name: fc.string({ minLength: 1, maxLength: 50 })
});
```

## 实现注意事项

### 性能优化
1. **API调用节流**：使用缓存减少API请求
2. **DOM操作优化**：批量更新DOM，避免频繁重绘
3. **懒加载**：按需加载未来预测数据
4. **防抖处理**：位置输入使用防抖，避免频繁搜索
5. **图表渲染优化**（需求11）：使用Canvas硬件加速，避免重复渲染
6. **搜索历史缓存**（需求13）：在内存中缓存历史列表，减少LocalStorage读取

### 安全考虑
1. **API密钥保护**：虽然存储在LocalStorage，但提醒用户不要在公共设备上使用
2. **输入验证**：所有用户输入都需要验证和清理
3. **HTTPS**：确保所有API调用使用HTTPS
4. **CSP**：配置内容安全策略防止XSS攻击
5. **通知权限**（需求12）：尊重用户的通知权限选择，不强制请求

### 可访问性
1. **语义化HTML**：使用适当的HTML5标签
2. **ARIA标签**：为动态内容添加ARIA属性
3. **键盘导航**：确保所有功能可通过键盘访问
4. **屏幕阅读器**：提供适当的alt文本和标签
5. **图表可访问性**（需求11）：为图表提供文本替代方案，支持屏幕阅读器

### 浏览器兼容性
- 目标浏览器：Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- Polyfills：为旧浏览器提供Fetch API和Promise支持
- 渐进增强：核心功能在所有浏览器可用，高级功能渐进增强
- Canvas支持：确保图表在不支持Canvas的浏览器中有降级方案
- Notification API：检查浏览器是否支持通知，提供优雅降级

### 第三方库考虑
1. **天文计算库**（需求12）：
   - 推荐使用SunCalc.js进行日出/日落、太阳方位角计算
   - 轻量级（~5KB），精度高，无依赖
   
2. **图表库**（需求11）：
   - 选项1：Chart.js（功能丰富，社区活跃）
   - 选项2：原生Canvas（更轻量，更灵活）
   - 建议：使用Chart.js以加快开发速度，后期可优化为原生Canvas
   
3. **日期处理**：
   - 可选使用date-fns或Day.js进行日期格式化
   - 或使用原生Intl.DateTimeFormat API

### 数据管理策略
1. **搜索历史管理**（需求13）：
   - 使用LRU（最近最少使用）策略
   - 限制为5个记录以控制存储大小
   - 使用时间戳进行排序和过期管理
   
2. **收藏位置管理**（需求12）：
   - 使用经纬度坐标作为唯一标识
   - 允许用户自定义位置名称
   - 不限制收藏数量（但建议UI提示合理数量）
   
3. **通知管理**（需求12）：
   - 使用浏览器原生Notification API
   - 检查权限状态，避免重复请求
   - 提供清晰的通知设置界面

### 用户体验优化
1. **加载状态**：为所有异步操作提供加载指示器
2. **错误反馈**：提供清晰、友好的错误消息
3. **空状态**：为空数据提供有意义的提示（如"暂无搜索历史"）
4. **动画过渡**：使用平滑的CSS过渡动画提升体验
5. **触摸优化**（需求11）：图表支持触摸滑动，按钮有足够的点击区域
6. **快捷操作**（需求13）：搜索历史支持快速选择，减少输入
