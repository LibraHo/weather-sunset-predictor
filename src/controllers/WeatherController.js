

  /**
   * 刷新界面文本（语言切换后）
   * 需求：14 - 多语言支持
   */
  refreshUIText() {
    console.log('[WeatherController] 刷新界面文本...');

    // 更新天气区域标题
    const weatherSection = document.getElementById('weather-section');
    if (weatherSection) {
      const title = weatherSection.querySelector('h2');
      if (title) title.textContent = this.i18n.t('weather.title');
    }

    // 更新"使用当前位置"按钮提示
    const currentLocationBtn = document.getElementById('current-location-btn');
    if (currentLocationBtn) {
      currentLocationBtn.setAttribute('aria-label', this.i18n.t('buttons.useCurrentLocation'));
    }

    // 更新"搜索"按钮
    const searchBtn = document.getElementById('search-btn');
    if (searchBtn) {
      searchBtn.textContent = this.i18n.t('buttons.search');
    }

    // 更新位置输入框占位符
    const locationInput = document.getElementById('location-input');
    if (locationInput) {
      locationInput.placeholder = this.i18n.t('location.placeholder');
    }

    // 更新视图切换按钮
    const overviewBtn = document.getElementById('overview-btn');
    if (overviewBtn) {
      overviewBtn.textContent = this.i18n.t('charts.overview');
    }

    const hourlyBtn = document.getElementById('hourly-btn');
    if (hourlyBtn) {
      hourlyBtn.textContent = this.i18n.t('charts.hourly');
    }

    this.chartService = this.chartRenderController.createChartService(this.tempUnit, this.windUnit);

    // 如果有当前天气数据，重新渲染以更新格式化的日期/时间
    if (this.currentWeatherData) {
      // 根据当前视图重新渲染
      if (this.currentView === 'hourly') {
        // 重新渲染24小时图表
        this.renderHourlyForecast(this.currentWeatherData, this.selectedDay);
      } else {
        // 重新渲染概览
        this.renderWeeklyOverview(this.currentWeatherData);
      }
    }
  }

  /**
   * 更新温度单位
   * @param {string} unit - 新的温度单位 ('celsius' | 'fahrenheit')
   */
  updateTemperatureUnit(unit) {
    if (!['celsius', 'fahrenheit'].includes(unit)) {
      console.warn('[WeatherController] Invalid temperature unit:', unit);
      return;
    }

    this.tempUnit = unit;
    localStorage.setItem('temp_unit', unit);

    // 如果有当前天气数据，重新渲染显示
    if (this.currentWeatherData) {
      this.updateWeatherDisplay(this.currentWeatherData, this.currentLocation);
    }
  }

  /**
   * 更新风速单位
   * @param {string} unit - 新的风速单位 ('kmh' | 'ms')
   */
  updateWindUnit(unit) {
    if (!['kmh', 'ms'].includes(unit)) {
      console.warn('[WeatherController] Invalid wind speed unit:', unit);
      return;
    }

    this.windUnit = unit;
    localStorage.setItem('wind_unit', unit);

    // 如果有当前天气数据，重新渲染显示
    if (this.currentWeatherData) {
      this.updateWeatherDisplay(this.currentWeatherData, this.currentLocation);
    }
  }

  /**
   * 获取转换后的温度值
   * @param {number} temp - 原始温度值（摄氏度）
   * @returns {number} 转换后的温度值
   */
  getConvertedTemp(temp) {
    if (this.tempUnit === 'fahrenheit') {
      return UnitConverter.celsiusToFahrenheit(temp, 1);
    }
    return temp;
  }

  /**
   * 获取转换后的风速值
   * @param {number} windSpeed - 原始风速值（公里/小时）
   * @returns {number} 转换后的风速值
   */
  getConvertedWindSpeed(windSpeed) {
    if (this.windUnit === 'ms') {
      return UnitConverter.kmhToMs(windSpeed, 1);
    }
    return windSpeed;
  }

  /**
   * 格式化温度显示（带单位）
   * @param {number} temp - 温度值
   * @returns {string} 格式化后的温度字符串
   */
  formatTemperature(temp) {
    return UnitConverter.formatTemperature(this.getConvertedTemp(temp), this.tempUnit, 1);
  }

  /**
   * 格式化风速显示（带单位）
   * @param {number} windSpeed - 风速值
   * @returns {string} 格式化后的风速字符串
   */
  formatWindSpeed(windSpeed) {
    return UnitConverter.formatWindSpeed(this.getConvertedWindSpeed(windSpeed), this.windUnit, 1);
  }

  // ========== 任务19：周边火烧云可视化 ==========

  /**
   * 任务19：获取并显示周边火烧云数据
   * @param {Object} location - 当前位置对象
   * @param {number} radius - 探测半径（公里），默认使用当前设置的半径
   */
  async fetchSurroundingData(location, radius = this.surroundingRadius) {
    if (!location || !location.lat || !location.lon) {
      console.warn('[WeatherController] 无效的位置，无法获取周边数据');
      return;
    }

    console.log(`[WeatherController] 获取周边火烧云数据，半径: ${radius}km, 使用后端API: ${this.useBackendSurrounding}`);

    // 显示section和加载状态
    const sectionEl = document.getElementById('surrounding-section');
    const loadingEl = document.getElementById('surrounding-loading');
    const errorEl = document.getElementById('surrounding-error');
    const contentEl = document.getElementById('surrounding-content');

    if (sectionEl) sectionEl.classList.remove('hidden');
    if (loadingEl) loadingEl.classList.remove('hidden');
    if (errorEl) errorEl.classList.add('hidden');
    if (contentEl) contentEl.style.display = 'none';

    try {
      let data;

      // 需求22 Phase 2：根据配置选择前端或后端实现，后端失败时自动回退
      if (this.useBackendSurrounding && this.predictionAPIService) {
        try {
          // 优先调用后端 API
          data = await this.predictionAPIService.getSurrounding(
            location.lat,
            location.lon,
            radius,
            'sunset', // 默认晚霞，可根据当前时间调整
            new Date()
          );

          // 转换数据格式以匹配前端期望的结构
          data = this._convertBackendSurroundingData(data, location);
        } catch (backendError) {
          console.warn('[WeatherController] 后端周边预测 API 不可用，回退到前端实现:', backendError.message);
          data = await this._fetchSurroundingFrontend(location, radius);
        }
      } else {
        data = await this._fetchSurroundingFrontend(location, radius);
      }

      this.surroundingData = data;

      // 渲染雷达图
      this.renderSurroundingRadar(data);

      // 任务20：如果覆盖层已启用，生成并显示覆盖层
      if (this.fireCloudOverlayEnabled) {
        await this.updateFireCloudOverlay(location, data);
      }

      // 隐藏加载状态，显示内容
      if (loadingEl) loadingEl.classList.add('hidden');
      if (contentEl) contentEl.style.display = 'block';

      console.log('[WeatherController] 周边火烧云数据获取完成');
    } catch (error) {
      console.error('[WeatherController] 获取周边火烧云数据失败:', error);

      if (loadingEl) loadingEl.classList.add('hidden');
      if (errorEl) {
        errorEl.textContent = this.i18n.t('surrounding.error') || error.message;
        errorEl.classList.remove('hidden');
      }
    } finally {
    }
  }

  /**
   * 需求22 Phase 2：转换后端周边数据格式为前端期望的结构
   * @param {Object} backendData - 后端返回的数据
   * @param {Object} location - 当前位置对象
   * @returns {Object} 转换后的数据
   * @private
   */
  _convertBackendSurroundingData(backendData, location) {
    return {
      center: location,
      radius: backendData.radius,
      points: backendData.points.map(p => ({
        ...p,
        location: { lat: p.lat, lon: p.lon, name: p.name },
        weatherData: p.weatherData,
        prediction: p.prediction,
        score: p.score
      })),
      timestamp: backendData.timestamp
    };
  }

  /**
   * 前端实现的周边数据获取（后端不可用时的回退）
   * @param {Object} location - 位置对象
   * @param {number} radius - 半径（公里）
   * @returns {Promise<Object>} 周边数据
   * @private
   */
  async _fetchSurroundingFrontend(location, radius) {
    const { default: PredictionController } = await import('./PredictionController.js');
    const predictionController = new PredictionController(this.storageService);

    return await this.surroundingPointsService.getSurroundingData(
      location,
      radius,
      async (loc) => {
        // 使用不修改全局状态的私有方法，避免周边请求覆盖当前位置/天气数据
        const weatherData = await this._fetchWeatherWithoutMutation(loc);
        return weatherData[0]; // 返回当前天气数据
      },
      (weatherData) => {
        if (!weatherData) return null;
        return predictionController.predictionService.calculatePrediction(
          weatherData,
          new Date(),
          location.lat,
          location.lon
        );
      }
    );
  }

  /**
   * 获取指定位置的天气数据，不修改 this.currentWeatherData / this.currentLocation 全局状态。
   * 用于周边采样等需要并行获取多点天气但不应影响主状态的场景。
   * @param {Location} location - 位置对象
   * @returns {Promise<WeatherData[]>} 天气数据数组
   * @private
   */
  async _fetchWeatherWithoutMutation(location) {
    if (!this.windyAPIService) {
      throw new Error('API密钥未设置，请先配置API密钥');
    }

    if (!location || !location.isValid()) {
      throw new Error('无效的位置信息');
    }

    // 先查缓存（只读，不写入全局状态）
    const cachedData = this.storageService.getCachedWeatherData(location);
    if (cachedData) {
      return cachedData;
    }

    const weatherData = await this.windyAPIService.fetchWeatherData(
      location.lat,
      location.lon
    );

    // 写缓存，但不更新 this.currentWeatherData / this.currentLocation
    this.storageService.cacheWeatherData(location, weatherData);

    return weatherData;
  }

  /**
   * 任务19：渲染周边火烧云雷达图
   * @param {Object} data - 周边数据对象
   */
  renderSurroundingRadar(data) {
    if (!data || !data.points) {
      console.warn('[WeatherController] 无周边数据可渲染');
      return;
    }

    // 准备雷达图数据
    const points = data.points.map(p => ({
      label: p.label,
      name: p.name,
      distance: p.distance,
      score: p.score || 0
    }));

    // 渲染雷达图（传入容器ID而不是canvas ID）
    const success = this.radarChartService.renderRadarChart('radar-chart-container', points, {
      width: 280,
      height: 280,
      radius: 100,
      showLabels: true,
      showScores: true,
      showDistance: false,  // 紧凑模式下不显示距离
      onClick: (point, index) => this.handleSurroundingPointClick(point, index)
    });

    if (success) {
      // 显示推荐观赏方向
      this.renderBestDirections(data.points);
    }
  }

  /**
   * 任务19：渲染推荐观赏方向
   * @param {Object[]} points - 周边点数据数组
   */
  renderBestDirections(points) {
    const container = document.getElementById('best-directions-list');
    if (!container) return;

    // 筛选评分>=60的点
    const bestPoints = points.filter(p => p.score >= 60).sort((a, b) => b.score - a.score);

    if (bestPoints.length === 0) {
      container.innerHTML = `<p style="color: var(--color-text-light);">${this.i18n.t('surrounding.noData') || '当前周边区域火烧云观赏条件一般'}</p>`;
      return;
    }

    container.innerHTML = bestPoints.map((p, index) => {
      let qualityClass = '';
      let qualityText = '';

      if (p.score >= 80) {
        qualityClass = 'color: #4caf50;';
        qualityText = this.i18n.t('surrounding.legend.excellent') || '优秀';
      } else if (p.score >= 60) {
        qualityClass = 'color: #ffc107;';
        qualityText = this.i18n.t('surrounding.legend.good') || '良好';
      }

      return `
        <div class="direction-item" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--border-color, #e0e0e0); cursor: pointer;" data-index="${index}">
          <span>${p.name} (${p.label})</span>
          <span style="${qualityClass} font-weight: 600;">${p.score}分 - ${qualityText}</span>
        </div>
      `;
    }).join('');

    // 绑定点击事件
    container.querySelectorAll('.direction-item').forEach((item, index) => {
      item.addEventListener('click', () => {
        this.handleSurroundingPointClick(bestPoints[index], index);
      });
    });
  }

  /**
   * 任务19：处理周边点点击事件
   * @param {Object} point - 点击的点数据
   * @param {number} index - 点索引
   */
  handleSurroundingPointClick(point, index) {
    console.log('[WeatherController] 点击周边点:', point);

    // 可以在这里添加显示详细信息的功能
    // 例如：显示该方向的详细气象数据、观赏建议等
    toastService.show(`${point.name}方向｜评分: ${point.score}分｜距离: ${point.distance}公里`, 'info', 5000);
  }

  /**
   * 任务19：设置周边探测半径
   * @param {number} radius - 半径（公里）
   */
  setSurroundingRadius(radius) {
    this.surroundingRadius = radius;
    console.log(`[WeatherController] 周边半径已设置为: ${radius}km`);

    // 如果有当前位置，重新获取周边数据
    if (this.currentLocation) {
      this.fetchSurroundingData(this.currentLocation, radius);
    }
  }

  // ========== 任务20：火烧云覆盖层相关方法 ==========

  /**
   * 任务20：更新火烧云覆盖层
   * @param {Object} location - 中心位置
   * @param {Object} surroundingData - 周边数据（可选，如果未提供则使用当前数据）
   */
  async updateFireCloudOverlay(location, surroundingData = null) {
    if (!this.fireCloudOverlayEnabled) {
      console.log('[WeatherController] 覆盖层未启用，跳过更新');
      return;
    }

    const data = surroundingData || this.surroundingData;
    if (!data || !data.points) {
      console.warn('[WeatherController] 无周边数据，无法生成覆盖层');
      return;
    }

    try {
      console.log('[WeatherController] 更新火烧云覆盖层...');

      // 生成覆盖层
      const overlayData = await this.fireCloudOverlayService.generateOverlay(
        location,
        data.points,
        this.surroundingRadius * 2, // 覆盖层半径扩大到周边半径的2倍
        this.currentOverlayType
      );
      console.log('[WeatherController] 火烧云覆盖层更新完成');

      // 更新UI状态
      this.updateOverlayStatus(true);

    } catch (error) {
      console.error('[WeatherController] 更新覆盖层失败:', error);
      this.updateOverlayStatus(false, error.message);
    }
  }

  /**
   * 任务20：切换覆盖层开关
   * @param {boolean} enabled - 是否启用
   */
  async toggleFireCloudOverlay(enabled) {
    this.fireCloudOverlayEnabled = enabled;

    console.log(`[WeatherController] 覆盖层${enabled ? '启用' : '禁用'}`);

    if (enabled) {
      // 启用覆盖层：如果已有周边数据，立即生成并显示
      if (this.surroundingData && this.currentLocation) {
        await this.updateFireCloudOverlay(this.currentLocation);
      } else if (this.currentLocation) {
        // 没有周边数据，先获取周边数据
        await this.fetchSurroundingData(this.currentLocation, this.surroundingRadius);
      }
    } else {
      // 禁用覆盖层：移除现有覆盖层
      this.fireCloudOverlayService.removeOverlay();
    }
  }

  /**
   * 任务20：设置覆盖层类型（朝霞/晚霞）
   * @param {string} type - 类型 ('sunrise' | 'sunset')
   */
  async setOverlayType(type) {
    if (this.currentOverlayType === type) {
      return; // 类型未改变
    }

    this.currentOverlayType = type;
    console.log(`[WeatherController] 覆盖层类型设置为: ${type}`);

    // 如果覆盖层已启用，重新生成覆盖层
    if (this.fireCloudOverlayEnabled && this.currentLocation && this.surroundingData) {
      await this.updateFireCloudOverlay(this.currentLocation);
    }
  }

  /**
   * 任务20：手动刷新覆盖层
   */
  async refreshFireCloudOverlay() {
    if (!this.fireCloudOverlayEnabled) {
      console.log('[WeatherController] 覆盖层未启用，无需刷新');
      return;
    }

    if (this.currentLocation && this.surroundingData) {
      console.log('[WeatherController] 手动刷新覆盖层');

      try {
        // 刷新覆盖层
        await this.fireCloudOverlayService.refresh(
          this.currentLocation,
          this.surroundingData.points,
          this.surroundingRadius * 2,
          this.currentOverlayType
        );

        console.log('[WeatherController] 覆盖层刷新完成');

      } catch (error) {
        console.error('[WeatherController] 刷新覆盖层失败:', error);
        this.updateOverlayStatus(false, error.message);
      }
    }
  }

  /**
   * 任务20：更新覆盖层UI状态
   * @param {boolean} success - 是否成功
   * @param {string} error - 错误消息（可选）
   */
  updateOverlayStatus(success, error = null) {
    const statusEl = document.getElementById('overlay-status');
    const loadingEl = document.getElementById('overlay-loading');

    if (loadingEl) {
      loadingEl.style.display = 'none';
    }

    if (statusEl) {
      if (success) {
        statusEl.innerHTML = `<span style="color: var(--color-success, #4caf50);">✓ ${this.i18n.t('overlay.active') || '覆盖层已显示'}</span>`;
      } else {
        statusEl.innerHTML = `<span style="color: var(--color-error, #f44336);">✗ ${error || (this.i18n.t('overlay.error') || '覆盖层生成失败')}</span>`;
      }
    }
  }

  /**
   * 任务20：清除覆盖层缓存
   */
  clearOverlayCache() {
    this.fireCloudOverlayService.clearCache();
    console.log('[WeatherController] 覆盖层缓存已清除');
  }

}

export default WeatherController;
