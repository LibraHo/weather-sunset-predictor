# 离线模式使用说明

## 概述

由于你的网络环境无法访问外部 API（OpenStreetMap 和 Windy API），应用现在已配置为**完全离线模式**，使用模拟服务进行测试。

## 当前配置

### ✅ MockGeocodingService（地理编码）
- **状态**: 已启用
- **功能**: 将城市名称转换为坐标
- **数据**: 预置50+个中国和国际城市
- **网络**: 不需要

### ✅ MockWindyAPIService（天气数据）
- **状态**: 已启用
- **功能**: 生成模拟的天气数据
- **数据**: 168小时（7天）天气预测
- **网络**: 不需要

## 如何使用

### 1. 启动应用

```bash
python -m http.server 8000
```

访问 `http://localhost:8000`

### 2. 配置 API 密钥

首次打开会显示 API 密钥配置界面。

**重要**: 在离线模式下，你可以输入**任意字符串**作为 API 密钥，例如：
- `test-api-key`
- `mock-key-123`
- `offline-mode`

模拟服务不会验证密钥的真实性。

### 3. 搜索城市

在位置输入框中输入城市名称，例如：
- 北京
- 上海
- 广州
- 深圳
- 成都

点击"搜索"按钮。

### 4. 查看结果

应用会显示：
- ✅ 当前天气数据（温度、湿度、云量、风速、气压、能见度）
- ⏳ 晚霞预测（需要完善 PredictionController 的显示逻辑）

## 模拟数据特点

### 天气数据规律

MockWindyAPIService 生成的数据遵循真实的天气规律：

1. **温度变化**
   - 白天（6:00-18:00）: 较高，约 20-28°C
   - 夜间（18:00-6:00）: 较低，约 8-16°C

2. **湿度变化**
   - 早晚: 较高，60-80%
   - 中午: 较低，40-60%

3. **云量变化**
   - 傍晚（16:00-19:00）: 40-70%（适合晚霞）
   - 其他时间: 随机 0-100%

4. **其他参数**
   - 低层云: 0-40%
   - 风速: 白天 10-25 km/h，夜间 5-15 km/h
   - 气压: 1000-1025 hPa
   - 能见度: 5-25 km

## 测试场景

### 支持的城市列表

中国主要城市（部分）：
- 北京、上海、广州、深圳
- 成都、杭州、西安、南京
- 武汉、重庆、天津、苏州
- 长沙、郑州、东莞、青岛
- 沈阳、宁波、昆明、大连
- 厦门、合肥、佛山、福州
- 哈尔滨、济南、温州、长春
- 石家庄、常州、泉州、南宁
- 贵阳、南昌、南通、金华
- 徐州、太原、嘉兴、烟台
- 惠州、保定、台州、中山
- 绍兴、乌鲁木齐、潍坊、兰州

国际城市：
- New York, London, Tokyo
- Paris, Sydney, Berlin
- Toronto, Singapore, Dubai
- Mumbai, Seoul, Bangkok

### 测试步骤

1. **基本功能测试**
   ```
   输入: 北京
   预期: 显示北京的模拟天气数据
   ```

2. **多城市测试**
   ```
   输入: 上海
   预期: 显示上海的模拟天气数据
   
   输入: 广州
   预期: 显示广州的模拟天气数据
   ```

3. **数据刷新测试**
   ```
   点击"刷新数据"按钮
   预期: 重新生成天气数据（会有轻微变化）
   ```

4. **无效城市测试**
   ```
   输入: 不存在的城市
   预期: 显示错误消息"未找到该位置"
   ```

## 调试信息

打开浏览器开发者工具（F12），查看控制台日志：

```
[MockGeocodingService] 初始化完成，共 50 个城市
[MockWindyAPIService] 使用模拟 Windy API 服务（离线模式）
[MockWindyAPIService] 生成模拟天气数据: lat=39.9042, lon=116.4074
[WeatherController] 天气显示已更新
```

## 切换到在线模式

如果你的网络环境改善，可以访问外部 API，可以切换到在线模式：

### 1. 切换地理编码服务

编辑 `src/app.js`:
```javascript
// const geocodingService = new MockGeocodingService();
const geocodingService = new GeocodingService();
```

### 2. 切换天气 API 服务

编辑 `src/app.js`:
```javascript
// const weatherController = new WeatherController(storageService, savedAPIKey, true);
const weatherController = new WeatherController(storageService, savedAPIKey, false);
```

### 3. 获取真实 API 密钥

访问 https://api.windy.com/ 注册并获取真实的 API 密钥。

## 已知限制

### 离线模式限制

1. **数据不是真实的**: 所有天气数据都是模拟生成的
2. **城市列表有限**: 只支持预置的50+个城市
3. **无法验证 API 密钥**: 接受任意字符串作为密钥

### 待完善功能

1. **晚霞预测显示**: PredictionController 的 UI 更新逻辑需要完善
2. **未来3天预测**: 时间线显示功能需要实现
3. **预测详情**: 详情展开功能需要实现

## 下一步

即使在离线模式下，你也可以：
1. ✅ 测试位置搜索功能
2. ✅ 查看天气数据显示
3. ✅ 测试数据刷新功能
4. ✅ 测试错误处理
5. ⏳ 完善晚霞预测显示（需要更新 PredictionController）

完全离线模式让你可以在没有网络的情况下开发和测试整个应用！
