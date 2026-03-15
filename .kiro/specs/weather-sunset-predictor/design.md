# 设计文档

## 概述

天气晚霞预测器是一个全栈Web应用程序，由前端、后端API服务器和Python数据处理服务组成。应用主要通过 **Open-Meteo API**（免费，无需密钥）获取气象数据，运用气象学原理分析火烧云（晚霞）出现的可能性，并生成可视化的地图覆盖层。

> ⚠️ **架构变更说明（2026-03）**：数据源已从 Windy API 迁移至 Open-Meteo 作为主力 provider。Windy 保留为 emergency fallback（默认关闭）。所有涉及 Windy 的代码和测试详见 `.kiro/windy-index.md`。

核心设计理念：
- **前后端分离架构**：前端负责UI展示和用户交互，后端处理API代理和复杂数据计算
- **混合技术栈**：前端使用原生JavaScript，后端使用Node.js + Python混合架构
- **模块化设计**：服务层、控制层、数据层职责清晰，便于维护和测试
- **渐进增强**：从基础功能到高级地图覆盖层，分阶段实现

## 架构

### 完整系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        浏览器环境（前端）                      │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                   UI层（View）                        │   │
│  │  - 位置输入组件（搜索历史、收藏位置）                    │   │
│  │  - 天气显示组件（7天概览、24小时图表）                 │   │
│  │  - 晚霞预测组件（朝霞/晚霞独立预测）                    │   │
│  │  - 地图预测组件（Windy Map集成 + 火烧云覆盖层）        │   │
│  │  - 设置面板（API模式、单位、主题、语言）                  │   │
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
│  │  - WindyAPIService: Windy API调用服务                 │   │
│  │  - GeocodingService: 地理编码服务                     │   │
│  │  - StorageService: 本地存储服务                       │   │
│  │  - SunsetPredictionService: 晚霞预测算法              │   │
│  │  - ChartService: 数据可视化服务                        │   │
│  │  - NotificationService: 浏览器通知服务                   │   │
│  │  - FireCloudOverlayService: 地图覆盖层服务（新增）      │   │
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
                        │ HTTPS / API
                        ▼
            ┌─────────────────────────────────────┐
            │      后端API服务器（Node.js）         │
            │  ┌──────────────────────────────┐   │
            │  │  Express服务器              │   │
            │  │  - CORS中间件                │   │
            │  │  - 日志记录（morgan）         │   │
             │  │  - 错误处理                  │   │
             │  └───────────┬────────────────┘   │
            │              │                        │
            │  ┌───────────▼────────────┐          │
            │  │ API路由层                │          │
            │  │ - /api/weather/*          │          │
            │  │ - /api/firecloud/*       │          │
             │  │ - /api/config/*           │          │
            │  └───────────┬────────────┘          │
            │              │                        │
            │  ┌───────────▼────────────┐          │
            │  │ Windy API代理             │          │
            │  │ - 转发请求到Windy API     │          │
            │  │ - 隐藏API密钥            │          │
             │  └───────────┬────────────┘          │
            │              │                        │
            │  ┌───────────▼────────────┐          │
            │  │ Python脚本调用            │          │
            │  │ - child_process.spawn()   │          │
            │  │ - 调用gfs_processor.py  │          │
            │  └───────────┬────────────┘          │
            └──────────────┼────────────────────────┘
                           │
                           ▼
            ┌─────────────────────────────────────┐
            │  Python数据处理服务              │
            │  ┌──────────────────────────┐      │
            │  │ GFS数据处理器           │      │
            │  │ - 下载NOAA GFS GRIB2   │      │
            │  │ - 解析气象变量           │      │
            │  │ - 计算火烧云概率       │      │
            │  │ - 生成PNG覆盖层          │      │
            │  └──────────────────────────┘      │
            └─────────────────────────────────────┘
                           │
                           │
    ┌────────────────────────┴────────────────────────┐
    │                外部API服务                        │
    │  ┌──────────────────────────────────────┐      │
    │  │ Windy API Service                  │      │
    │  │  - Point Forecast API               │      │
    │  │  - Map Forecast API                 │      │
    │  └──────────────────────────────────────┘      │
    │  ┌──────────────────────────────────────┐      │
    │  │ NOAA GFS Data Service              │      │
    │  │  - 公开GRIB2数据                │      │
    │  │  - 0.25°分辨率                 │      │
    │  └──────────────────────────────────────┘      │
    └────────────────────────────────────────┘
```

### 架构层级说明

#### 1. 前端层（浏览器环境）
**职责**：UI展示、用户交互、数据可视化

**组件**：
- **View层**：HTML组件、CSS样式、响应式布局
- **Controller层**：业务逻辑、事件处理、状态管理
- **Service层**：API调用、数据处理、本地存储
- **Model层**：数据模型、验证逻辑

#### 2. 后端API层（Node.js Express）
**职责**：API代理、密钥保护、请求路由

**组件**：
- **Express服务器**：HTTP服务器、中间件、路由
- **API路由**：/api/weather、/api/firecloud、/api/config
- **代理服务**：转发请求到Windy API，隐藏API密钥
- **Python集成**：调用Python脚本处理GFS数据

#### 3. 数据处理层（Python）
**职责**：气象数据解析、复杂算法计算

**组件**：
- **GFS处理器**：下载、解析GRIB2数据
- **算法实现**：光路追踪+云量评分算法
- **图像生成**：PNG覆盖层生成

### 数据流图

```
用户操作流程：
┌─────────────┐
│ 用户搜索位置 │
└──────┬──────┘
       ▼
┌─────────────────────┐
│ 前端请求天气数据      │
│ (fetch /api/weather)  │
└──────┬──────────────┘
       ▼
┌─────────────────────┐
│ Node.js后端服务器     │
│                     │
│ ┌─────────────────┐ │
│ │ API代理模式      │ │
│ │ ↓                │ │
│ │ Windy API        │ │
│ │ (隐藏API Key)    │ │
│ └─────────────────┘ │
│                     │
│ ┌─────────────────┐ │
│ │ Python脚本调用    │ │
│ │ (需要覆盖层时)   │ │
│ │ ↓                │ │ │
│ │ GFS数据处理器   │ │ │
│ └─────────────────┘ │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 返回数据到前端        │
│ - JSON天气数据       │
│ - Base64 PNG图像     │
└─────────────────────┘
           │
           ▼
┌─────────────────────┐
│ 前端渲染显示        │
│ - 天气图表          │
│ - 预测卡片          │
│ - 地图覆盖层        │
└─────────────────────┘
```

### 技术栈（摘要）

**前端**：
- JavaScript ES6+、HTML5、CSS3
- Fetch API、LocalStorage API、Geolocation API、Notification API
- Chart.js或Canvas（数据可视化）
- Windy Map API（地图集成）

**后端（Node.js）**：
- Express 4.x（Web框架）
- cors（跨域支持）
- morgan（日志记录）
- dotenv（环境变量）
- axios（HTTP客户端，可选）

**数据处理（Python）**：
- xarray（多维数据数组）
- cfgrib（GRIB2解析）
- numpy（数值计算）
- Pillow（图像生成）
- requests（HTTP客户端）

### 技术栈（详细）

**前端**：
- **框架**: 原生JavaScript (ES6+)，无构建工具依赖
- **样式**: CSS3 with Flexbox/Grid，响应式设计
- **HTTP客户端**: Fetch API
- **存储**: LocalStorage API
- **地理位置**: Geolocation API
- **通知**: Notification API（需求12）
- **图表**: Chart.js 或原生Canvas（需求11）
- **天文计算**: SunCalc.js（需求12）
- **地图集成**: Windy Map Forecast API（需求18）
- **地图覆盖层**: Leaflet + 自定义PNG图层（需求20）

**后端（Node.js）**：
- **框架**: Express 4.x
- **中间件**:
  - cors：跨域资源共享
  - morgan：HTTP请求日志
  - dotenv：环境变量管理
- **路由**: RESTful API设计
- **进程管理**: child_process（调用Python脚本）
- **端口**: 3001（避免与前端冲突）

**数据处理（Python）**：
- **气象数据**: xarray（多维数组）、cfgrib（GRIB2解析）
- **数值计算**: numpy（矢量化运算）
- **图像生成**: Pillow（PNG RGBA）
- **HTTP客户端**: requests（下载数据）
- **数据源**: NOAA GFS 0.25° GRIB2文件

**外部API服务**：
- Windy API：Point Forecast API、Map Forecast API
- NOAA GFS：公开GRIB2数据（https://nomads.ncep.noaa.gov）

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

### 需求15：后端代理 Windy API 与密钥保护

**设计决策理由**：

1. **前后端分离架构**：采用后端代理模式，前端不再直接访问 Windy API，所有请求通过后端统一转发。这样可以将 API 密钥安全地保存在服务器端，避免在前端代码或网络请求中暴露。

2. **环境变量管理密钥**：后端从环境变量（如 `WINDY_API_KEY`）读取密钥，不将密钥写入代码或配置文件中。这样在代码仓库中完全不存在密钥信息，降低泄露风险。

3. **后端接口设计**：
   - 提供 RESTful 接口 `/api/weather/forecast`，接受经纬度、小时数等参数
   - 后端验证参数后，调用 Windy API 获取数据
   - 将 Windy 返回的原始数据解析为系统所需的 WeatherData 格式
   - 添加统一的错误处理和日志记录

4. **错误处理增强**：后端对 Windy API 的各种错误（网络错误、超时、配额限制、无效坐标）进行分类处理，返回明确的错误状态码和消息，前端根据这些信息展示用户友好的提示。

5. **访问日志记录**：后端记录每次请求的关键信息（时间、坐标、响应状态），便于监控和排查问题，但绝不记录敏感的 API 密钥。

6. **与现有架构兼容**：前端 `WindyAPIService` 类只需修改 API 端点从 Windy 官方 URL 改为后端 URL，其他逻辑保持不变。这样可以在需要时轻松切换代理模式和直连模式（用于开发测试）。

7. **安全性考虑**：
   - 后端实施请求频率限制，防止 API 被滥用
   - 使用 HTTPS 确保传输安全
   - 定期轮换 API 密钥（运维层面）

### 需求16：统一设置面板

**设计决策理由**：

1. **模态框设计**：使用模态框（Modal）展示设置面板，确保用户专注配置，同时不离开当前页面。支持点击遮罩或关闭按钮退出。

2. **分组布局**：将设置项按功能分组（数据源与网络、通知与提醒、语言与显示、个性化等），使用折叠面板或标签页组织，避免界面过于冗长。

3. **即时生效**：设置修改后立即保存到 LocalStorage 并生效，无需额外的"保存"按钮。对于可能影响数据的设置（如语言切换），刷新界面以应用更改。

4. **响应式设计**：
   - 桌面端：居中模态框，宽度 600-800px
   - 移动端：全屏面板，底部提供关闭按钮
   - 确保所有交互元素在触摸屏上易于操作

5. **复用现有组件**：
   - 通知设置：复用现有的通知设置组件
   - 语言选择器：复用现有的语言选择器
   - 减少重复代码，保持一致性

6. **多语言支持**：设置面板的所有文案都通过 i18n 系统翻译，确保在所有支持语言下都能正确显示。

7. **可扩展性**：采用模块化设计，新增设置项时只需添加对应的设置组件和存储逻辑，不影响其他设置项。

### 需求17：个性化设置（单位、主题、默认位置）

**设计决策理由**：

1. **单位转换系统**：
   - 创建 `UnitConverter` 工具类，提供温度（℃/℉）、风速（m/s/km/h）等单位的转换方法
   - 在数据渲染层应用单位转换，而不是在数据源层转换，确保原始数据不变
   - 用户选择的单位保存在 LocalStorage，初始化时加载

2. **主题系统架构**：
   - 使用 CSS 变量（Custom Properties）定义颜色系统（背景、文字、边框等）
   - 提供三套主题变量：`--light-theme`、`--dark-theme`、`--auto-theme`
   - 通过切换 `data-theme` 属性应用不同主题
   - "自适应系统"主题使用 `@media (prefers-color-scheme: dark)` 查询

3. **主题切换流程**：
   - 用户选择主题 → 保存到 LocalStorage → 立即应用 CSS 类
   - "自适应系统"：监听系统主题变化事件，实时更新

4. **默认位置管理**：
   - 扩展 `StorageService`，添加 `saveDefaultLocation` 和 `getDefaultLocation` 方法
   - 在设置面板中显示已查询位置列表，用户可选择其中一个作为默认
   - 应用启动时检查默认位置，如果存在则自动加载该位置的天气

5. **数据持久化**：
   - 所有个性化设置（单位、主题、默认位置）保存在同一个 LocalStorage 对象中
   - 使用 `user_preferences` 键，结构如下：
     ```json
     {
       "temperatureUnit": "celsius",
       "windSpeedUnit": "kmh",
       "theme": "auto",
       "defaultLocation": {
         "name": "北京",
         "lat": 39.9042,
         "lon": 116.4074
       }
     }
     ```

6. **实时更新机制**：
   - 单位切换：遍历当前显示的数据，使用 `UnitConverter` 转换后重新渲染
   - 主题切换：切换 CSS 类，无需重新渲染数据
   - 默认位置：下次启动时生效

### 需求18：集成 Windy Map Forecast 地图预测 API

**设计决策理由**：

1. **独立的地图视图**：在应用中新增"地图预测"标签页或独立区域，避免与其他视图（天气、预测）冲突。用户可以切换查看地图或列表数据。

2. **基于 Leaflet 的集成**：
   - Windy Map Forecast API 基于 Leaflet 地图库
   - 创建 `WindyMapService` 服务类，封装地图初始化、配置、交互逻辑
   - 使用官方提供的 `WindyAPI` 对象初始化地图

3. **位置联动**：
   - 当用户选择查询位置时，地图自动平移到该位置
   - 使用 `map.setView([lat, lon], zoom)` 方法定位
   - 在地图上添加标记显示用户位置

4. **图层控制**：
   - 提供图层切换按钮（风场、云量、降水、温度等）
   - 使用 Windy API 的 `store` 和 `overlays` 接口控制显示图层
   - 确保使用的图层是官方文档支持的稳定接口

5. **时间控制**：
   - 如果 Windy API 提供，集成时间轴控件
   - 允许用户查看未来一段时间（如未来24小时）的天气演变
   - 时间变化时，地图图层自动更新

6. **环境区分**：
   - 开发环境：使用 Testing 版本的 API 密钥
   - 生产环境：使用 Professional 版本的 API 密钥
   - 通过环境变量或配置文件区分，避免误用

7. **密钥管理**：
   - 与后端代理策略保持一致（需求15）
   - 如果需要在前端使用 Map Forecast API（某些功能可能需要），则通过后端代理初始化
   - 遵循 Windy 官方关于密钥使用的最佳实践

8. **错误处理**：
   - 地图加载失败时显示友好的错误提示
   - 提供重试按钮
   - 确保其他核心功能不受地图加载失败影响

9. **性能优化**：
   - 地图使用懒加载，仅在用户切换到地图标签时初始化
   - 离开地图标签时暂停渲染，减少资源消耗
   - 使用 CDN 加载 Leaflet 和 Windy API 库

### 需求19：周边火烧云可视化

**设计决策理由**：

1. **雷达图（Radar Chart）展示**：使用极坐标雷达图展示8个方位的火烧云评分，直观呈现周边区域的预测分布，帮助用户快速识别最佳观赏方向。

2. **8方位采样策略**：在北、东北、东、东南、南、西南、西、西北8个方位进行气象数据采样，每个方位距离用户位置50-100公里。这种策略平衡了数据精度和API调用成本。

3. **采样半径可配置**：允许用户自定义采样半径（50/100/150公里），适应不同场景需求（城市内、郊区、跨区域）。

4. **颜色编码映射**：使用渐变颜色表示评分强度（绿色=优秀，黄色=良好，灰色=一般），与现有预测系统的颜色编码保持一致。

5. **交互式体验**：支持点击方位查看详细信息、触摸旋转/缩放（移动端），提升用户体验。

6. **降级UI方案**：当雷达图渲染失败时（如Canvas不支持），显示方位列表或表格作为降级方案，确保功能可用性。

7. **周边气象数据获取**：通过计算8个方位的坐标点，分别调用Windy API获取气象数据，然后应用相同的预测算法计算评分。

8. **观赏方向建议**：基于周边评分分布，自动生成文本建议（如"建议向东南方向观赏"），降低用户决策成本。

9. **API调用优化**：批量请求8个方位的气象数据，使用Promise.all并行请求，减少等待时间。考虑缓存周边数据（30分钟有效期）。

10. **距离信息标注**：在雷达图上标注每个采样点的距离，帮助用户理解实际地理位置。

### 需求20：火烧云地图覆盖层

**设计决策理由**：

1. **后端Python服务处理GFS数据**：GFS气象数据以GRIB2格式提供，需要专业的气象数据处理库。使用Python的xarray、cfgrib库可以高效读取和处理GRIB2数据。直接通过HTTP请求NOAA服务器获取最新数据。

2. **"光路追踪+云量评分"算法实现**：
   - 对每个网格点，向西（日落方向）检查邻近像素的低层云量(LCDC)
   - 如果光路上有大量低云阻隔，则降低该点的火烧云概率
   - 结合本地中高云量(MCDC/HCDC)计算最终概率
   - 使用NumPy矢量化运算提高性能

3. **PNG覆盖层生成**：
   - 使用Pillow库生成RGBA图像
   - 根据概率值设置像素颜色和透明度
   - 记录图像的地理边界(Bounds)用于地图贴图

4. **Node.js + Python混合架构**：
   - Node.js Express作为主服务器，处理HTTP请求
   - Python脚本作为子进程处理GRIB2数据
   - 通过stdout传递JSON元数据，临时文件传递PNG
   - 避免管理独立Python服务的复杂性

5. **缓存策略**：
   - 后端缓存生成的PNG覆盖层（30分钟有效期）
   - 前端缓存覆盖层URL，减少重复请求
   - 使用区域+时间作为缓存键

6. **性能优化**：
   - 仅在用户启用覆盖层时才获取GFS数据
   - 使用分块处理策略，避免一次性处理大量数据
   - 支持渐进式加载，先显示低分辨率再更新高分辨率

7. **降级方案**：
   - 当GFS数据获取失败时，回退到雷达图模式（需求19）
   - 当PNG生成失败时，显示错误提示
   - 提供覆盖层开关，允许用户禁用此功能

**实现架构（2026-02-02完成）**：
```
后端 (Node.js + Python):
  ┌─────────────────────────────────────────────────────┐
  │  Express服务器 (server/index.js)                       │
  │  - 注册 /api/firecloud 路由                            │
  │  - 处理CORS、日志、错误                                │
  └─────────────────┬───────────────────────────────────┘
                    │
  ┌─────────────────▼───────────────────────────────────┐
  │  FireCloud API路由 (server/routes/firecloud.js)      │
  │  - GET /api/firecloud/overlay 端点                     │
  │  - 参数验证（lat, lon, radius, type）                  │
  │  - 调用Python脚本处理数据                              │
  └─────────────────┬───────────────────────────────────┘
                    │
  ┌─────────────────▼───────────────────────────────────┐
  │  Python GFS处理器 (server/scripts/gfs_processor.py)  │
  │  - 下载NOAA GFS GRIB2数据                             │
  │  - 解析GRIB2 (xarray + cfgrib)                         │
  │  - 计算火烧云概率（光路追踪算法）                    │
  │  - 生成RGBA PNG覆盖层 (Pillow)                       │
  │  - 输出JSON元数据到stdout                              │
  └─────────────────────────────────────────────────────┘

数据流:
  1. 前端请求 → Node.js Express
  2. Node.js → spawn('python', ['gfs_processor.py', args])
   3. Python → stdout (JSON metadata) + 临时PNG文件
  4. Node.js → 读取PNG → base64编码 → 返回前端
  5. 前端 → 在Windy地图上叠加图像
```

**⚠️ 关键架构缺陷（2026-02-03发现）**：

当前地图覆盖层实现存在**根本性架构缺陷**，导致功能**不可用**。

**问题根因**：
1. **WindyMapService** 使用 `<iframe>` 嵌入方式加载地图（`https://embed.windy.com/`）
2. **FireCloudOverlayService** 在主页面DOM中创建覆盖层Canvas元素
3. 由于**跨域iframe隔离**，主页面无法访问或操作iframe内部内容
4. 当用户拖动地图时，iframe内容移动，但覆盖层（在主页面DOM中）保持固定

**技术细节**：
```javascript
// WindyMapService.js - 创建跨域iframe
this.iframe = document.createElement('iframe');
this.iframe.src = `https://embed.windy.com/?${lat},${lon},${zoom}`;
this.container.appendChild(this.iframe);
// ↑ iframe创建跨域隔离环境，主页面无法访问内部

// FireCloudOverlayService.js - 在主页面DOM创建覆盖层
displayOnMap(mapService, overlayData, container) {
  const overlayDiv = document.createElement('div');
  overlayDiv.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    z-index: 1000;
  `;
  container.appendChild(overlayDiv);  // ↑ 添加到主页面，不在iframe内！
}
```

**后果**：
- 地图拖动时覆盖层不跟随，完全错位
- 缩放地图时覆盖层位置错误
- 功能完全不可用

**解决方案（需要完全重构）**：

1. **方案A：使用Windy API + Leaflet**（推荐）
   - 放弃iframe嵌入方式
   - 直接使用Windy Leaflet插件API
   - 需要：Professional API许可证
   - 优点：完整地图控制，可自定义图层
   - 缺点：需要付费API许可证

2. **方案B：切换到开源地图方案**
   - 使用Leaflet + OpenStreetMap
   - 叠加自定义火烧云热力图层
   - 优点：完全可控，免费
   - 缺点：失去Windy的专业气象图层

3. **方案C：暂时移除此功能**
   - 隐藏覆盖层开关UI
   - 保留雷达图可视化（需求19）
   - 等待确定地图方案后再实现

**当前状态**：
- ✅ 后端GFS处理服务已完成
- ✅ 前端覆盖层生成服务已完成
- ❌ 地图集成存在架构缺陷，功能不可用
- ⏸️ **需要重新设计地图集成方案**

**Python GFS处理器实现细节**：

```python
# server/scripts/gfs_processor.py

class GFSDataProcessor:
    # NOAA GFS数据源
    GFS_BASE_URL = "https://nomads.ncep.noaa.gov/pub/data/nccf/com/gfs/prod"

    # 需要下载的气象变量
    VARIABLES = ['TCDC', 'LCDC', 'MCDC', 'HCDC']

    def download_gfs_data():
        """下载GFS GRIB2文件"""
        # 构造最新GFS运行URL
        url = f"{GFS_BASE_URL}/gfs.YYYYMMDD/HH/atmos/gfs.tHHz.pgrb2.0p25.f000"
        # 使用requests库下载（流式传输）
        # 保存到临时文件（/tmp/gfs_XXXXXX.grib2）

    def parse_grib2(grib2_file):
        """解析GRIB2文件"""
        # 使用cfgrib引擎打开
        ds = xr.open_dataset(grib2_file, engine='cfgrib')
        # 提取变量：TCDC, LCDC, MCDC, HCDC
        return ds

    def calculate_firecloud_probability(ds):
        """计算火烧云概率（光路追踪算法）"""
        lcdc = ds['LCDC'].values  # 低云量
        mcdc = ds['MCDC'].values  # 中云量
        hcdc = ds['HCDC'].values  # 高云量

        # 对每个网格点，向西检查10个网格点（约250km）
        # 计算光路上的低云阻挡
        # 结合本地中高云量计算概率
        return probability_matrix  # 0-1范围

    def generate_overlay_png(probability_matrix):
        """生成RGBA PNG覆盖层"""
        # 归一化到0-255
        # 应用颜色映射：
        #   0-0.3: 灰色渐变
        #   0.3-0.7: 黄色渐变
        #   0.7-1.0: 红橙色渐变
        # Alpha通道根据概率调整
        img = Image.fromarray(img_array, mode='RGBA')
        img.save(temp_file.name, 'PNG')
        return temp_file.name
```

**Node.js API集成实现**：

```javascript
// server/routes/firecloud.js

router.get('/overlay', async (req, res) => {
  const { lat, lon, radius = 200, type = 'sunset' } = req.query;

  // 参数验证
  // ...

  // 调用Python脚本
  const pythonProcess = spawn('python', [
    'scripts/gfs_processor.py',
    '--lat', lat.toString(),
    '--lon', lon.toString(),
    '--radius', radius.toString(),
    '--type', type
  ]);

  // 捕获stdout（JSON格式元数据）
  let stdout = '';
  pythonProcess.stdout.on('data', (data) => {
    stdout += data.toString();
  });

  pythonProcess.on('close', async (code) => {
    // 解析元数据
    const metadata = JSON.parse(stdout);

    // 读取PNG文件
    const imageBuffer = await fs.readFile(metadata.image_path);

    // 转换为base64
    const imageBase64 = imageBuffer.toString('base64');

    // 清理临时文件
    await fs.unlink(metadata.image_path);

    // 返回结果
    res.json({
      image: `data:image/png;base64,${imageBase64}`,
      bounds: metadata.bounds,
      timestamp: metadata.timestamp
    });
  });
});
```

**技术栈**：
- Python 3.x: xarray, cfgrib, numpy, Pillow, requests
- Node.js: child_process, fs, express
- 数据源: NOAA GFS 0.25° GRIB2文件

**降级方案**：
- GFS数据获取失败 → 回退到雷达图模式（需求19）
- PNG生成失败 → 显示错误提示，禁用覆盖层开关
- Python脚本超时 → 60秒后终止进程
  │  - PNG覆盖层生成                                      │
  └─────────────────┬───────────────────────────────────┘
                    │
  ┌─────────────────▼───────────────────────────────────┐
  │  API端点: GET /api/firecloud/overlay                │
  │  - 参数: lat, lon, radius, type (sunrise/sunset)    │
  │  - 返回: PNG图像 + Bounds信息                        │
  └─────────────────────────────────────────────────────┘

前端 (JavaScript):
  ┌─────────────────────────────────────────────────────┐
  │  FireCloudOverlayService                            │
  │  - 调用后端API获取覆盖层PNG                           │
  │  - 在Windy地图上叠加图像                              │
  │  - 监听地图事件动态更新                               │
  └─────────────────────────────────────────────────────┘
```

**新增服务类**：
- **GFSDataService** (后端): 获取GFS GRIB2数据
- **HeatmapProcessor** (后端): 处理数据并生成PNG覆盖层
- **FireCloudOverlayService** (前端): 管理地图覆盖层显示


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
  constructor(date, score, quality, factors, sunsetTime, sunriseTime, type, goldenHour, blueHour, sunAzimuth, sunsetDirection, cloudLayers) {
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
    this.sunsetDirection = sunsetDirection; // 日落方向（方位文本，例如“西偏北”）
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
- 太阳方位角与日落方向，帮助用户确定最佳拍摄方向
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
    // 需求12：显示日出/日落时间、黄金/蓝调时段、最佳观赏时间、日落方向、太阳方位角、云层分层
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

**设计决策**：扩展PredictionController以支持需求12的朝霞晚霞预测增强功能。生成独立的朝霞和晚霞预测，显示专业时间信息（黄金/蓝调时段、最佳观赏时间、日落方向）、太阳方位角、云层分层。集成NotificationService实现通知提醒。

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

---

## 测试增强设计决策

### 测试级别策略：核心路径完整测试

**设计决策理由**：

1. **聚焦核心用户场景**：测试覆盖主要用户流程（天气查询、预测生成、错误恢复），确保80%的用户使用场景正常工作，而非追求100%覆盖率。

2. **边缘情况有选择地测试**：测试关键边缘情况（极端天气值、API错误），跳过极度罕见的场景，平衡测试深度和开发时间。

3. **集成测试优于单元测试**：E2E测试验证组件间协作，发现集成问题，这是单元测试无法覆盖的。

4. **属性测试作为补充**：使用fast-check验证通用属性（如单调性、往返一致性），而不是手动编写大量测试用例。

### 单元测试增强

#### UT-1: WeatherData边缘测试
```javascript
tests/unit/models/WeatherData.test.js

测试场景：
- 极端温度：-60°C, 60°C（验证边界处理）
- 边界湿度：0%, 100%（验证百分比限制）
- 云量分层不一致：totalClouds=50, lowClouds=60（验证数据一致性检查）
- 无效数据：null, undefined, 负数（验证ValidationError抛出）
- 缺失字段：部分参数为undefined（验证默认值处理）
```

**设计决策**：WeatherData是核心数据模型，边缘情况处理不当会导致预测算法错误。测试极端值确保验证逻辑健壮。

#### UT-2: 服务层增强测试
```javascript
tests/unit/services/StorageService.test.js
- localStorage不可用（Object.defineProperty(window.localStorage, ...)）
- 缓存过期边缘：Date.now() - 30分钟 ± 1秒
- 并发读写：模拟多个快速连续的存储操作

tests/unit/services/WindyAPIService.test.js
- HTTP 401：API Key无效（axios.post mock return {status: 401}）
- HTTP 429：请求限流（模拟retry-after header）
- HTTP 500：服务器错误（模拟网络中断）
- 超时：jest.useFakeTimers()模拟>10秒延迟
- 使用jest.mock('axios')控制响应
```

**设计决策**：服务层是应用与外部世界交互的边界，最容易失败。Mock HTTP响应确保错误处理逻辑正确。

#### UT-3: 控制器交互测试
```javascript
tests/integration/controller-interaction.test.js

测试场景：
- 数据流：AppController → WeatherController → PredictionController
  * 验证：位置变化 → 天气数据更新 → 预测重新计算
- 错误传播：WindyAPIService错误 → WeatherController → UI
  * 验证：错误消息正确显示，应用不崩溃
- 事件监听：位置切换时所有控制器响应
  * 验证：各控制器的loadData方法被调用
```

**设计决策**：控制器集成测试发现组件间通信问题，这是单元测试无法捕获的。

### E2E测试（Playwright）

#### IT-1: 天气查询流程
```javascript
tests/e2e/weather-query-flow.spec.js

测试步骤：
1. 打开应用（page.goto('http://localhost:3000')）
2. 输入"北京"（page.fill('#location-input', '北京')）
3. 点击搜索（page.click('#search-btn')）
4. 等待加载（page.waitForSelector('.weather-data'))
5. 验证温度显示（expect(locator('.temp')).toHaveText(/\d+°/))
6. 切换到预测标签（page.click('#prediction-tab'))
7. 验证预测卡片显示（expect(locator('.prediction-card')).toBeVisible())
```

#### IT-2: 预测生成流程
```javascript
tests/e2e/prediction-flow.spec.js

测试步骤：
1. Mock API返回固定天气数据（route mock）
2. 触发预测生成
3. 验证评分计算正确性
4. 验证黄金时段、蓝调时段显示
5. 验证UI渲染：评分颜色、质量等级
```

#### IT-3: 错误恢复流程
```javascript
tests/e2e/error-recovery-flow.spec.js

测试步骤：
1. Mock网络错误（route模拟失败）
2. 验证错误提示显示
3. 点击重试按钮
4. Mock成功响应
5. 验证数据正常加载
```

**设计决策**：E2E测试模拟真实用户操作，发现UI流程问题。使用Playwright的现代API和自动等待机制。

### 测试覆盖率目标
- **总体覆盖率**：≥80%（当前约60%，目标+20%）
- **关键路径覆盖率**：100%（预测算法、API调用、错误处理）
- **分支覆盖率**：≥75%

---

## GFS数据处理设计决策

### 架构选择：Node.js + Python混合

**设计决策理由**：

1. **利用现有基础设施**：项目已有完整的Node.js后端（Express、CORS、日志），无需重构。

2. **Python气象库成熟**：xarray、cfgrib是NOAA官方推荐的GRIB2处理工具，NumPy矢量化运算高效，Pillow生成PNG简单。

3. **实现成本低**：通过child_process.spawn调用Python脚本，不需要管理独立服务端口或跨服务通信。

4. **部署简单**：只需在服务器安装Python依赖，Node.js和Python在同一环境。

### 数据获取层设计

#### NOAA GFS数据源
```python
# server/scripts/gfs_processor.py

数据源：https://nomads.ncep.noaa.gov/pub/data/nccf/com/gfs/prod/
文件格式：gfs.tXXz.pgrb2.0p25.f000（XX为运行时刻，000为预报时刻）
变量列表：
- TCDC：总云量（Total Cloud Cover）
- LCDC：低层云量（Low Cloud Cover, <2km）
- MCDC：中层云量（Mid Cloud Cover, 2-6km）
- HCDC：高层云量（High Cloud Cover, >6km）

数据范围：
- 中心点：用户经纬度
- 半径：200-300公里（可配置）
- 分辨率：0.25°（约25km）
```

**设计决策**：使用NOAA公开数据源，免费稳定。0.25°分辨率平衡精度和性能。

#### 数据下载实现
```python
def download_gfs_data(lat, lon, radius_km):
    """下载GFS GRIB2文件"""
    # 1. 计算边界坐标（lat±Δ, lon±Δ）
    # 2. 构造下载URL（最新运行时刻）
    # 3. 使用requests库下载（流式传输，避免内存溢出）
    # 4. 保存到临时文件（/tmp/gfs_XXXXXX.grib2）
    # 5. 返回文件路径
```

### 数据处理层设计

#### GRIB2解析
```python
def parse_grib2(grib2_file):
    """解析GRIB2文件"""
    import xarray as xr
    # 使用cfgrib引擎打开GRIB2文件
    ds = xr.open_dataset(grib2_file, engine='cfgrib')
    # 提取变量：TCDC, LCDC, MCDC, HCDC
    # 返回：xarray.Dataset（多维数组）
```

**设计决策**：xarray + cfgrib是处理气象数据的标准工具，支持延迟加载和切片操作。

#### "光路追踪+云量评分"算法
```python
def calculate_firecloud_probability(dataset, lat, lon):
    """
    光路追踪算法实现
    对每个网格点，向西（日落方向）检查LCDC值
    """
    import numpy as np

    # 获取数据矩阵（lat×lon网格）
    lcdc = dataset['LCDC'].values  # 低云量
    mcdc = dataset['MCDC'].values  # 中云量
    hcdc = dataset['HCDC'].values  # 高云量

    # 初始化概率矩阵
    probability = np.zeros_like(lcdc)

    # 对每个像素点
    for i in range(lcdc.shape[0]):
        for j in range(lcdc.shape[1]):
            # 向西检查10个网格点（约250km）
            light_path = lcdc[i, max(0, j-10):j+1]
            blocking_clouds = np.mean(light_path > 50)

            # 计算本地云量评分
            local_cloud_score = (mcdc[i, j] + hcdc[i, j]) / 2

            # 综合评分
            if blocking_clouds < 0.3:
                # 光路通畅，本地云量决定评分
                probability[i, j] = local_cloud_score / 100
            else:
                # 光路被阻，评分降低
                probability[i, j] = local_cloud_score / 200

    return probability  # 0-1范围
```

**设计决策**：
- 向西检查250km（约10个0.25°网格点）
- 低云>50%视为阻挡
- 使用NumPy矢量化运算（实际实现时应避免双重循环）

#### 图像生成层
```python
def generate_overlay_png(probability_matrix, bounds):
    """
    生成RGBA PNG覆盖层
    """
    from PIL import Image
    import numpy as np

    # 归一化到0-255
    normalized = (probability_matrix * 255).astype(np.uint8)

    # 创建RGBA图像
    height, width = normalized.shape
    img_array = np.zeros((height, width, 4), dtype=np.uint8)

    # 应用颜色映射
    for i in range(height):
        for j in range(width):
            prob = probability_matrix[i, j]
            if prob < 0.3:
                # 灰色渐变
                img_array[i, j] = [128, 128, 128, int(prob * 255)]
            elif prob < 0.7:
                # 黄色渐变
                img_array[i, j] = [255, 255, 0, int(prob * 180)]
            else:
                # 红橙色渐变
                img_array[i, j] = [255, int((1-prob) * 165), 0, int(prob * 255)]

    # 生成PNG
    img = Image.fromarray(img_array, mode='RGBA')
    img.save('/tmp/firecloud_overlay.png')

    return {
        'image_path': '/tmp/firecloud_overlay.png',
        'bounds': bounds  # {north, south, east, west}
    }
```

**设计决策**：
- 颜色编码与现有系统一致（灰色=一般，黄色=良好，红橙色=优秀）
- Alpha通道根据概率调整（0%=透明，100%=不透明）
- 临时文件使用后清理

### Node.js集成层设计

#### Python脚本调用
```javascript
// server/routes/firecloud.js

import { spawn } from 'child_process';
import fs from 'fs/promises';

router.get('/overlay', async (req, res) => {
  const { lat, lon, radius = 200 } = req.query;

  // 参数验证
  if (!lat || !lon) {
    return res.status(400).json({ error: 'Missing lat or lon' });
  }

  try {
    // 调用Python脚本
    const pythonProcess = spawn('python', [
      'scripts/gfs_processor.py',
      '--lat', lat,
      '--lon', lon,
      '--radius', radius
    ]);

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    pythonProcess.on('close', async (code) => {
      if (code !== 0) {
        return res.status(500).json({ error: 'Python script failed', details: stderr });
      }

      // 解析输出（JSON格式的元数据）
      const metadata = JSON.parse(stdout);

      // 读取PNG文件
      const imageBuffer = await fs.readFile(metadata.image_path);

      // 转换为base64
      const imageBase64 = imageBuffer.toString('base64');

      // 清理临时文件
      await fs.unlink(metadata.image_path);

      // 返回结果
      res.json({
        image: `data:image/png;base64,${imageBase64}`,
        bounds: metadata.bounds,
        timestamp: metadata.timestamp
      });
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});
```

**设计决策**：
- 使用stdout传递JSON元数据（文件路径、bounds、timestamp）
- PNG文件通过临时文件传递（避免二进制数据在stdout中的编码问题）
- 自动清理临时文件
- 错误处理：Python脚本失败时返回详细错误信息

### 前端集成

#### 调用新API
```javascript
// src/services/FireCloudOverlayService.js

async fetchOverlay(lat, lon, radius = 200) {
  const response = await fetch(`/api/firecloud/overlay?lat=${lat}&lon=${lon}&radius=${radius}`);

  if (!response.ok) {
    throw new Error('Failed to fetch overlay');
  }

  const data = await response.json();

  // 在Windy地图上叠加图像
  this.addOverlayToMap(data.image, data.bounds);
}

addOverlayToMap(imageBase64, bounds) {
  const imageBounds = [
    [bounds.north, bounds.west],
    [bounds.south, bounds.east]
  ];

  const overlay = L.imageOverlay(imageBase64, imageBounds, {
    opacity: 0.7,
    interactive: false
  });

  overlay.addTo(this.map);
}
```

### 性能优化

1. **缓存策略**：
   - 后端缓存生成的PNG（30分钟有效期）
   - 前端缓存覆盖层URL（LocalStorage）

2. **分块处理**：
   - 大范围数据分块处理（每块100km×100km）
   - 避免一次性加载过多数据

3. **懒加载**：
   - 仅在用户启用覆盖层时才获取GFS数据
   - 地图移动时延迟更新（防抖处理）

### 错误处理

1. **降级方案**：
   - GFS数据获取失败 → 回退到雷达图模式（需求19）
   - PNG生成失败 → 显示错误提示，禁用覆盖层开关

2. **超时处理**：
   - Python脚本超时：60秒后终止进程
   - API请求超时：30秒后返回错误

3. **资源清理**：
   - 临时文件清理（即使脚本失败）
   - 进程管理（避免僵尸进程）

## 毛玻璃效果设计决策（需求21）

### 设计概述

采用 Glassmorphism（毛玻璃/磨砂玻璃）设计风格，为应用主要UI组件添加半透明背景 + 背景模糊 + 微妙边框的视觉效果，提升界面层次感和现代感。

### CSS变量体系

在现有CSS自定义属性系统中扩展毛玻璃相关变量：

```css
:root {
  /* 毛玻璃效果 - 明亮模式 */
  --glass-bg: rgba(255, 255, 255, 0.65);
  --glass-bg-heavy: rgba(255, 255, 255, 0.8);
  --glass-border: rgba(255, 255, 255, 0.3);
  --glass-blur: 12px;
  --glass-blur-heavy: 20px;
  --glass-shadow: 0 4px 30px rgba(0, 0, 0, 0.08);
}

body.theme-dark {
  /* 毛玻璃效果 - 暗色模式 */
  --glass-bg: rgba(30, 30, 30, 0.65);
  --glass-bg-heavy: rgba(30, 30, 30, 0.8);
  --glass-border: rgba(255, 255, 255, 0.08);
  --glass-blur: 12px;
  --glass-blur-heavy: 20px;
  --glass-shadow: 0 4px 30px rgba(0, 0, 0, 0.2);
}
```

### 设计决策理由

1. **CSS Variables 驱动**：所有毛玻璃参数通过CSS自定义属性定义，与现有主题系统（`data-theme`属性、`body.theme-dark`类）完全兼容。修改一处变量即可全局调整效果强度。

2. **分层效果策略**：
   - **重度毛玻璃**（`--glass-bg-heavy` + `--glass-blur-heavy`）：用于 header、footer 等固定定位元素，需要更强的可读性
   - **标准毛玻璃**（`--glass-bg` + `--glass-blur`）：用于 `.card`、`.prediction-card`、`.modal-content` 等内容卡片

3. **受影响的组件**：
   - `header` — 顶部导航栏（重度毛玻璃）
   - `footer` — 底部页脚（重度毛玻璃）
   - `.card` — 通用卡片组件（标准毛玻璃）
   - `.prediction-card` — 预测卡片（标准毛玻璃）
   - `.modal-content` — 模态框内容区域（重度毛玻璃）
   - `.settings-panel-content` — 设置面板（重度毛玻璃）

4. **优雅降级**：使用 `@supports (backdrop-filter: blur(1px))` 条件规则，仅在支持 `backdrop-filter` 的浏览器上启用毛玻璃效果。不支持时保持现有不透明背景，确保零功能损失。

5. **性能优化**：
   - 移动端使用 `@media (max-width: 768px)` 降低模糊强度（`blur(8px)` 代替 `blur(12px)`），减少GPU负担
   - 避免在频繁重绘的元素（图表Canvas、地图容器）上使用毛玻璃
   - 使用 `-webkit-backdrop-filter` 前缀确保Safari兼容

6. **可读性保障**：
   - 明亮模式下白色半透明背景（65%不透明度）+ 12px模糊确保文字对比度
   - 暗色模式下深色半透明背景（65%不透明度）确保浅色文字可读
   - 添加微妙的 `border: 1px solid var(--glass-border)` 增强边缘可辨识度

7. **悬停交互**：卡片悬停时轻微提升不透明度（如从65%→75%）并增强阴影，提供视觉反馈但不改变模糊半径（避免重绘开销）。

### 实现方式

核心CSS mixin模式（在 `styles/main.css` 中实现）：

```css
/* 标准毛玻璃效果 */
@supports (backdrop-filter: blur(1px)) {
  .card,
  .prediction-card {
    background: var(--glass-bg);
    backdrop-filter: blur(var(--glass-blur));
    -webkit-backdrop-filter: blur(var(--glass-blur));
    border: 1px solid var(--glass-border);
    box-shadow: var(--glass-shadow);
  }
}

/* 重度毛玻璃效果（固定元素） */
@supports (backdrop-filter: blur(1px)) {
  header,
  footer,
  .modal-content {
    background: var(--glass-bg-heavy);
    backdrop-filter: blur(var(--glass-blur-heavy));
    -webkit-backdrop-filter: blur(var(--glass-blur-heavy));
    border: 1px solid var(--glass-border);
    box-shadow: var(--glass-shadow);
  }
}
```

### 浏览器兼容性

| 浏览器 | `backdrop-filter` 支持 |
|--------|----------------------|
| Chrome 76+ | ✅ 原生支持 |
| Firefox 103+ | ✅ 原生支持 |
| Safari 9+ | ✅ 需要 `-webkit-` 前缀 |
| Edge 79+ | ✅ 原生支持 |
| IE | ❌ 优雅降级为不透明背景 |

## 前后端分离架构设计（需求22）

### 设计概述

当前架构存在以下问题：
- **核心预测算法在前端运行**：浏览器 CPU 浪费，难以优化
- **周边采样低效**：8 个并行 API 请求，网络延迟 8×RTT
- **无服务端缓存**：相同数据重复计算
- **前端代码臃肿**：9440+ 行，难以维护

目标架构：**前端负责 UI 渲染，后端负责业务计算**，支持多平台客户端复用同一套 API。

### 架构演进图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              当前架构                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         前端 (Browser)                               │   │
│  │  ┌─────────────────┐  ┌──────────────────┐  ┌────────────────────┐  │   │
│  │  │ WindyAPIService │  │SunsetPrediction  │  │ SurroundingPoints  │  │   │
│  │  │   (API 调用)     │  │   Service ⚠️     │  │   Service ⚠️       │  │   │
│  │  │                 │  │  (预测算法)       │  │  (8个并行请求)      │  │   │
│  │  └────────┬────────┘  └────────┬─────────┘  └─────────┬──────────┘  │   │
│  │           │                    │                      │             │   │
│  │           │         ┌──────────┴──────────────────────┘             │   │
│  │           ▼         ▼                                               │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │              Controllers (AppController, etc.)               │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼ 仅代理天气数据                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         后端 (Node.js)                               │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │  /api/weather/forecast (代理 Windy API)                      │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

                                    ▼▼▼ 重构后 ▼▼▼

┌─────────────────────────────────────────────────────────────────────────────┐
│                              目标架构                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    多平台客户端 (复用同一套 API)                      │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐   │   │
│  │  │   Web   │  │   iOS   │  │ Android │  │  小程序  │  │   CLI   │   │   │
│  │  │  (当前)  │  │ (未来)  │  │  (未来)  │  │  (未来)  │  │  (未来)  │   │   │
│  │  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘   │   │
│  │       │            │            │            │            │        │   │
│  │       └────────────┴────────────┼────────────┴────────────┘        │   │
│  │                                 │                                   │   │
│  │                     仅负责 UI 渲染和用户交互                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼ 统一 REST API                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         后端 (Node.js)                               │   │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │   │
│  │  │ /api/weather/*   │  │ /api/prediction/*│  │ /api/firecloud/* │  │   │
│  │  │  天气数据代理     │  │  预测算法服务     │  │  火烧云覆盖层     │  │   │
│  │  └──────────────────┘  └──────────────────┘  └──────────────────┘  │   │
│  │                                 │                                   │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │                    后端服务层                                 │   │   │
│  │  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐  │   │   │
│  │  │  │ PredictionSvc   │  │ SurroundingSvc  │  │  CacheSvc   │  │   │   │
│  │  │  │ (预测算法)       │  │ (周边聚合)       │  │  (缓存)      │  │   │   │
│  │  │  └─────────────────┘  └─────────────────┘  └─────────────┘  │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 新增后端 API 设计

#### 1. 预测计算 API

```
POST /api/prediction/calculate

Request Body:
{
  "weatherData": {
    "temp": 15.5,           // 摄氏度
    "humidity": 65,         // %
    "cloudCover": 45,       // %
    "visibility": 10,       // km
    "lowClouds": 20,        // %
    "midClouds": 30,        // %
    "highClouds": 15        // %
  },
  "date": "2026-02-03T00:00:00Z",
  "lat": 39.9042,
  "lon": 116.4074,
  "type": "sunset"          // "sunset" | "sunrise"
}

Response:
{
  "success": true,
  "data": {
    "date": "2026-02-03T00:00:00Z",
    "score": 75,
    "quality": "excellent",  // "excellent" | "good" | "fair"
    "factors": {
      "cloudCover": 85,
      "humidity": 70,
      "visibility": 80,
      "lowClouds": 65
    },
    "sunsetTime": "2026-02-03T17:30:00+08:00",
    "sunriseTime": "2026-02-03T07:15:00+08:00",
    "goldenHour": {
      "start": "2026-02-03T16:30:00+08:00",
      "end": "2026-02-03T17:30:00+08:00"
    },
    "blueHour": {
      "start": "2026-02-03T17:30:00+08:00",
      "end": "2026-02-03T18:00:00+08:00"
    },
    "sunAzimuth": 280,
    "cloudLayers": {
      "high": 15,
      "mid": 30,
      "low": 20,
      "description": "高层卷云为主，有利于火烧云形成"
    },
    "algorithmVersion": "1.0.0"
  }
}
```

#### 2. 周边聚合 API

```
POST /api/prediction/surrounding

Request Body:
{
  "centerLat": 39.9042,
  "centerLon": 116.4074,
  "radius": 100,            // km (50/100/150)
  "date": "2026-02-03T00:00:00Z",
  "type": "sunset"
}

Response:
{
  "success": true,
  "data": {
    "center": {
      "lat": 39.9042,
      "lon": 116.4074,
      "name": "北京"
    },
    "radius": 100,
    "timestamp": 1706918400000,
    "points": [
      {
        "direction": "N",
        "directionName": "北",
        "lat": 40.8042,
        "lon": 116.4074,
        "distance": 100,
        "prediction": {
          "score": 72,
          "quality": "excellent",
          "factors": { ... }
        }
      },
      {
        "direction": "NE",
        "directionName": "东北",
        "lat": 40.5413,
        "lon": 117.0445,
        "distance": 100,
        "prediction": { ... }
      },
      // ... 其他 6 个方向
    ],
    "bestDirection": {
      "direction": "NE",
      "score": 82,
      "recommendation": "东北方向火烧云观赏条件最佳"
    }
  }
}
```

#### 3. 增强预测 API

```
POST /api/prediction/enhanced

Request Body:
{
  "weatherData": { ... },
  "date": "2026-02-03T00:00:00Z",
  "lat": 39.9042,
  "lon": 116.4074,
  "type": "sunset",
  "options": {
    "includeCanvas": true,      // 画布评分
    "includeLightPath": true,   // 光路通透评分
    "nearPointRadius": 150,     // km
    "farPointRadius": 300       // km
  }
}

Response:
{
  "success": true,
  "data": {
    // ... 基础预测结果 ...
    "enhanced": {
      "canvas": {
        "score": 78,
        "cloudLevel": "moderate",
        "effectiveCloudCover": 42,
        "lowCloudPenalty": 0.85
      },
      "lightPath": {
        "nearScore": 75,
        "farScore": 80,
        "combinedScore": 78,
        "pathQuality": "good"
      },
      "renderModifier": {
        "humidityFactor": 1.05,
        "temperatureFactor": 0.98
      },
      "finalScore": 78,
      "optimalMoment": "日落前20分钟预计达到最佳观赏时刻",
      "sunsetDirection": "西偏北（约280°）",
      "confidence": 0.85
    }
  }
}
```

#### 4. 批量预测 API（用于时间线）

```
POST /api/prediction/batch

Request Body:
{
  "lat": 39.9042,
  "lon": 116.4074,
  "dates": [
    "2026-02-03",
    "2026-02-04",
    "2026-02-05",
    "2026-02-06",
    "2026-02-07",
    "2026-02-08",
    "2026-02-09"
  ],
  "type": "sunset"
}

Response:
{
  "success": true,
  "data": {
    "location": { "lat": 39.9042, "lon": 116.4074 },
    "predictions": [
      { "date": "2026-02-03", "score": 75, "quality": "excellent", ... },
      { "date": "2026-02-04", "score": 45, "quality": "good", ... },
      // ... 其他日期
    ],
    "bestDay": {
      "date": "2026-02-03",
      "score": 75,
      "recommendation": "2月3日是本周最佳观赏日"
    }
  }
}
```

### 后端服务架构

```
server/
├── index.js                    # Express 入口
├── routes/
│   ├── weather.js              # 天气数据代理 (已有)
│   ├── firecloud.js            # 火烧云覆盖层 (已有)
│   └── prediction.js           # 预测 API (新增) ⭐
├── services/
│   ├── windyService.js         # Windy API 服务 (已有)
│   ├── PredictionService.js    # 预测算法服务 (新增) ⭐
│   ├── SurroundingService.js   # 周边采样服务 (新增) ⭐
│   ├── EnhancedPrediction.js   # 增强预测服务 (新增) ⭐
│   └── CacheService.js         # 缓存服务 (新增) ⭐
├── utils/
│   ├── SunCalculator.js        # 日出日落计算 (新增) ⭐
│   └── GaussianScore.js        # 高斯评分函数 (新增) ⭐
└── middleware/
    └── httpLogger.js           # HTTP 日志 (已有)
```

### 前端代码简化

迁移后前端需要删除或简化的模块：

| 模块 | 当前行数 | 迁移后 | 变化 |
|------|---------|--------|------|
| `SunsetPredictionService.js` | 622 | 删除 | -622 |
| `EnhancedSunsetPredictionService.js` | 548 | 删除 | -548 |
| `SurroundingPointsService.js` | 204 | 简化为 API 调用 | -150 |
| **总计** | 1374 | ~54 | **-1320 行** |

新增前端模块：

```javascript
// src/services/PredictionAPIService.js (~100 行)
class PredictionAPIService {
  constructor(proxyURL) {
    this.proxyURL = proxyURL;
  }

  async calculate(weatherData, date, lat, lon, type) {
    const response = await fetch(`${this.proxyURL}/api/prediction/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weatherData, date, lat, lon, type })
    });
    return response.json();
  }

  async getSurrounding(centerLat, centerLon, radius, date, type) {
    const response = await fetch(`${this.proxyURL}/api/prediction/surrounding`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ centerLat, centerLon, radius, date, type })
    });
    return response.json();
  }

  async getEnhanced(weatherData, date, lat, lon, type, options) {
    const response = await fetch(`${this.proxyURL}/api/prediction/enhanced`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weatherData, date, lat, lon, type, options })
    });
    return response.json();
  }

  async getBatch(lat, lon, dates, type) {
    const response = await fetch(`${this.proxyURL}/api/prediction/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat, lon, dates, type })
    });
    return response.json();
  }
}

export default PredictionAPIService;
```

### 缓存策略

```javascript
// server/services/CacheService.js
class CacheService {
  constructor() {
    this.cache = new Map();
    this.TTL = {
      prediction: 30 * 60 * 1000,      // 30 分钟
      surrounding: 60 * 60 * 1000,     // 1 小时
      weather: 15 * 60 * 1000          // 15 分钟
    };
  }

  generateKey(type, params) {
    // 预测缓存键: prediction:lat:lon:date:type
    // 周边缓存键: surrounding:lat:lon:radius:date:type
    return `${type}:${Object.values(params).join(':')}`;
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    return item.data;
  }

  set(key, data, type) {
    this.cache.set(key, {
      data,
      expiry: Date.now() + this.TTL[type]
    });
  }
}
```

### 性能对比预估

| 场景 | 当前 (前端计算) | 重构后 (后端计算) | 提升 |
|------|----------------|------------------|------|
| 单点预测 | 350-400ms | 260-270ms | **30%** |
| 周边采样 (8点) | 500-950ms | 230-310ms | **60%** |
| 7天预测批量 | 2800-4000ms | 400-600ms | **85%** |
| 浏览器 CPU 占用 | 高 | 低 | **-80%** |

### 渐进式迁移策略

```javascript
// config.api.js - 添加迁移开关
export default {
  mode: 'proxy',
  proxyURL: 'http://localhost:3000',

  // 迁移开关 - 逐步启用后端 API
  features: {
    useBackendPrediction: false,      // Phase 1
    useBackendSurrounding: false,     // Phase 2
    useBackendEnhanced: false,        // Phase 3
    useBackendBatch: false            // Phase 4
  }
};

// 前端服务中根据开关选择调用方式
class PredictionController {
  async calculatePrediction(weatherData, date, lat, lon, type) {
    if (config.features.useBackendPrediction) {
      // 新方式：调用后端 API
      return this.predictionAPI.calculate(weatherData, date, lat, lon, type);
    } else {
      // 旧方式：前端计算 (兼容期间保留)
      return this.sunsetPredictionService.calculatePrediction(
        weatherData, date, lat, lon, type
      );
    }
  }
}
```

### Agent 分工策略

本项目采用双 Agent 并行开发模式：

| Agent | 角色 | 职责范围 | 特点 |
|-------|------|---------|------|
| **Agent1** 🟢 | 辅助 | 独立工具类、单元测试、文档更新 | 任务小、无依赖、可独立完成 |
| **Agent2** 🔵 | 主力 | 核心服务、路由、前端集成、控制器 | 任务大、有依赖、需要连续上下文 |

**并行执行时序图**：

```
时间轴 ──────────────────────────────────────────────────────────▶

第一轮（并行）
┌─────────────────────────┐  ┌─────────────────────────────────┐
│ 🟢 Agent1               │  │ 🔵 Agent2（主力）                │
│ • SunCalculator.js      │  │ • PredictionService.js          │
│ • GaussianScore.js      │  │   (核心算法迁移，600+行)         │
└─────────────────────────┘  └─────────────────────────────────┘
            │                              │
            ▼                              ▼
第二轮
┌─────────────────────────┐  ┌─────────────────────────────────┐
│ 🟢 Agent1               │  │ 🔵 Agent2（主力）                │
│ • 单元测试              │  │ • prediction.js 路由            │
│   (测试工具类)           │  │ • PredictionAPIService.js       │
│                         │  │ • 迁移开关配置                   │
└─────────────────────────┘  └─────────────────────────────────┘
            │                              │
            ▼                              ▼
第三轮（并行）── Phase 2 与 Phase 3 可并行
┌─────────────────────────┐  ┌─────────────────────────────────┐
│ 🟢 Agent1               │  │ 🔵 Agent2（主力）                │
│ • Phase 3 增强预测       │  │ • Phase 2 周边聚合              │
│   (较独立，迁移为主)      │  │   (需要调用 Phase 1 服务)        │
└─────────────────────────┘  └─────────────────────────────────┘
            │                              │
            ▼                              ▼
第四轮
┌─────────────────────────┐  ┌─────────────────────────────────┐
│ 🟢 Agent1               │  │ 🔵 Agent2（主力）                │
│ • 性能测试              │  │ • Phase 4 批量预测              │
│ • 请求日志              │  │ • 缓存优化                      │
└─────────────────────────┘  └─────────────────────────────────┘
            │                              │
            ▼                              ▼
第五轮
┌─────────────────────────┐  ┌─────────────────────────────────┐
│ 🟢 Agent1               │  │ 🔵 Agent2（主力）                │
│ • 更新测试              │  │ • Phase 5 前端代码清理          │
│ • 文档更新              │  │ • 删除旧服务、更新控制器         │
└─────────────────────────┘  └─────────────────────────────────┘
```

**关键并行点**：
- Phase 2 (周边聚合) 与 Phase 3 (增强预测) **可并行**，节省 1-2 周
- 工具类开发与核心服务开发 **可并行**
- 测试与文档可穿插在各阶段进行

### 实施阶段

| Phase | 目标 | 工作量 | 依赖 | Agent |
|-------|------|--------|------|-------|
| **Phase 1** | 核心预测算法后端化 | 2 周 | 无 | 🔵 Agent2 + 🟢 Agent1 |
| **Phase 2** | 周边采样聚合 API | 2 周 | Phase 1 | 🔵 Agent2 |
| **Phase 3** | 增强预测模型后端化 | 1 周 | Phase 1 | 🟢 Agent1 |
| **Phase 4** | 批量预测 + 缓存优化 | 1 周 | Phase 1-3 | 🔵 Agent2 + 🟢 Agent1 |
| **Phase 5** | 前端代码清理 + 测试 | 1 周 | Phase 1-4 | 🔵 Agent2 + 🟢 Agent1 |
| **Phase 6** | 火烧云地图重构（需求20） | 2-3 周 | Phase 1-5 | 🟢 Agent1 + 🔵 Agent2 |

**Phase 6 说明**：
- 解决需求20（火烧云地图覆盖层）的架构缺陷
- 需要完全重构地图集成方式（非 iframe）
- 完成后端 Python GFS 数据处理服务
- 详见下方"Phase 6: 火烧云地图重构"章节

### Phase 6: 火烧云地图重构（需求20）

**背景**：
- 需求20（火烧云地图覆盖层）在2026-02-03发现架构缺陷
- 当前使用 Windy iframe 嵌入，覆盖层在主页面 DOM
- 跨域 iframe 隔离导致地图拖动时覆盖层不跟随
- 功能已暂时移除，等待 Phase 1-5 完成后重构

**目标**：
1. 解决地图覆盖层跨域同步问题
2. 完成后端 Python GFS 数据处理服务
3. 实现生产级火烧云热力图可视化
4. 恢复需求20的全部验收标准

**三种技术方案对比**：

| 方案 | 技术栈 | 优点 | 缺点 | 成本 | 推荐度 |
|------|--------|------|------|------|--------|
| **A** | Windy API + Leaflet | 专业气象图层，官方支持 | 需要 Professional 许可证 | 💰💰 付费 | ⭐⭐⭐⭐ |
| **B** | Leaflet + OSM | 完全可控，免费开源 | 失去 Windy 专业图层 | 免费 | ⭐⭐⭐ |
| **C** | 保持移除状态 | 无开发成本 | 功能缺失 | 免费 | ⭐ |

**推荐方案：方案A（Windy API + Leaflet）**

**实施步骤**：

| 步骤 | 任务 | 工作量 | Agent |
|------|------|--------|-------|
| 6.1 | 地图方案决策（调研 Windy Professional 价格） | 2天 | 🟢 Agent1 |
| 6.2 | 重构 WindyMapService（Leaflet 集成） | 3天 | 🔵 Agent2 |
| 6.3 | 重构 FireCloudOverlayService（Leaflet 图层） | 2天 | 🔵 Agent2 |
| 6.4 | 完成 Python GFS 处理器 | 5天 | 🟢 Agent1 |
| 6.5 | 后端 API 集成和缓存 | 2天 | 🔵 Agent2 |
| 6.6 | 前后端联调测试 | 2天 | 🟢 Agent1 + 🔵 Agent2 |
| 6.7 | 性能优化和错误处理 | 2天 | 🟢 Agent1 |
| 6.8 | 文档更新和验收 | 1天 | 🟢 Agent1 |

**总工作量**：约 19 个工作日（3-4 周）

**验收标准**：
1. 地图拖动时覆盖层完美同步
2. 覆盖层热力图准确反映火烧云概率
3. GFS 数据成功下载和处理
4. 响应时间 < 3秒（首次生成）
5. 缓存命中率 > 60%
6. 移动端性能流畅
7. 需求20的全部15个验收标准通过

**风险与缓解**：

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|---------|
| Windy Professional 许可证成本过高 | 高 | 中 | 准备方案B（Leaflet + OSM）作为备选 |
| GFS 数据下载速度慢 | 中 | 高 | 实施后台预下载和长缓存策略 |
| 光路追踪算法性能问题 | 中 | 中 | 使用 NumPy 向量化优化，或改用 Numba JIT |
| 跨浏览器兼容性问题 | 低 | 低 | Leaflet 成熟库，兼容性好 |

### 26.6.1 地图方案决策文档

**决策日期**：2026-02-04
**决策者**：Agent1
**状态**：✅ 已决策

#### 1. 问题陈述

需求20（火烧云地图覆盖层）的当前实现存在**根本性架构缺陷**：
- `WindyMapService` 使用 `<iframe>` 嵌入 `https://embed.windy.com/`
- `FireCloudOverlayService` 在主页面 DOM 创建覆盖层
- 跨域 iframe 隔离导致覆盖层无法与地图同步
- **功能完全不可用**，已临时移除

#### 2. 方案评估

##### 方案 A：Windy API + Leaflet（官方集成）

| 维度 | 评估 |
|------|------|
| **技术可行性** | ✅ 高 - Windy 提供官方 Leaflet 插件 |
| **功能完整性** | ✅ 高 - 完整气象图层（风场、云量、降水、温度） |
| **开发复杂度** | 中 - 需要重构 WindyMapService |
| **成本** | ⚠️ 需要 Professional 许可证（按使用量付费） |
| **维护性** | ✅ 高 - 官方维护，API 稳定 |

**Windy API 许可证类型**：
- **Testing API**：免费，仅限开发测试，不可商用
- **Professional API**：按使用量付费，适合生产环境

**集成方式**：
```html
<script src="https://api.windy.com/assets/map-forecast/libBoot.js"></script>
<script>
windyInit({
  key: 'YOUR_PROFESSIONAL_KEY',
  lat: 40.0,
  lon: 116.0,
  zoom: 5
}, windyAPI => {
  const { map, store, picker } = windyAPI;
  // map 是 Leaflet 实例，可以直接操作
  L.imageOverlay(overlayUrl, bounds).addTo(map);
});
</script>
```

##### 方案 B：Leaflet + OpenStreetMap（开源方案）

| 维度 | 评估 |
|------|------|
| **技术可行性** | ✅ 高 - Leaflet 是成熟开源库 |
| **功能完整性** | ⚠️ 中 - 缺少专业气象图层 |
| **开发复杂度** | 低 - 标准 Leaflet 用法 |
| **成本** | ✅ 免费 |
| **维护性** | ✅ 高 - 开源社区活跃 |

**实现方式**：
```javascript
const map = L.map('map').setView([40.0, 116.0], 5);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

// 添加火烧云覆盖层
L.imageOverlay(overlayUrl, bounds, { opacity: 0.7 }).addTo(map);
```

**可选气象数据源**：
- OpenWeatherMap Tile API（基础气象图层）
- RainViewer API（降水雷达）
- 自定义 GFS 处理生成的热力图

##### 方案 C：混合方案（推荐）

**策略**：
1. **开发/测试阶段**：使用 Leaflet + OSM（免费）
2. **生产阶段**：可选升级到 Windy Professional API

| 维度 | 评估 |
|------|------|
| **技术可行性** | ✅ 高 |
| **功能完整性** | ✅ 高（可渐进增强） |
| **开发复杂度** | 中 |
| **成本** | ✅ 灵活可控 |
| **维护性** | ✅ 高 |

**架构设计**：
```
┌─────────────────────────────────────────────────────────┐
│                    MapService 接口                       │
│  - initMap(container, options)                          │
│  - setView(lat, lon, zoom)                              │
│  - addOverlay(url, bounds)                              │
│  - removeOverlay()                                      │
│  - onMove(callback)                                     │
└────────────────────────┬────────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         │                               │
┌────────▼────────┐           ┌──────────▼──────────┐
│ LeafletMapService │           │  WindyMapService   │
│ (Leaflet + OSM)  │           │ (Windy + Leaflet)  │
│   免费/开发环境   │           │  Professional API  │
└─────────────────┘           └────────────────────┘
```

#### 3. 决策结论

**选择：方案 C（混合方案）**

**理由**：
1. **灵活性**：先用免费方案验证功能，再决定是否升级
2. **风险控制**：避免前期投入许可证成本
3. **架构优势**：抽象接口支持未来切换
4. **开发效率**：Leaflet 学习成本低

**实施计划**：

| 阶段 | 任务 | 工作量 |
|------|------|--------|
| 1 | 创建 MapService 抽象接口 | 0.5 天 |
| 2 | 实现 LeafletMapService | 1 天 |
| 3 | 重构 FireCloudOverlayService 适配 Leaflet | 1 天 |
| 4 | 集成测试和调优 | 1 天 |
| 5 | （可选）实现 WindyMapService | 1 天 |

**技术规范**：

1. **地图容器**：
   ```html
   <div id="firecloud-map" style="width: 100%; height: 400px;"></div>
   ```

2. **覆盖层格式**：
   - 图片格式：PNG（RGBA，支持透明度）
   - 分辨率：0.25°（约 27km）或 0.5°（约 55km）
   - 颜色映射：蓝色（低概率）→ 黄色 → 橙色 → 红色（高概率）

3. **交互行为**：
   - 地图拖动时覆盖层自动同步（Leaflet 原生支持）
   - 缩放时覆盖层自动缩放
   - 点击覆盖层显示该点的具体概率值

4. **性能要求**：
   - 首次加载 < 3 秒
   - 拖动流畅度 > 30 FPS
   - 移动端内存占用 < 50MB

#### 4. 依赖项

| 依赖 | 版本 | 用途 |
|------|------|------|
| Leaflet | ^1.9.x | 地图渲染 |
| leaflet-image | ^0.4.x | 地图截图（可选） |

#### 5. 风险缓解

| 风险 | 缓解措施 |
|------|---------|
| OSM 瓦片服务不稳定 | 配置备用瓦片源（如 Carto） |
| 覆盖层图片过大 | 实施分块加载和懒加载 |
| 移动端性能问题 | 降低覆盖层分辨率，使用 Canvas 渲染 |

#### 6. 验收标准

1. ✅ 地图可正常加载和交互
2. ✅ 覆盖层与地图完美同步（拖动/缩放）
3. ✅ 火烧云概率热力图正确渲染
4. ✅ 支持切换到 Windy API（配置开关）
5. ✅ 移动端性能流畅

### 26.6 Phase 6 实现总结（2026-02-06 完成）

**实现内容**:

| 文件 | 变更 | 说明 |
|------|------|------|
| `src/services/WindyMapService.js` | 重写 | Leaflet + OSM 替代 iframe，支持 addImageOverlay/removeImageOverlay/onMove/getBounds |
| `src/services/FireCloudOverlayService.js` | 重写 | L.imageOverlay() 替代 DOM，支持后端 GFS + 前端 Canvas 双数据源 |
| `server/services/FireCloudService.js` | 新建 | Python GFS 处理器封装，child_process.spawn + 缓存 + 错误处理 |
| `server/routes/firecloud.js` | 重写 | 使用 FireCloudService，添加 /health 和 /cache/clear 端点 |
| `index.html` | 更新 | 添加 Leaflet CDN，恢复覆盖层控制面板可见性 |
| `tests/unit/server/FireCloudService.test.js` | 新建 | 19 个测试覆盖构造、健康检查、缓存配置、参数验证 |

**技术决策确认**:
- 采用方案C（混合方案）：Leaflet + OSM 开发环境，可选升级 Windy Professional
- 覆盖层通过 `L.imageOverlay()` 原生集成，解决 iframe 跨域问题
- 后端 GFS 处理器优先，前端 Canvas 回退，自动降级
- 缓存：覆盖层 30分钟 TTL，Python 60秒超时保护

---

## 27. Phase 7：代码质量优化

### 27.1 Toast 通知系统设计

**目标**：替换所有 `alert()` 为统一的 Toast 通知组件，提升用户体验。

**架构**：
```
ToastService (src/services/ToastService.js)
├── show(message, type, duration)  // 显示通知
├── success(message)               // 成功通知（绿色）
├── error(message)                 // 错误通知（红色）
├── warning(message)               // 警告通知（黄色）
├── info(message)                  // 信息通知（蓝色）
└── _createToastElement()          // 创建 DOM 元素
```

**视觉规范**：
- 位置：屏幕右上角，固定定位
- 动画：slideIn 进入，fadeOut 消失
- 样式：毛玻璃效果（与需求21一致），`backdrop-filter: blur()`
- 多条排队：最多同时显示 3 条，新通知从上方推入
- 移动端：底部居中显示，全宽

**替换清单**（5 处 alert）：
| 文件 | 当前代码 | 替换为 |
|------|----------|--------|
| AppController.js | `alert('...')` | `ToastService.error(...)` |
| WeatherController.js | `alert('...')` | `ToastService.warning(...)` |
| LanguageSelector.js | `alert('...')` | `ToastService.info(...)` |
| NotificationService.js | `alert('...')` | `ToastService.success(...)` |

### 27.2 AppController 拆分设计

**目标**：将 ~1700 行的 AppController 拆分为 4 个职责明确的控制器。

**拆分方案**：
```
AppController (协调者, ~800 行)
├── UIStateController (UI 状态管理, ~250 行)
│   ├── showLoading / hideLoading
│   ├── showError / showSuccess
│   ├── showAPIKeyModal / hideAPIKeyModal
│   └── showLocationError / clearLocationError
├── ChartRenderController (图表渲染, ~250 行)
│   ├── _renderSimpleChart
│   ├── chartService 封装
│   └── 图表数据格式化
└── FavoriteController (收藏与历史, ~200 行)
    ├── loadFavoriteLocations / toggleFavorite
    ├── loadSearchHistory / clearSearchHistory
    └── 收藏/历史 UI 更新
```

**依赖关系**：
```
AppController
├── inject → UIStateController
├── inject → ChartRenderController
├── inject → FavoriteController
├── own   → WeatherController
└── own   → PredictionController
```

**迁移策略**：渐进式提取，每步保证测试通过。

### 27.3 测试补充设计

**后端集成测试**（tests/integration/server/）：
- 使用 supertest 库对 Express app 进行 HTTP 级别测试
- 不依赖外部 API（mock Windy 服务）
- 验证完整的请求→路由→服务→响应链路

**E2E 测试补充**（tests/e2e/）：
- 使用现有 Playwright 框架
- 覆盖设置持久化场景（localStorage 跨页面验证）
- 覆盖多语言切换视觉一致性

### 27.4 API 文档设计

**格式**：OpenAPI 3.0 YAML（server/api-docs.yaml）
**分组标签**：天气数据 / 预测API / 火烧云覆盖层 / 系统
**可选**：集成 swagger-ui-express 提供在线文档浏览

---

## 28. 测试覆盖率达标方案（需求 23）

### 28.1 现状分析

**当前覆盖率基线（2026-02-11）**：

| 指标 | 当前值 | 目标阈值 | 差距 |
|------|--------|----------|------|
| Statements | 42.66% | 80% | -37.34pp |
| Branches | 42.59% | 75% | -32.41pp |
| Lines | 43.39% | 80% | -36.61pp |
| Functions | 35.23% | 90% | -54.77pp |

**根本原因**：大量生产代码文件（Canvas 服务、Leaflet 地图服务、UI 组件、工具类）目前 0% 或极低覆盖，同时语言翻译数据文件和 Mock 服务被计入覆盖率分母，人为拉低了整体指标。

### 28.2 两阶段提升策略

#### 阶段一：覆盖率配置修正（快速提升）

**目标**：通过调整 `jest.config.js` 的 `collectCoverageFrom` 排除非生产逻辑文件，使分母合理化。

排除规则：
```javascript
// jest.config.js - collectCoverageFrom 新增排除项
'!src/locales/**',        // 纯翻译数据，无业务逻辑
'!src/services/Mock*.js', // 离线开发用测试替身
'!src/**/*.test.js',      // 测试文件本身
'!tests/**',              // 测试目录
```

预期效果：排除约 15 个文件（10 个 locale + 3 个 Mock 服务），函数覆盖率预计从 35% 提升至约 50%。

#### 阶段二：补充单元测试（系统性补全）

按 ROI（投入产出比）由高到低排序：

| 优先级 | 文件 | 当前覆盖率 | 难度 | 预期收益 |
|--------|------|-----------|------|----------|
| P0 | `UnitConverter.js` | 3.44% | 低 | 高（纯静态工具类） |
| P0 | `ConfigService.js` | 0% | 低 | 高（纯逻辑无 DOM） |
| P1 | `StorageService.js` | 54% | 低 | 中（填补空白分支） |
| P1 | `ThemeService.js` | 40.81% | 中 | 中（需 mock DOM） |
| P1 | `NotificationService.js` | 13.33% | 中 | 中（需 mock Notification API） |
| P2 | `SurroundingPointsService.js` | 6% | 中 | 中（需 mock fetch） |
| P2 | `SunsetPrediction.js` 模型 | 72.41% | 低 | 低（填补分支） |
| P3 | `RadarChartService.js` | 1.26% | 高 | 中（需 mock Canvas） |
| P3 | `FireCloudOverlayService.js` | 6.84% | 高 | 中（需 mock Canvas + fetch） |
| P3 | `WindyMapService.js` | 0% | 高 | 中（需 mock Leaflet） |
| P4 | `src/components/*.js` | ~3% | 高 | 低（重度 DOM 依赖） |

### 28.3 各类型文件的 Mock 策略

#### Canvas API Mock（RadarChartService、FireCloudOverlayService）

```javascript
// tests/setup.js 或各测试文件顶部
const mockContext = {
  clearRect: jest.fn(),
  beginPath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  stroke: jest.fn(),
  fill: jest.fn(),
  arc: jest.fn(),
  fillText: jest.fn(),
  createLinearGradient: jest.fn(() => ({ addColorStop: jest.fn() })),
  // ... 其他 Canvas 2D 方法
};
HTMLCanvasElement.prototype.getContext = jest.fn(() => mockContext);
```

#### Leaflet Mock（WindyMapService）

```javascript
// tests/__mocks__/leaflet.js (Jest 自动 mock)
const L = {
  map: jest.fn(() => ({ setView: jest.fn().mockReturnThis(), ... })),
  tileLayer: jest.fn(() => ({ addTo: jest.fn() })),
  imageOverlay: jest.fn(() => ({ addTo: jest.fn(), remove: jest.fn() })),
  latLngBounds: jest.fn(),
};
export default L;
```

#### Notification API Mock（NotificationService）

```javascript
global.Notification = {
  requestPermission: jest.fn().mockResolvedValue('granted'),
  permission: 'granted',
};
global.Notification.prototype.close = jest.fn();
```

### 28.4 覆盖率收集配置

更新 `jest.config.js` 的 `collectCoverageFrom` 字段：

```javascript
collectCoverageFrom: [
  'src/**/*.js',
  'server/**/*.js',
  '!src/locales/**',         // 翻译数据文件
  '!src/services/Mock*.js',  // 测试替身服务
  '!src/app.js',             // 应用入口（难以单测）
  '!server/scripts/**',      // Python 脚本封装（由 pytest 覆盖）
  '!**/node_modules/**',
  '!**/*.test.js',
],
```

### 28.5 预期覆盖率路径

```
阶段       Statements  Branches  Functions  Lines
基线        42.66%     42.59%    35.23%    43.39%
阶段一后    ~58%       ~56%      ~55%      ~59%   （排除非生产文件）
P0 完成后  ~68%       ~64%      ~72%      ~68%   （+UnitConverter, ConfigService）
P1 完成后  ~75%       ~72%      ~83%      ~75%   （+Storage, Theme, Notification）
P2 完成后  ~79%       ~76%      ~88%      ~79%   （+Surrounding, 模型补全）
P3 完成后  ~83%       ~79%      ~92%      ~83%   （+Canvas/Leaflet mock）
目标阈值   80%        75%       90%       80%    ✅ 全部达标
```



## 29. 设计文档整合优化（2026-02-11）

> 本节用于沉淀近期重构与测试补强后的“稳定设计边界”，避免实现与文档出现二次偏离。

### 29.1 控制器职责再划分（Coordinator Pattern）

**目标**：降低 `AppController` 复杂度，使其聚焦于“流程协调与依赖编排”。

- `AppController`：
  - 负责初始化流程、跨控制器编排、位置切换主流程
  - 通过依赖注入组合子控制器
- `UIStateController`：
  - 承担页面消息、loading、错误/成功提示等 UI 状态职责
- `FavoriteController`：
  - 承担收藏位置与搜索历史的增删改查与事件响应

**设计约束**：
1. `AppController` 对 UI 只保留门面方法（facade），避免再次回流大量 DOM 细节。
2. 子控制器通过回调进行协作，不直接依赖彼此内部状态。
3. 所有新增跨层能力优先通过依赖注入接入，减少硬编码耦合。

### 29.2 图表渲染职责外置（ChartRenderController）

**目标**：把天气图表渲染从数据控制逻辑中剥离，提升复用性与可测试性。

- `WeatherController` 负责：
  - 天气数据获取/缓存、视图状态切换、参数选择
- `ChartRenderController` 负责：
  - 图表服务工厂（按温度/风速单位构建渲染函数）
  - 参数图分发（temp/precip/humidity/wind/pressure/clouds）
  - SVG 折线渲染细节

**后续演进建议**：
- 将 `renderSimpleChart` 进一步拆为：尺度计算、坐标映射、模板生成三个纯函数，便于属性测试。
- 统一图表颜色与单位文案到配置常量，减少散落字符串。

### 29.3 后端天气代理测试基线（Integration Baseline）

新增并固化天气代理关键路径测试：

- `GET /api/weather/forecast`
  - 正常返回
  - 缺参校验（400）
  - 上游错误透传（中间件）
  - CORS 响应头
- `GET /api/config/map-key`
  - 已配置（200）
  - 未配置（500）
- `GET /health`
  - 状态与时间戳结构

**环境兼容说明**：
- 对测试环境缺失 `setImmediate` 的情况增加兜底，避免异步链路在 jsdom/Node 组合环境中出现假失败。

### 29.4 文档治理与版本同步

- OpenAPI 文档版本提升至 `1.1.0`，并在 `info.description` 标注最近更新范围。
- 任务清单中与本轮交付相关条目（28.1、28.4、29.3、31.1、31.2）标记为完成。

### 29.5 覆盖率与质量门禁（下一步）

为支撑需求 23（覆盖率阈值），建议后续严格按以下顺序推进：

1. 先收敛覆盖率收集范围（排除纯数据/入口胶水层）。
2. 优先补齐工具类与纯函数模块（低成本高收益）。
3. 再补控制器与服务集成路径（含异常分支）。
4. 将覆盖率阈值校验纳入 CI 必过门禁。

---

**整合结果**：本设计文档已将“架构职责、图表渲染抽象、后端天气代理测试、OpenAPI 文档治理”四条主线统一到同一演进上下文，便于后续迭代按同一设计边界推进。


## 设计更新（2026-02-13）

### API 访问路径收敛为后端单入口

- **前端访问模式固定**：`API_CONFIG.mode` 固定为 `proxy`，不再从本地配置读取 `api_mode`。
- **设置面板简化**：删除 API 模式选择 UI，保留“后端服务器地址”输入框作为唯一 API 配置入口。
- **启动流程调整**：`AppController` 初始化不再进行直连模式 API Key 门禁校验，避免 API Key Modal 阻断。
- **安全边界**：API Key 仅存在于后端运行环境（如 `WINDY_API_KEY`），前端不负责配置与持久化。


## 30. 需求 24：中国定位服务 — 架构设计（2026-02-14）

### 30.1 问题背景

当前 `GeocodingService.js` 从**前端直连** `nominatim.openstreetmap.org`（OpenStreetMap，非 Google），在中国大陆可能因 GFW 导致连接缓慢或超时。Google Maps Geocoding API 中国直连完全不可用。

### 30.2 整体架构：模式 × 提供商 二层设计

```
用户配置
  geocoding_mode: 'backend' | 'direct'
  geocoding_provider: 'nominatim' | 'gaode' | 'google'
  geocoding_api_key: string（gaode/google 需要）

调用链路
─────────────────────────────────────────────────────────
mode=backend  →  BackendGeocodingService
                     ↓ GET /api/geocoding/search?provider=...&key=...
               Express (server/routes/geocoding.js)
                     ↓
               nominatim.openstreetmap.org   （provider=nominatim）
               restapi.amap.com/v3           （provider=gaode）
               maps.googleapis.com           （provider=google）
─────────────────────────────────────────────────────────
mode=direct   →  GeocodingService（原有，Nominatim 直连）
                 或 BackendGeocodingService(provider=google_direct)
                     ↓ 前端直接调用外部 API
```

> **高德仅支持后端代理**：高德 API Key 不能暴露在浏览器，必须经后端转发。

### 30.3 各提供商对比

| 提供商 | 中国可用（后端代理） | 中国可用（直连） | 需要 Key | 费用 |
|--------|:---:|:---:|:---:|------|
| Nominatim / OSM | ✅ | ⚠️ 受限 | ❌ | 免费 |
| 高德地图 | ✅ 最佳 | N/A（仅后端） | ✅ | 免费配额 |
| Google Maps | ⚠️ 后端境外 | ❌ | ✅ | 付费 |

### 30.4 新增文件与职责

#### `src/services/BackendGeocodingService.js`
- 替代 `GeocodingService`，通过 `/api/geocoding/*` 端点代理地理编码
- 构造器接受 `{ proxyURL, provider, apiKey }`
- 实现同接口：`geocode()` / `getCurrentLocation()` / `reverseGeocode()`

#### `src/services/GeocodingServiceFactory.js`
- 工厂类，读取 localStorage 配置返回正确服务实例
- `create(proxyURL?)` — 静态工厂方法
- `_createDirect(provider, apiKey)` — 直连分支
- `_createBackend(provider, apiKey, proxyURL)` — 后端代理分支
- `getOptions()` — 返回选项元数据（中国可用标记，供 UI 渲染）

#### `server/routes/geocoding.js`
- GET `/api/geocoding/search?q&provider&key`
- GET `/api/geocoding/reverse?lat&lon&provider&key`
- 支持：nominatim / gaode / google
- 统一响应格式：`{ results: [{name, lat, lon, type, provider}] }`

### 30.5 设置面板 UI 设计

```
📡 数据源与网络
  ┌──────────────────────────────────────────────┐
  │ 位置解析服务                                   │
  │  调用方式  ○ 后端代理（推荐）  ○ 前端直连       │
  │                                              │
  │  服务商    [下拉选择]                          │
  │            ├ Nominatim/OSM（默认）🟢 中国可用  │  ← 后端代理时
  │            ├ 高德地图 🇨🇳 🟢 中国首选           │
  │            └ Google Maps（需付费 Key）         │
  │                                              │
  │  API Key   [____________]  申请→              │  ← 高德/Google时显示
  └──────────────────────────────────────────────┘
```

### 30.6 localStorage 数据结构

```javascript
localStorage.geocoding_mode     = 'backend'     // 'backend' | 'direct'
localStorage.geocoding_provider = 'nominatim'   // 'nominatim' | 'gaode' | 'google'
localStorage.geocoding_api_key  = ''            // gaode/google key
```

### 30.7 动态重建服务实例

设置更改后需要立即生效（无需刷新）：

```
SettingsPanel → handleGeocodingSettingChange()
    → dispatchEvent('geocodingSettingChanged')
    → AppController.handleGeocodingSettingChanged()
    → geocodingService = GeocodingServiceFactory.create(proxyURL)
    → appController.geocodingService = geocodingService  （已有注入点）
```

---

## 31. 需求 25：用户可配置 Windy API Key — 架构设计（2026-02-14）

### 31.1 问题背景

当前 Windy API Key 固定在后端 `.env`，所有用户共享同一额度。需要支持用户携带自己的 Key，缓解速率限制，并为未来多租户架构打基础。

### 31.2 数据流设计

```
前端 localStorage.user_windy_api_key = "xxx"
    ↓
WindyAPIService.fetchFromProxy()
    → headers['X-Windy-API-Key'] = 'xxx'
    ↓
POST /api/weather/forecast (HTTP)
    ↓
server/routes/weather.js
    → userApiKey = req.headers['x-windy-api-key']
    ↓
windyService.fetchWeatherData(lat, lon, hours, userApiKey)
    → effectiveApiKey = userApiKey || process.env.WINDY_API_KEY
    ↓
Windy Point Forecast API（使用 effectiveApiKey）
```

### 31.3 安全考量

- Key 仅通过 HTTP 请求头传输，不落地服务端日志（`morgan` 默认不记录请求头）
- Key 存于浏览器 `localStorage`，与其他本地设置同级，用户自行负责安全
- Key 经由**后端中转**调用 Windy API，不直接暴露在 URL 或前端网络请求体中
- 格式校验：非空 + 长度 > 8，防止误操作提交空字符串

### 31.4 设置面板 UI 设计

```
📡 数据源与网络
  ┌──────────────────────────────────────────────┐
  │ Windy API 来源                                │
  │  ○ 使用系统 API（推荐）                        │
  │  ○ 使用我的 API Key                           │
  │    [••••••••••••••]  保存  清除               │  ← 选我的Key时显示
  │    申请地址：windy.com/developer               │
  └──────────────────────────────────────────────┘
```

### 31.5 后端修改点（已完成）

| 文件 | 变更 |
|------|------|
| `server/routes/weather.js` | 读取 `req.headers['x-windy-api-key']` 并传入 windyService |
| `server/services/windyService.js` | `fetchWeatherData(lat, lon, hours, userApiKey=null)` 新增第 4 参数，`effectiveApiKey = userApiKey \|\| this.apiKey` |

### 31.6 前端待修改点

| 文件 | 变更 |
|------|------|
| `src/services/WindyAPIService.js` | `fetchFromProxy()` 中读取 `localStorage.user_windy_api_key`，非空时附加 `X-Windy-API-Key` 请求头 |
| `src/components/SettingsPanel.js` | 新增 Windy API 来源单选组 + Key 输入框 |
| `src/locales/zh-CN.js` / `en-US.js` | 新增相关 i18n Key |

---

## 需求26设计：主页分页菜单 + 火烧云计算方法页

### 设计目标

- 在不改变现有后端接口的前提下，优化主页信息架构
- 通过分页菜单将「使用功能」与「算法说明」分离，降低新用户理解门槛
- 为后续算法可视化（分项权重、案例模拟）预留扩展位

### 信息架构调整

在主页顶栏引入一级视图切换入口（图标下拉菜单 + 兼容 Tab 语义）：

1. **预测功能页（默认）**
   - 保留现有天气查询、预测结果、图表与地图相关功能
2. **火烧云计算方法页（新增）**
   - 展示算法说明、评分构成和评分区间解释

交互入口：
- 顶栏列表图标（☰）点击展开下拉菜单
- 菜单选项：Forecast / Methodology
- 下拉菜单采用毛玻璃风格，与现有 UI 一致

> 切页行为采用前端状态切换，不触发整页刷新，不新增后端 API。

### 组件设计

新增/扩展前端组件建议如下：

- `HomePager`（可作为独立组件或并入现有主控制器）
  - 管理当前分页状态：`forecast` / `methodology`
  - 对外提供 `switchPage(pageId)`
- `MethodologyPanel`
  - 渲染火烧云计算方法内容
  - 包含四大因子说明：中高云、低云、湿度、能见度
  - 包含评分等级说明：优秀（>70）、良好（40-70）、一般（<40）

### 状态与事件流

- 初始状态：`activePage = 'forecast'`
- 用户点击分页菜单：
  1. 更新 `activePage`
  2. 切换内容容器可见性
  3. 更新激活样式（`aria-selected` + active class）
- 可选增强：将 `activePage` 写入 `localStorage.home_active_page`，刷新后恢复

### 可访问性与响应式

- 分页导航使用语义化结构（`role="menu"` / `role="menuitemradio"`，面板使用 `role="tabpanel"`）
- 支持键盘与点击切换（Enter/Space/ESC + 点击外部关闭）
- 移动端菜单保持可触达，确保触控点击区域 >= 40px
- 页面文案采用分段与列表，避免移动端长段落阅读负担

### 文案与国际化

新增 i18n Key（最小集）：

- `home.tabs.forecast`
- `home.tabs.methodology`
- `methodology.title`
- `methodology.intro`
- `methodology.factor.midHighCloud`
- `methodology.factor.lowCloud`
- `methodology.factor.humidity`
- `methodology.factor.visibility`
- `methodology.score.excellent`
- `methodology.score.good`
- `methodology.score.fair`

首批补齐 `zh-CN` 与 `en-US`，其他语言可回退默认文案。

### 风险与缓解

1. **风险：分页改造影响现有主页面布局**
   - 缓解：默认页保持原 DOM 结构，仅新增外层分页容器
2. **风险：多语言遗漏导致 key 显示异常**
   - 缓解：增加 i18n key 存在性测试或渲染兜底
3. **风险：移动端分页导航拥挤**
   - 缓解：使用横向滚动和短文案标题

### 本次范围声明

已落地实现：顶栏列表图标下拉切页 + 方法页内容 + i18n + 单测；后续仅补充更多 E2E/可访问性测试。


---

## Phase 11 设计：品牌升级、设置重组、访客持久化（需求 27-29）

> 实现日期：2026-03-02

---

### 需求 27：霞客 / Sunset Voyager Logo 设计

#### 视觉方案

顶栏标题由纯文字替换为 **内联 SVG 图标 + 文字** 横排组合：

```
[☀ 图标]  [霞客 / Sunset Voyager]
```

**图标设计：**
- 半圆弧（日出）+ 长横线（地平线）+ 两条短横线（水面倒影）
- 全部使用 `stroke="currentColor"`，深色/浅色主题自适应
- SVG viewBox: `0 0 76 76`

**颜色：** `#C49A3C`（暖金色，与顶栏整体色调一致）

**字体：** Cormorant Garamond 300（Google Fonts），回退 Georgia / PingFang SC

#### 多语言文字规则

| 语言 | 显示文字 |
|------|---------|
| zh-CN / zh-TW | 霞客 |
| ja-JP | 霞客 |
| ko-KR | 하객(霞客) |
| 其余 7 种语言 | Sunset Voyager |

#### 响应式规格

| 断点 | 图标高度 | 字号 | gap |
|------|---------|------|-----|
| 默认（移动） | 36px | 1.5rem | 12px |
| ≥768px（桌面） | 48px | 2rem | 16px |

#### HTML 结构

```html
<div class="app-logo">
  <svg class="app-logo-icon" viewBox="0 0 76 76">
    <!-- 半圆日出 -->
    <path d="M12 44 A26 26 0 0 1 64 44" stroke="currentColor" fill="none" stroke-width="4"/>
    <!-- 地平线 -->
    <line x1="0" y1="44" x2="76" y2="44" stroke="currentColor" stroke-width="4"/>
    <!-- 倒影 -->
    <line x1="10" y1="55" x2="66" y2="55" stroke="currentColor" stroke-width="3.5"/>
    <line x1="22" y1="66" x2="54" y2="66" stroke="currentColor" stroke-width="3"/>
  </svg>
  <span class="app-logo-text" data-i18n="app.title">霞客</span>
</div>
```

---

### 需求 28：设置界面重组设计

#### Section 划分

```
⚙️ 设置
├── 🌐 语言与显示
│   ├── 界面语言（select）
│   ├── 主题模式（select: 浅色/深色/跟随系统）
│   ├── 温度单位（select: °C / °F）
│   └── 风速单位（select: km/h / m/s）
├── ⭐ 默认位置
│   └── 收藏列表 + 设为默认按钮
├── 📍 位置解析
│   └── 提供商（select）：高德后端 / Nominatim后端 / Nominatim前端
├── 🔑 Windy API
│   └── 模式（radio）：系统Key / 自定义Key
│       └── [自定义时] Key输入框
├── 🔔 通知与提醒
│   ├── 启用通知（toggle）
│   └── 通知阈值（range slider）
└── ⚙️ 高级（<details> 折叠）
    └── 后端代理 URL（input）
```

#### 位置解析提供商说明

| 选项 | provider 值 | Key 来源 | 适用场景 |
|------|------------|---------|---------|
| 高德地图（后端代理）| `gaode` | 服务器 `.env` | 腾讯云/国内生产 |
| Nominatim（后端代理）| `nominatim` | 无需 Key | 海外生产 |
| Nominatim（前端直连）| `nominatim-frontend` | 无需 Key | 本地开发 |

**默认值：** `gaode`（服务器端 `GAODE_API_KEY` 环境变量）

#### 关键设计决策

- API Key **不在前端 UI 暴露**，统一由服务器 `.env` 管理
- 高级区域默认折叠（`<details>`），减少视觉噪音
- 每个 Section 独立，顺序按用户使用频率排列

---

### 需求 29：访客计数持久化设计

#### 存储方案

| 方案 | 选择原因 |
|------|---------|
| SQLite（better-sqlite3）| 轻量、零依赖外部服务、同步 API、适合单机部署 |
| 放弃 JSON 文件 | 代码更新/重部署会覆盖，数据不可靠 |
| 放弃 Redis | 需额外服务，过度设计 |

#### 数据库路径

```
~/.xiake/visitor.db   ← 与项目代码目录完全隔离
```

#### 数据库 Schema

```sql
CREATE TABLE IF NOT EXISTS visitor_count (
  id         INTEGER PRIMARY KEY CHECK (id = 1),
  count      INTEGER NOT NULL DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO visitor_count (id, count) VALUES (1, 0);
```

#### 接口设计（不变）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/visitor/count` | 读取当前计数 |
| POST | `/api/visitor/count` | 原子递增，返回最新值 |

#### 降级策略

SQLite 初始化失败时（权限问题等），自动降级为内存计数，服务不崩溃，日志记录警告。

#### nginx /api/ 路由修复

生产环境 nginx 80 端口配置必须包含：

```nginx
location /api/ {
    proxy_pass http://localhost:3000;
}
location /health {
    proxy_pass http://localhost:3000;
}
```

否则 `/api/` 请求会落到 Python 前端服务器（9002），返回 404。

---

## 天气数据源替换设计（Windy 异常乱序场景）

### 方案对比结论

| 维度 | Open-Meteo | 彩云天气（彩云 API） | 结论 |
|------|------------|----------------------|------|
| 成本 | 免费层可用，调用策略友好 | 商业化/配额策略更强依赖商务方案 | Open-Meteo 更适合先落地 |
| 字段完整性 | 小时级温度/湿度/风/气压/云量完善，日出日落可取 | 中文生态友好，国内常用字段齐全 | 两者都可支持核心功能 |
| 全球覆盖 | 强（全球） | 以中国场景体验更优 | 全球产品优先 Open-Meteo |
| 中国大陆可达性 | 需实测，可能受网络波动影响 | 通常更稳（取决于线路与账号） | 中国优先可考虑彩云兜底 |
| 迁移复杂度 | REST + JSON，字段映射清晰 | 需要额外鉴权与商务配置 | Open-Meteo 复杂度更低 |
| 风险 | 依赖海外链路可用性 | 依赖供应商策略与 key 管理 | 建议双提供商容灾 |

**推荐策略**：
1. **主方案：Open-Meteo**（先解决 Windy 数据乱序问题）。
2. **备方案：彩云**（针对中国大陆网络与稳定性兜底）。
3. 保留 Windy 作为可选第三数据源，仅在地图能力场景使用，不再作为唯一预测数据源。

### 迁移架构

新增 Provider 抽象层：

- `IWeatherProvider`（统一接口）
  - `fetchForecast(lat, lon, options)`
  - `normalize(raw)`
  - `healthCheck()`
- `WindyProviderAdapter`
- `OpenMeteoProviderAdapter`
- `CaiyunProviderAdapter`（可后置）
- `ProviderOrchestrator`
  - 主备路由（primary/fallback）
  - 时序校验（排序、去重、缺口检测）
  - 降级切换与熔断

### 数据标准化与抗乱序策略

1. **统一时间轴**：全部转换为 ISO + UTC 时间戳。
2. **时序纠偏**：
   - 按 timestamp 升序排序
   - 重复点保留最新 `updatedAt`
   - 缺口超过阈值（如 >2 个小时点）触发 `dataQuality=degraded`
3. **字段映射规范**：
   - 云层：优先高/中/低；无分层则估算映射
   - 风速：统一 m/s（前端按用户偏好转换）
   - 能见度：统一 km
4. **质量门禁**：预测算法入口前增加 `validateForecastShape()`，不合格数据直接拒绝进入评分流程。

### API 兼容策略

- 现有 `/api/weather/forecast` 响应保持兼容，新增：
  - `providerMeta.provider`
  - `providerMeta.fallbackUsed`
  - `providerMeta.dataQuality`
- 前端 `WeatherController`、`SunsetPredictionService` 不感知上游差异，仅消费标准化模型。

### 分阶段迁移

1. **Phase A：抽象层落地**（不改默认供应商）
2. **Phase B：接入 Open-Meteo + 双读对比**
3. **Phase C：灰度切流（10% → 50% → 100%）**
4. **Phase D：按地区启用彩云兜底（可选）**
5. **Phase E：下线 Windy 预测依赖（保留地图能力）**

### 现有功能支持性结论（按 API 能力差异）

> 说明：以下结论用于指导迁移设计与风险管理，聚焦“当前系统已实现功能”在更换天气 API 后的可支持性。

| 功能/需求 | Windy Point Forecast | Open-Meteo Forecast API | 彩云天气 API | 迁移结论 |
|-----------|----------------------|-------------------------|--------------|----------|
| 未来 7 天 + 24h 小时预报（需求11） | ✅ | ✅ | ✅ | 三者均可支持 |
| 温度/湿度/风速/气压（需求3/4/11） | ✅ | ✅ | ✅ | 三者均可支持 |
| 分层云量（低/中/高，需求5/12） | ✅（l/m/h clouds） | ✅（cloud_cover_low/mid/high） | ⚠️ 通常仅总云量/云况 | 彩云需“估算分层”或算法降级 |
| 能见度（需求3/5） | ⚠️ 无原生字段，当前为估算 | ✅ 原生可取 | ✅ 常见有 visibility（但粒度需核实） | Open-Meteo 在该项优于 Windy |
| 朝霞/晚霞独立评分（需求12） | ✅ | ✅ | ✅ | 可继续支持，关键是标准化字段完整 |
| 日出日落 + 黄金/蓝调时段（需求12） | ✅（可由外部天文库补） | ✅（daily sunrise/sunset） | ✅（常见含日出日落） | 三者可支持 |
| 太阳方位角（需求12） | ✅（依赖 SunCalc 非 API） | ✅（依赖 SunCalc 非 API） | ✅（依赖 SunCalc 非 API） | 与供应商解耦，不受迁移影响 |
| 地图天气可视化（Windy 地图能力） | ✅（生态原生） | ❌（非地图 SDK） | ❌（非地图 SDK） | 地图仍建议保留 WindyMap/Leaflet 体系 |
| 中国大陆网络可达性稳定 | ⚠️ 视网络而定 | ⚠️ 需实测 | ✅ 通常更优 | 中国区可用彩云做 fallback |

#### 哪些功能迁移后“可能无法原样支持”

1. **若主切到 Open-Meteo 且完全下线 Windy 数据字段**：
   - `convPrecip/cape` 等 Windy 特定字段需替代映射或从算法中移除（不影响基础预测，但会影响部分高级评分细节）。
2. **若回退到彩云且彩云仅提供总云量**：
   - 需求 5/12 中“低中高云分层精算”将无法原样实现，需要“分层估算模型”或“评分降级策略”。
3. **若彻底移除 Windy 生态**：
   - 现有 Windy Map 相关体验无法由 Open-Meteo/彩云直接替代（需独立地图方案）。

#### 哪些功能迁移后“仍可完整支持”

- 温度、湿度、风速、气压、总云量、降水、7 天/24h 图表（需求3/4/11）。
- 朝霞晚霞评分主流程（需求5/6/7/12），前提是标准化层输出齐全。
- 日出日落、黄金/蓝调时段、通知、收藏、多语言等与数据源弱耦合能力（需求12/13/14）。

#### 迁移后可新增（Windy 现状中较弱或未直接利用）的能力

1. **Open-Meteo 方向**：
   - 多模型切换与模型对比（更适合做“模型一致性评分”）。
   - 历史/再分析数据更容易接入（可用于算法回测）。
   - 原生能见度字段可替代当前估算，提高评分可信度。
2. **彩云方向（中国区）**：
   - 中国本地链路稳定性通常更好，可显著降低超时与失败率。
   - 可结合彩云告警/本地化天气描述增强中文体验。

#### 推荐落地结论

- **主数据源：Open-Meteo**（覆盖完整、接入成本低、能见度原生）。
- **中国区兜底：彩云**（优先保障可达性与稳定性）。
- **地图能力：继续保留 WindyMap/Leaflet，不与天气预测数据源强绑定**。

---

## 迁移策略修订（用户决策版）

### 决策 D1：第一阶段只做 Open-Meteo

- 当前阶段采用 **Open-Meteo 单提供商** 方案，目标是最快替换 Windy 乱序问题。
- 彩云接入暂缓，仅保留接口扩展位；待中国大陆实测表现不达标再启动二期。
- `providerMeta.provider` 第一阶段固定为 `openmeteo`（除回滚到 windy 的紧急场景）。

### 决策 D2：地图能力从“Windy可视化”转向“火烧云专题图层”

- 不再依赖 Windy 地图作为核心体验；地图能力聚焦：
  1) 可切换底图（Leaflet + OSM/其他）
  2) 火烧云潜力图层（中国/全球）
  3) 与预测算法一致的评分色带
- Windy 地图仅保留兼容入口（可选），不再作为主路径。

### 火烧云地图绘制方案（中国/全球）

#### 方案 A：服务端瓦片渲染（推荐）

1. 后端按 `z/x/y/time` 计算网格点预测分值（0-100）。
2. 生成 PNG/WebP 瓦片并缓存（Redis/磁盘/内存）。
3. 前端以 TileLayer 方式加载：
   - `/api/firecloud/tiles/{z}/{x}/{y}.png?ts=...`
4. 优点：全球扩展强、前端压力小、CDN 友好。

#### 方案 B：客户端网格渲染（中小范围可用）

1. 后端返回视窗 bbox 内网格评分 JSON。
2. 前端 Canvas/WebGL 绘制热力网格。
3. 优点：实现快；缺点：全球缩放下性能压力大。

**建议**：中国范围先用 B 快速验证，全球范围切 A。

### Open-Meteo 云层信息可用性（用于需求 4）

在迁移设计中，Open-Meteo 目标字段采用：
- `cloud_cover`（总云量）
- `cloud_cover_low`（低云）
- `cloud_cover_mid`（中云）
- `cloud_cover_high`（高云）

这意味着当前依赖低/中/高云分层评分的算法可直接映射，不需要像彩云兜底那样默认降级。

### Windy 特定字段说明（用于需求 5）

当前后端显式请求的 Windy 专有/耦合字段包括：
- `lclouds/mclouds/hclouds`：低/中/高云量
- `convPrecip`：对流降水（常用于对流天气强度判断）
- `cape`：对流有效位能（衡量大气不稳定度，常用于雷暴潜势）

在本项目中：
- `convPrecip` 已用于能见度估算与降水相关评分输入。
- `cape` 当前已请求但尚未成为前端核心展示字段，需要在迁移时决定“是否继续参与高级评分”。

迁移到 Open-Meteo 时，需为 `convPrecip/cape` 设计替代策略：
1. 有可替代变量则映射；
2. 无可靠映射则关闭对应子评分并标记 `degradedReason`。

---

## Windy API 下线设计（逐步移除）

### 目标状态（Target State）

- **天气预测链路**：仅 Open-Meteo。
- **地图展示链路**：火烧云专题图层（独立底图 + 自定义覆盖），不依赖 Windy 天气数据 API。
- **Windy 相关代码**：仅保留必要的历史兼容层，最终可完全删除。

### 分阶段下线策略

#### Stage 1：默认切流到 Open-Meteo（保留回滚）

1. `/api/weather/forecast` 默认调用 Open-Meteo adapter。
2. Windy 仅作为 emergency fallback（开关默认 off）。
3. 所有响应输出 `providerMeta`，用于确认未误走 Windy。

#### Stage 2：移除用户 Windy Key 入口

1. 前端设置面板移除 Windy key 输入与来源切换。
2. 清理本地存储 key：`user_windy_api_key`、`windyApiKeyMode*`。
3. 文案与帮助说明全部改为 Open-Meteo。

#### Stage 3：移除后端 Windy 主链路

1. 删除 `X-Windy-API-Key` header 透传。
2. weather 路由不再注入 `userApiKey`。
3. `windyService` 从 forecast 主路径摘除（必要时迁移到 legacy 模块）。

#### Stage 4：清理遗留依赖与测试

1. 删除 Windy 预测相关单元/集成测试或迁移为 Open-Meteo 版本。
2. 更新 API 文档与部署文档，明确 Windy 不再用于天气预测。
3. 保留并强化火烧云图层 API（tiles/grid）作为地图主能力。

### 风险控制

- 每个 Stage 均可独立发布，出现异常可回滚到上一 Stage。
- 关键指标：小时序列完整率、预测评分稳定性、接口错误率、地图首屏时延。

---

## 35. 光路评分物理重构设计（一步到位）

### 35.1 设计目标

- 让光路分具备物理可解释性（而非经验常数拼接）
- 避免“雨雪阴天高分”与“展示文案和算法脱节”
- 将光路模块从“加分噪声源”转为“稳定抑制误报的约束项”

### 35.2 新算法总览

输入（来自 Open-Meteo + 现有天文计算）：
- `solarElevation`（太阳高度角）
- `solarAzimuth`（太阳方位角）
- `cloudBaseHeight`（由 pressure-level RH + geopotential 估算）
- `lowClouds/midClouds/highClouds`
- `cloudCover/precipitation/convPrecip/weatherCode`

核心流程：
1. **沿光路采样**：在太阳反向来光方向采样 20/50/100km 三个点
2. **几何遮挡判定**：各点计算 `criticalElevation = atan(cloudBaseHeight / distance)`
3. **分层遮挡因子**：低云 > 中云 > 高云
4. **融合为 occlusionProbability**：输出 0~1 遮挡概率
5. **恶劣天气封顶**：厚云/雨雪强制上限
6. **输出 lightPathScore + 解释字段**

### 35.3 关键公式

- 几何遮挡临界角：
  - `criticalElevation_i = atan(H_i / D_i)`
- 单点遮挡强度：
  - `block_i = sigmoid(criticalElevation_i - solarElevation) * layerWeight_i`
- 全路径遮挡概率：
  - `occlusionProbability = 1 - Π(1 - block_i)`
- 光路分：
  - `lightPathScore = 100 * (1 - occlusionProbability)`

其中 `layerWeight` 默认：低云 0.7 / 中云 0.2 / 高云 0.1。

### 35.4 恶劣天气硬封顶策略

- `cloudCover >= 85` → `lightPathScore <= 40`
- `precipitation > 0.5 || convPrecip > 0.5 || rain/snow weatherCode` → `lightPathScore <= 50`
- 如同时命中，取更严格上限。

### 35.5 数据结构（后端响应）

新增/规范字段：

```json
{
  "lightPath": {
    "score": 0,
    "occlusionProbability": 0.0,
    "samples": [
      {"distanceKm": 20, "cloudBaseHeight": 900, "criticalElevation": 2.58, "block": 0.31},
      {"distanceKm": 50, "cloudBaseHeight": 1200, "criticalElevation": 1.37, "block": 0.44},
      {"distanceKm": 100, "cloudBaseHeight": 1500, "criticalElevation": 0.86, "block": 0.27}
    ],
    "capReason": "overcast_cap_40",
    "explain": "厚云且低云遮挡，直射光路受阻"
  }
}
```

### 35.6 前端展示策略

- 不再展示 `150km/300km` 固定文案
- 显示：
  - 光路分
  - 遮挡概率（可选）
  - 封顶原因（命中时）
- 文案必须完全来源于后端返回字段，不允许前端硬编码旧模型术语。

### 35.7 权重与开关

- 推荐默认：`final = canvas*0.5 + lightPath*0.2 + rendering*0.3`（示意）
- `lightPathWeight` 可配置，默认保守（<=0.3）
- 保留短期回滚开关：`LIGHT_PATH_V2_ENABLED=true/false`（默认 true，旧算法默认关闭）

### 35.8 验证与观测

1. 单元测试：
   - 太阳高度角边界
   - 云底高度缺失回退
   - 雨雪/厚云封顶触发
2. 回放样本：
   - Val Thorens 雨夹雪/阴天样本应低分
3. 线上观测：
   - `lightPathScore` 直方图
   - `capReason` 命中率
   - 异常告警：`cloudCover>85 && lightPathScore>60`

---

## 36. Windy 彻底移除设计（预测链路）

### 36.1 范围定义

- **移除范围**：天气预测与评分链路
- **保留范围（可选）**：地图可视化（若独立模块仍需）

### 36.2 三阶段执行

1. **Freeze 阶段**
   - 禁止新增 Windy 预测依赖
   - 新功能仅允许接入 Open-Meteo 字段

2. **Cutover 阶段**
   - weather/prediction API 强制走 Open-Meteo
   - 删除前端 Windy Key UI 与存储键
   - 删除后端 `X-Windy-API-Key` 透传

3. **Purge 阶段**
   - 删除 windyService 在预测主链路引用
   - 清理测试、文档、配置残留
   - 增加“7天无 Windy 调用”验收门禁

### 36.3 技术控制点

- provider gate：请求进入预测前强校验 `provider=openmeteo`
- telemetry：记录 `providerMeta.provider` 分布
- migration cleanup：前端启动时一次性清理 `user_windy_api_key`
- rollback：仅保留短期开关，默认关闭且限时下线

### 36.4 验收输出

- 代码层：无预测链路 Windy 依赖
- 运行层：连续 7 天 Windy 预测调用为 0
- 文档层：README/OpenAPI/.kiro 全量同步为 Open-Meteo 主链路


---

## 需求 37 设计：晚霞评分热力地图

### 37.1 架构概览

```
[定时任务 Cron]
    ↓ 每天 4 次（08/12/15/17 CST）
[GridScoreService]
    ↓ 并发请求 ~100 个网格点
[Open-Meteo API]
    ↓
[EnhancedPredictionService] × 100
    ↓
[GridCache] → 内存 + 文件持久化（~/.xiake/grid-cache.json）
    ↓
[GET /api/heatmap/grid]
    ↓
[前端 HeatmapLayer]
    ↓ 双线性插值 + Canvas 渲染
[Leaflet 地图叠加层]
```

### 37.2 网格设计（中国区域）

| 参数 | 值 |
|------|-----|
| 经度范围 | 72°E – 135°E |
| 纬度范围 | 18°N – 53°N |
| 间隔 | 经向 5°，纬向 5° |
| 总点数 | 约 104 点（13×8） |
| API 消耗 | 104 次/更新 × 4 次/天 = 416 次/天 |

> 后续可升级到 2° 间隔（~750 点），需付费 API。

### 37.3 后端实现

#### GridScoreService（新建）
- `generateGrid(date)` — 生成网格坐标列表
- `fetchAndScore(gridPoints, date)` — 并发获取天气数据并评分（concurrency limit=10）
- `getCache()` — 返回当前缓存（含 timestamp）
- `refreshIfStale(maxAgeMs)` — 超时才刷新（频控保护）

#### API 接口
- `GET /api/heatmap/grid` — 返回缓存网格评分
  ```json
  {
    "updatedAt": "2026-03-15T09:00:00Z",
    "gridPoints": [
      { "lat": 30, "lon": 120, "score": 75, "quality": "excellent" }
    ]
  }
  ```
- `POST /api/heatmap/refresh` — 手动触发刷新（需频控，60分钟内只能触发一次）

#### 定时任务
- Cron 表达式（CST）：`0 0,4,7,9 * * *`（UTC）= 08/12/15/17 CST
- 使用 node-cron 或系统 cron 调用 `/api/heatmap/refresh`

### 37.4 前端实现

#### HeatmapLayer.js（新建）
- `init(map)` — 在 Leaflet 地图上创建 Canvas overlay
- `render(gridData)` — 双线性插值 + 颜色映射渲染
- `toggle(visible)` — 显隐图层
- `onMapClick(lat, lon)` — 获取点击位置评分（最近网格点或插值）

#### 颜色映射
| 评分 | 颜色 | 透明度 |
|------|------|--------|
| ≥ 70 | `#FF6B35`（橙红） | 0.7 |
| 50–70 | `#FFD166`（金黄） | 0.6 |
| 30–50 | `#A8D8EA`（浅蓝） | 0.4 |
| < 30 | `#718096`（灰蓝） | 0.3 |

#### 中国边界裁剪
- 使用简化版中国行政边界 GeoJSON（境外不渲染）
- 或用矩形范围 + 透明度梯度模拟（MVP 版本）

### 37.5 性能与限制

- **缓存有效期**：1 小时（maxAge = 3600000ms）
- **并发控制**：同时最多 10 个 Open-Meteo 请求
- **文件持久化**：`~/.xiake/grid-cache.json`，重启后不丢缓存
- **降级策略**：缓存过期且刷新失败时，返回旧缓存 + `stale: true` 标记
