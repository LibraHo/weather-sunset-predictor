/**
 * Share Routes - 分享链接页面路由
 *
 * 轻量版预测展示页，支持 OG meta tags
 * GET /share?lat=xx&lon=xx&date=YYYY-MM-DD&period=sunrise|sunset
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const EnhancedPredictionService = require('../services/EnhancedPredictionService.js');
const BackendGeocodingService = require('../services/BackendGeocodingService.js');
const orchestrator = require('../services/ProviderOrchestrator');
const SunCalculator = require('../utils/SunCalculator.js');

// 创建地理编码服务实例
const geocodingService = new BackendGeocodingService({
  provider: 'nominatim',
  apiKey: null
});

// 质量等级配置
const QUALITY_LEVELS = {
  excellent: { label: '极佳', labelEn: 'Excellent', color: '#FF6B35', bgColor: 'linear-gradient(135deg, #FF6B35 0%, #F7931E 100%)' },
  good: { label: '良好', labelEn: 'Good', color: '#4CAF50', bgColor: 'linear-gradient(135deg, #4CAF50 0%, #8BC34A 100%)' },
  fair: { label: '一般', labelEn: 'Fair', color: '#FFC107', bgColor: 'linear-gradient(135deg, #FFC107 0%, #FF9800 100%)' },
  poor: { label: '较差', labelEn: 'Poor', color: '#9E9E9E', bgColor: 'linear-gradient(135deg, #9E9E9E 0%, #757575 100%)' }
};

/**
 * 逆地理编码 - 根据坐标获取地点名称
 */
async function reverseGeocode(lat, lon) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&accept-language=zh-CN`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'XiakeSunsetPredictor/1.0' },
      timeout: 5000
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    if (data && data.display_name) {
      // 提取主要部分（城市/地区）
      const parts = data.display_name.split(',');
      return parts.slice(0, 3).join(', ');
    }
    return null;
  } catch (err) {
    console.error('[ShareRoute] Reverse geocoding error:', err.message);
    return null;
  }
}

/**
 * 获取天气数据
 */
async function fetchWeatherForPrediction(lat, lon, targetDate) {
  try {
    const weatherResponse = await orchestrator.fetchWeatherData(lat, lon, 168);
    const hourly = Array.isArray(weatherResponse.data) ? weatherResponse.data : [];
    
    if (!hourly.length) return null;
    
    // 找到最接近目标日期的数据点
    const targetTs = new Date(targetDate).getTime();
    const selected = hourly.reduce((closest, current) => {
      const currentTs = (current.timestamp || 0) * 1000;
      const closestTs = (closest.timestamp || 0) * 1000;
      return Math.abs(currentTs - targetTs) < Math.abs(closestTs - targetTs) ? current : closest;
    }, hourly[0]);
    
    return {
      cloudCover: selected.cloudCover || 0,
      humidity: selected.humidity || 0,
      visibility: selected.visibility || 10,
      lowClouds: selected.lowClouds || 0,
      midClouds: selected.midClouds || 0,
      highClouds: selected.highClouds || 0,
      lowCloudCover: selected.lowClouds || 0,
      precipitation: selected.precipitation || 0,
    };
  } catch (err) {
    console.error('[ShareRoute] Weather fetch error:', err.message);
    return null;
  }
}

/**
 * 生成云层分析摘要
 */
function generateCloudSummary(weatherData, quality) {
  const { highClouds, midClouds, lowClouds } = weatherData;
  const parts = [];
  const partsEn = [];
  
  if (highClouds > 30) {
    parts.push(`高云${highClouds}%`);
    partsEn.push(`High clouds ${highClouds}%`);
  }
  if (midClouds > 30) {
    parts.push(`中云${midClouds}%`);
    partsEn.push(`Mid clouds ${midClouds}%`);
  }
  if (lowClouds > 20) {
    parts.push(`低云${lowClouds}%`);
    partsEn.push(`Low clouds ${lowClouds}%`);
  }
  
  if (parts.length === 0) {
    if (quality === 'excellent' || quality === 'good') {
      return { zh: '云层条件理想', en: 'Ideal cloud conditions' };
    }
    return { zh: '云层较薄', en: 'Thin cloud cover' };
  }
  
  return { zh: parts.join('，'), en: partsEn.join(', ') };
}

/**
 * 渲染分享页面
 */
router.get('/', async (req, res) => {
  try {
    const { lat, lon, date, period = 'sunset' } = req.query;
    
    // 参数验证
    if (!lat || !lon || !date) {
      return res.status(400).send('Missing required parameters: lat, lon, date');
    }
    
    const latNum = parseFloat(lat);
    const lonNum = parseFloat(lon);
    
    if (isNaN(latNum) || isNaN(lonNum) || latNum < -90 || latNum > 90 || lonNum < -180 || lonNum > 180) {
      return res.status(400).send('Invalid coordinates');
    }
    
    if (!['sunrise', 'sunset'].includes(period)) {
      return res.status(400).send('Invalid period, must be sunrise or sunset');
    }
    
    // 获取地点名称
    const locationName = await reverseGeocode(latNum, lonNum);
    const locationDisplay = locationName || `${latNum.toFixed(2)}°, ${lonNum.toFixed(2)}°`;
    
    // 获取天气数据并计算预测
    const weatherData = await fetchWeatherForPrediction(latNum, lonNum, date);
    
    let prediction = null;
    let quality = 'poor';
    let score = 0;
    
    if (weatherData) {
      prediction = EnhancedPredictionService.calculateEnhancedPrediction(
        weatherData,
        new Date(date),
        latNum,
        lonNum,
        period
      );
      
      score = Math.round(prediction.score || 0);
      quality = prediction.quality || 'poor';
    }
    
    const qualityConfig = QUALITY_LEVELS[quality] || QUALITY_LEVELS.poor;
    const cloudSummary = weatherData ? generateCloudSummary(weatherData, quality) : { zh: '暂无数据', en: 'No data' };
    
    // 时段标签
    const periodLabel = period === 'sunrise' ? '朝霞' : '晚霞';
    const periodLabelEn = period === 'sunrise' ? 'Sunrise' : 'Sunset';
    
    // 日期格式化
    const dateObj = new Date(date);
    const dateStr = dateObj.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
    const dateStrEn = dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    
    // OG 描述
    const ogDescription = `${locationDisplay} · ${dateStr} ${periodLabel} · 预测评分 ${score}分 · ${qualityConfig.label}`;
    const ogDescriptionEn = `${locationDisplay} · ${dateStrEn} ${periodLabelEn} · Score ${score} · ${qualityConfig.labelEn}`;
    
    // 渲染 HTML
    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>霞客 · ${locationDisplay} · ${periodLabel}预测</title>
  
  <!-- Open Graph Meta Tags -->
  <meta property="og:title" content="霞客 · ${locationDisplay} · ${periodLabel}预测">
  <meta property="og:description" content="${ogDescription} | ${ogDescriptionEn}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://sunset.bjhyc.online/share?lat=${lat}&lon=${lon}&date=${date}&period=${period}">
  <meta property="og:image" content="https://sunset.bjhyc.online/assets/share-og-placeholder.jpg">
  <meta property="og:locale" content="zh_CN">
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="霞客 · ${locationDisplay} · ${periodLabel}预测">
  <meta name="twitter:description" content="${ogDescription}">
  <meta name="twitter:image" content="https://sunset.bjhyc.online/assets/share-og-placeholder.jpg">
  
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 20px;
    }
    
    .card {
      background: rgba(255, 255, 255, 0.95);
      border-radius: 24px;
      padding: 40px;
      max-width: 420px;
      width: 100%;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      text-align: center;
    }
    
    .brand {
      font-size: 14px;
      color: #666;
      letter-spacing: 4px;
      margin-bottom: 8px;
      text-transform: uppercase;
    }
    
    .brand-en {
      font-size: 12px;
      color: #999;
      margin-bottom: 24px;
    }
    
    .location {
      font-size: 24px;
      font-weight: 600;
      color: #333;
      margin-bottom: 4px;
      line-height: 1.3;
    }
    
    .location-en {
      font-size: 14px;
      color: #666;
      margin-bottom: 24px;
    }
    
    .period-badge {
      display: inline-block;
      background: ${qualityConfig.bgColor};
      color: white;
      padding: 6px 16px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 24px;
    }
    
    .score-section {
      margin: 32px 0;
    }
    
    .score-circle {
      width: 140px;
      height: 140px;
      border-radius: 50%;
      background: ${qualityConfig.bgColor};
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      margin: 0 auto 16px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
    }
    
    .score-value {
      font-size: 48px;
      font-weight: 700;
      color: white;
      line-height: 1;
    }
    
    .score-label {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.9);
      margin-top: 4px;
    }
    
    .quality-label {
      font-size: 28px;
      font-weight: 600;
      color: ${qualityConfig.color};
      margin-bottom: 4px;
    }
    
    .quality-label-en {
      font-size: 16px;
      color: #666;
    }
    
    .cloud-summary {
      background: #f5f5f5;
      border-radius: 12px;
      padding: 16px;
      margin: 24px 0;
    }
    
    .cloud-summary-title {
      font-size: 12px;
      color: #999;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    
    .cloud-summary-text {
      font-size: 16px;
      color: #333;
      line-height: 1.5;
    }
    
    .cloud-summary-en {
      font-size: 13px;
      color: #666;
      margin-top: 4px;
    }
    
    .cta-button {
      display: block;
      width: 100%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      text-decoration: none;
      padding: 16px;
      border-radius: 12px;
      font-size: 16px;
      font-weight: 600;
      margin-top: 24px;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    
    .cta-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(102, 126, 234, 0.4);
    }
    
    .cta-sub {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.8);
      margin-top: 4px;
      font-weight: 400;
    }
    
    .footer {
      margin-top: 24px;
      font-size: 12px;
      color: #999;
    }
    
    @media (max-width: 480px) {
      .card {
        padding: 32px 24px;
      }
      
      .location {
        font-size: 20px;
      }
      
      .score-circle {
        width: 120px;
        height: 120px;
      }
      
      .score-value {
        font-size: 40px;
      }
      
      .quality-label {
        font-size: 24px;
      }
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand">霞客</div>
    <div class="brand-en">Xiake Sunset Predictor</div>
    
    <div class="location">${locationDisplay}</div>
    <div class="location-en">${latNum.toFixed(4)}°N, ${lonNum.toFixed(4)}°E</div>
    
    <div class="period-badge">${periodLabel} · ${periodLabelEn}</div>
    
    <div class="score-section">
      <div class="score-circle">
        <div class="score-value">${score}</div>
        <div class="score-label">预测评分 / Score</div>
      </div>
      <div class="quality-label">${qualityConfig.label}</div>
      <div class="quality-label-en">${qualityConfig.labelEn}</div>
    </div>
    
    <div class="cloud-summary">
      <div class="cloud-summary-title">云层分析 / Cloud Analysis</div>
      <div class="cloud-summary-text">${cloudSummary.zh}</div>
      <div class="cloud-summary-en">${cloudSummary.en}</div>
    </div>
    
    <a href="https://sunset.bjhyc.online" class="cta-button" target="_blank" rel="noopener">
      打开完整版
      <div class="cta-sub">Open Full Version</div>
    </a>
    
    <div class="footer">${dateStr} · sunset.bjhyc.online</div>
  </div>
</body>
</html>`;
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
    
  } catch (error) {
    console.error('[ShareRoute] Error:', error);
    res.status(500).send('Server error');
  }
});

module.exports = router;
