/**
 * MockWindyMapService - 模拟Windy地图服务
 *
 * 用于后端代理模式，提供地图功能的模拟实现
 * 需求：18.3（地图预测功能）
 */

class MockWindyMapService {
  constructor() {
    this.apiKey = 'mock-map-key';
    this.map = null;
    this.windyAPI = null;
    this.isInitialized = false;
    this.currentLayer = 'wind';
    this.currentTimeIndex = 0;
  }

  /**
   * 初始化模拟地图
   * @param {string} containerId - 地图容器ID
   * @param {Object} options - 地图配置选项
   * @returns {Promise<void>}
   */
  async initializeMap(containerId, options = {}) {
    return new Promise((resolve) => {
      console.log('[MockWindyMapService] 正在初始化模拟地图...');

      // 创建模拟的地图容器
      const container = document.getElementById(containerId);
      if (!container) {
        console.error('[MockWindyMapService] 地图容器不存在:', containerId);
        resolve();
        return;
      }

      // 清空容器
      container.innerHTML = '';

      // 创建模拟的地图元素
      const mockMap = document.createElement('div');
      mockMap.id = 'mock-map';
      mockMap.style.width = '100%';
      mockMap.style.height = '100%';
      mockMap.style.position = 'relative';
      mockMap.style.background = '#1a1a2e';
      mockMap.style.borderRadius = '8px';
      mockMap.style.overflow = 'hidden';

      // 创建地图标题
      const title = document.createElement('div');
      title.textContent = '地图预测（模拟模式）';
      title.style.position = 'absolute';
      title.style.top = '10px';
      title.style.left = '50%';
      title.style.transform = 'translateX(-50%)';
      title.style.color = 'white';
      title.style.zIndex = '10';
      title.style.fontSize = '18px';
      title.style.fontWeight = 'bold';
      title.style.textShadow = '1px 1px 3px rgba(0,0,0,0.8)';

      mockMap.appendChild(title);

      // 创建图层控制按钮
      const layerControls = document.createElement('div');
      layerControls.style.position = 'absolute';
      layerControls.style.top = '40px';
      layerControls.style.left = '10px';
      layerControls.style.zIndex = '10';
      layerControls.style.display = 'flex';
      layerControls.style.flexDirection = 'column';
      layerControls.style.gap = '5px';

      const layers = [
        { key: 'wind', label: '风', color: '#00d2ff' },
        { key: 'temp', label: '温度', color: '#ff6b6b' },
        { key: 'clouds', label: '云', color: '#4dabf7' },
        { key: 'rain', label: '降水', color: '#5c7cfa' }
      ];

      layers.forEach(layer => {
        const btn = document.createElement('button');
        btn.textContent = layer.label;
        btn.style.padding = '8px 12px';
        btn.style.border = 'none';
        btn.style.borderRadius = '4px';
        btn.style.background = layer.key === this.currentLayer ? layer.color : '#666';
        btn.style.color = 'white';
        btn.style.cursor = 'pointer';
        btn.style.fontSize = '12px';
        btn.style.transition = 'all 0.2s';
        btn.onclick = () => this.setLayer(layer.key);
        layerControls.appendChild(btn);
      });

      mockMap.appendChild(layerControls);

      // 创建时间控制
      const timeControls = document.createElement('div');
      timeControls.style.position = 'absolute';
      timeControls.style.bottom = '10px';
      timeControls.style.right = '10px';
      timeControls.style.zIndex = '10';
      timeControls.style.background = 'rgba(255,255,255,0.9)';
      timeControls.style.padding = '10px';
      timeControls.style.borderRadius = '8px';
      timeControls.style.display = 'flex';
      timeControls.style.flexDirection = 'column';
      timeControls.style.gap = '8px';

      const currentTimeDisplay = document.createElement('div');
      currentTimeDisplay.innerHTML = `
        <div style="font-size: 12px; color: var(--color-text-light);">当前时间：</div>
        <div style="font-size: 16px; font-weight: bold; color: #333;">
          ${this.getCurrentTimeLabel()}
        </div>
      `;
      timeControls.appendChild(currentTimeDisplay);

      const quickButtons = document.createElement('div');
      quickButtons.style.display = 'flex';
      quickButtons.style.gap = '5px';

      const nowBtn = document.createElement('button');
      nowBtn.textContent = '现在';
      nowBtn.style.flex = '1';
      nowBtn.style.padding = '5px';
      nowBtn.style.border = '1px solid #ddd';
      nowBtn.style.borderRadius = '4px';
      nowBtn.style.cursor = 'pointer';
      nowBtn.style.background = 'var(--color-card-bg)';
      nowBtn.style.fontSize = '12px';
      nowBtn.onclick = () => this.setTime(0);
      quickButtons.appendChild(nowBtn);

      const sunsetBtn = document.createElement('button');
      sunsetBtn.textContent = '日落';
      sunsetBtn.style.flex = '1';
      sunsetBtn.style.padding = '5px';
      sunsetBtn.style.border = '1px solid #ddd';
      sunsetBtn.style.borderRadius = '4px';
      sunsetBtn.style.cursor = 'pointer';
      sunsetBtn.style.background = 'var(--color-card-bg)';
      sunsetBtn.style.fontSize = '12px';
      sunsetBtn.onclick = () => this.setTime(60);
      quickButtons.appendChild(sunsetBtn);

      const sunriseBtn = document.createElement('button');
      sunriseBtn.textContent = '日出';
      sunriseBtn.style.flex = '1';
      sunriseBtn.style.padding = '5px';
      sunriseBtn.style.border = '1px solid #ddd';
      sunriseBtn.style.borderRadius = '4px';
      sunriseBtn.style.cursor = 'pointer';
      sunriseBtn.style.background = 'var(--color-card-bg)';
      sunriseBtn.style.fontSize = '12px';
      sunriseBtn.onclick = () => this.setTime(720);
      quickButtons.appendChild(sunriseBtn);

      timeControls.appendChild(quickButtons);

      mockMap.appendChild(timeControls);

      // 添加地图内容
      this.renderMapContent(mockMap);

      container.appendChild(mockMap);
      this.map = mockMap;
      this.isInitialized = true;

      console.log('[MockWindyMapService] 地图初始化成功');
      resolve();
    });
  }

  /**
   * 渲染地图内容
   * @param {HTMLElement} mapElement - 地图元素
   */
  renderMapContent(mapElement) {
    // 创建渐变背景模拟不同图层
    const content = document.createElement('div');
    content.style.position = 'absolute';
    content.style.top = '0';
    content.style.left = '0';
    content.style.width = '100%';
    content.style.height = '100%';

    switch (this.currentLayer) {
      case 'wind':
        // 风图层 - 蓝色渐变
        content.style.background = 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)';
        break;
      case 'temp':
        // 温度图层 - 红色/黄色渐变
        content.style.background = 'linear-gradient(135deg, #ff6b6b 0%, #ffd93d 50%, #ff6b6b 100%)';
        break;
      case 'clouds':
        // 云层 - 灰色/白色渐变
        content.style.background = 'linear-gradient(135deg, #e9ecef 0%, #ced4da 50%, #e9ecef 100%)';
        break;
      case 'rain':
        // 降水 - 蓝色渐变
        content.style.background = 'linear-gradient(135deg, #4dabf7 0%, #339af0 50%, #4dabf7 100%)';
        break;
    }

    mapElement.appendChild(content);

    // 添加网格线
    this.addGridLines(mapElement);

    // 添加标记点
    this.addMarkers(mapElement);
  }

  /**
   * 添加网格线
   * @param {HTMLElement} mapElement - 地图元素
   */
  addGridLines(mapElement) {
    const gridSize = 50;
    for (let i = 0; i < mapElement.offsetWidth; i += gridSize) {
      const line = document.createElement('div');
      line.style.position = 'absolute';
      line.style.top = i + 'px';
      line.style.left = '0';
      line.style.width = '100%';
      line.style.height = '1px';
      line.style.background = 'rgba(255,255,255,0.1)';
      mapElement.appendChild(line);
    }

    for (let i = 0; i < mapElement.offsetHeight; i += gridSize) {
      const line = document.createElement('div');
      line.style.position = 'absolute';
      line.style.left = i + 'px';
      line.style.top = '0';
      line.style.height = '100%';
      line.style.width = '1px';
      line.style.background = 'rgba(255,255,255,0.1)';
      mapElement.appendChild(line);
    }
  }

  /**
   * 添加标记点
   * @param {HTMLElement} mapElement - 地图元素
   */
  addMarkers(mapElement) {
    const markers = [
      { lat: 31.23, lon: 121.47, label: '上海', color: '#ff6b6b', size: 20 },
      { lat: 39.90, lon: 116.40, label: '北京', color: '#ffd93d', size: 20 },
      { lat: 22.54, lon: 114.05, label: '香港', color: '#51cf66', size: 15 },
      { lat: 23.13, lon: 113.26, label: '广州', color: '#ff922b', size: 15 },
      { lat: 34.34, lon: 108.95, label: '西安', color: '#845ef7', size: 15 }
    ];

    markers.forEach(marker => {
      const markerEl = document.createElement('div');
      markerEl.style.position = 'absolute';
      markerEl.style.left = ((marker.lon - 100) / 180) * 100 + '%';
      markerEl.style.top = ((marker.lat + 90) / 180) * 100 + '%';
      markerEl.style.transform = 'translate(-50%, -50%)';
      markerEl.style.width = marker.size + 'px';
      markerEl.style.height = marker.size + 'px';
      markerEl.style.borderRadius = '50%';
      markerEl.style.background = marker.color;
      markerEl.style.border = '2px solid white';
      markerEl.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
      markerEl.style.cursor = 'pointer';
      markerEl.style.zIndex = '5';

      // 添加悬浮提示
      const tooltip = document.createElement('div');
      tooltip.style.position = 'absolute';
      tooltip.style.bottom = '30px';
      tooltip.style.left = '50%';
      tooltip.style.transform = 'translateX(-50%)';
      tooltip.style.background = 'rgba(0,0,0,0.8)';
      tooltip.style.color = 'white';
      tooltip.style.padding = '5px 10px';
      tooltip.style.borderRadius = '4px';
      tooltip.style.fontSize = '12px';
      tooltip.style.whiteSpace = 'nowrap';
      tooltip.textContent = marker.label;
      markerEl.appendChild(tooltip);

      markerEl.onclick = () => {
        alert(`${marker.label}\n纬度: ${marker.lat}\n经度: ${marker.lon}\n时间: ${this.getCurrentTimeLabel()}`);
      };

      mapElement.appendChild(markerEl);
    });
  }

  /**
   * 设置当前图层
   * @param {string} layer - 图层类型
   */
  setLayer(layer) {
    this.currentLayer = layer;
    if (this.map) {
      // 重新渲染地图
      this.map.innerHTML = '';
      this.renderMapContent(this.map);
    }
  }

  /**
   * 设置时间点
   * @param {number} minutes - 分钟偏移（0 = 现在，60 = 日落，720 = 日出）
   */
  setTime(minutes) {
    this.currentTimeIndex = minutes;
    if (this.map) {
      // 更新时间显示
      const timeDisplay = this.map.querySelector('.current-time-display strong');
      if (timeDisplay) {
        timeDisplay.textContent = this.getCurrentTimeLabel();
      }

      // 添加闪烁效果
      this.map.style.opacity = '0.5';
      setTimeout(() => {
        this.map.style.opacity = '1';
      }, 200);
    }
  }

  /**
   * 获取当前时间标签
   * @returns {string} 时间标签
   */
  getCurrentTimeLabel() {
    const now = new Date();
    const hours = (now.getHours() + this.currentTimeIndex / 60) % 24;
    const minutes = now.getMinutes() + (this.currentTimeIndex % 60);
    return `${Math.floor(hours).toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

  /**
   * 移动地图到指定位置
   * @param {number} lat - 纬度
   * @param {number} lon - 经度
   * @param {number} zoom - 缩放级别
   */
  moveTo(lat, lon, zoom) {
    console.log('[MockWindyMapService] 移动地图到:', lat, lon);
    // 模拟移动：闪烁一下
    if (this.map) {
      this.map.style.opacity = '0.7';
      setTimeout(() => {
        this.map.style.opacity = '1';
      }, 300);
    }
  }

  /**
   * 更改地图叠加层
   * @param {string} layerName - 图层名称
   */
  changeOverlay(layerName) {
    this.setLayer(layerName);
  }

  /**
   * 更改预测时间
   * @param {number} hours - 小时偏移
   */
  changeForecastTime(hours) {
    this.setTime(hours * 60);
  }

  /**
   * 获取初始化状态
   * @returns {boolean}
   */
  getIsInitialized() {
    return this.isInitialized;
  }
}

export default MockWindyMapService;
