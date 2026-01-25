# 配置文件使用说明

## 方式一：使用配置文件（推荐）

### 1. 创建配置文件

在项目根目录创建 `config.json` 文件：

```json
{
  "apiKey": "你的Windy API密钥",
  "useMockAPI": false
}
```

### 2. 参数说明

- **apiKey** (必填): 你的Windy API密钥
- **useMockAPI** (可选): 是否使用模拟数据进行离线测试
  - `false`: 使用真实的Windy API（需要有效API密钥）
  - `true`: 使用模拟API，不需要真实密钥

### 3. 优势

✅ API密钥持久化存储，不会被浏览器缓存清除影响
✅ 团队开发时可以共享配置文件（注意：不要提交真实密钥到Git）
✅ 方便离线测试（设置 `useMockAPI: true`）

### 4. 注意事项

⚠️ **重要**: `config.json` 已添加到 `.gitignore`，不会被提交到Git仓库
   - 不要将包含真实API密钥的config.json提交到版本控制系统
   - 团队开发时，每个开发者需要创建自己的config.json

---

## 方式二：浏览器本地存储

如果不想使用配置文件，也可以通过Web界面输入API密钥，系统会自动保存到浏览器localStorage。

**优点**: 无需额外文件
**缺点**:
- 清除浏览器缓存会丢失API密钥
- 不同浏览器/设备需要分别配置

---

## API密钥获取

1. 访问 [Windy官网](https://www.windy.com)
2. 注册账号
3. 在账号设置中获取API密钥

---

## 配置文件示例

### 生产环境（使用真实API）
```json
{
  "apiKey": "your-actual-windy-api-key",
  "useMockAPI": false
}
```

### 开发/测试环境（使用模拟数据）
```json
{
  "apiKey": "test-key",
  "useMockAPI": true
}
```

---

## 故障排除

### Q: 配置文件不生效？
A: 检查以下几点：
1. `config.json` 是否在项目根目录
2. 文件格式是否正确（有效的JSON格式）
3. 是否有浏览器缓存问题（尝试硬刷新：Ctrl+F5）

### Q: 仍然提示"API密钥未设置"？
A: 检查控制台日志（F12），查看是否有加载错误信息

### Q: 想切换回localStorage方式？
A: 删除或重命名 `config.json`，系统会自动使用localStorage
