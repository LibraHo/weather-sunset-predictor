# 设计文档

## 概述

天气晚霞预测器是一个全栈Web应用程序，由前端、后端API服务器和Python数据处理服务组成。应用通过Windy API和NOAA GFS数据获取气象数据，运用气象学原理分析火烧云（晚霞）出现的可能性，并生成可视化的地图覆盖层。

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

### 技术栈

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

### 技术栈

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
