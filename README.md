# 天气晚霞预测器 (Weather Sunset Predictor)

基于Windy API的火烧云（晚霞）预测Web应用程序。

## 项目结构

```
weather-sunset-predictor/
├── src/                    # 源代码目录
│   ├── models/            # 数据模型
│   ├── services/          # 服务层（API、存储、预测算法）
│   ├── controllers/       # 控制层
│   ├── utils/             # 工具函数
│   └── app.js             # 应用入口
├── tests/                  # 测试目录
│   ├── unit/              # 单元测试
│   ├── property/          # 基于属性的测试
│   └── integration/       # 集成测试
├── styles/                 # CSS样式文件
│   └── main.css           # 主样式文件
├── index.html             # 主HTML页面
├── package.json           # 项目依赖配置
├── jest.config.js         # Jest测试配置
└── babel.config.js        # Babel转译配置
```

## 功能特性

- 🌍 位置选择（手动输入或GPS定位）
- 🌤️ 实时天气数据展示
- 🌅 火烧云预测算法
- 📅 未来3天预测时间线
- 💾 本地数据缓存
- 📱 响应式设计（支持移动端和桌面端）
- ♿ 可访问性支持

## 技术栈

- **前端**: 原生JavaScript (ES6+), HTML5, CSS3
- **API**: Windy Point Forecast API
- **测试**: Jest + fast-check
- **存储**: LocalStorage API

## 开发指南

### 安装依赖

```bash
npm install
```

### 运行测试

```bash
# 运行所有测试
npm test

# 监听模式
npm run test:watch

# 生成覆盖率报告
npm run test:coverage
```

### 开发服务器

由于这是一个纯前端应用，可以使用任何静态服务器：

```bash
# 使用Python
python -m http.server 8000

# 使用Node.js http-server
npx http-server
```

然后访问 `http://localhost:8000`

## 配置

### Windy API密钥

1. 访问 [Windy API](https://api.windy.com/) 注册账号
2. 获取API密钥
3. 在应用首次启动时输入API密钥

### 地理编码服务配置

应用支持两种地理编码服务模式：

#### 1. 模拟服务（离线测试）- 默认启用

适用于无法访问外部API或离线测试的场景。包含预置的中国和国际主要城市数据。

**当前配置**: 默认使用 `MockGeocodingService`

**支持的城市**: 北京、上海、广州、深圳、成都、杭州、西安、南京、武汉、重庆、天津、苏州、长沙、郑州、东莞、青岛、沈阳、宁波、昆明、大连、厦门、合肥、佛山、福州、哈尔滨、济南、温州、长春、石家庄、常州、泉州、南宁、贵阳、南昌、南通、金华、徐州、太原、嘉兴、烟台、惠州、保定、台州、中山、绍兴、乌鲁木齐、潍坊、兰州等，以及纽约、伦敦、东京、巴黎、悉尼等国际城市。

#### 2. 真实服务（在线模式）

使用 OpenStreetMap Nominatim API 进行真实的地理编码查询。

**切换方法**: 编辑 `src/app.js` 文件：

```javascript
// 使用模拟服务（当前配置）
const geocodingService = new MockGeocodingService();

// 切换为真实服务，取消下面一行的注释：
// const geocodingService = new GeocodingService();
```

### 天气 API 服务配置

应用支持两种天气 API 服务模式：

#### 1. 模拟服务（离线测试）- 默认启用

适用于无法访问 Windy API 或离线测试的场景。自动生成模拟的天气数据。

**当前配置**: 默认使用 `MockWindyAPIService`

**特点**:
- 不需要真实的 API 密钥（可以输入任意字符串）
- 不需要网络连接
- 生成168小时（7天）的模拟天气数据
- 模拟真实的天气变化规律（白天温度高、傍晚云量适中等）

#### 2. 真实服务（在线模式）

使用真实的 Windy Point Forecast API 获取天气数据。

**切换方法**: 编辑 `src/app.js` 文件：

```javascript
// 使用模拟服务（当前配置）
const weatherController = new WeatherController(storageService, savedAPIKey, true);

// 切换为真实服务，将 true 改为 false：
// const weatherController = new WeatherController(storageService, savedAPIKey, false);
```

**注意**: 使用真实服务需要：
1. 有效的 Windy API 密钥（从 https://api.windy.com/ 获取）
2. 网络可以访问 `api.windy.com`

## 测试策略

本项目采用双重测试方法：

### 单元测试
- 验证特定示例和边缘情况
- 测试错误处理
- 测试组件交互

### 基于属性的测试
- 使用fast-check验证通用属性
- 每个属性测试至少100次迭代
- 验证不变量和往返属性

## 浏览器支持

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## 许可证

MIT License

## 相关文档

- [需求文档](.kiro/specs/weather-sunset-predictor/requirements.md)
- [设计文档](.kiro/specs/weather-sunset-predictor/design.md)
- [任务列表](.kiro/specs/weather-sunset-predictor/tasks.md)
