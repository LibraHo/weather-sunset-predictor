/**
 * 双读对比脚本
 * 用于验证 Open-Meteo 和 Windy 两个数据源的预测数据是否一致。
 *
 * 用法：node dualReadComparison.js [lat] [lon]
 * 示例：node dualReadComparison.js 39.9 116.4
 */

import http from 'http';

// 后端服务地址
const BACKEND_URL = 'http://localhost:3000';

/**
 * 获取 Open-Meteo 数据
 */
async function fetchOpenMeteo(lat, lon) {
  console.log('[对比] 获取 Open-Meteo 数据...');
  
  const url = `${BACKEND_URL}/api/weather/forecast?lat=${lat}&lon=${lon}&hours=168`;
  const data = await fetchJSON(url);
  
  // 解析 providerMeta 获取数据源
  const provider = data.providerMeta?.name || 'unknown';
  const quality = data.providerMeta?.dataQuality || 'unknown';
  const latency = data.providerMeta?.latency || 0;
  
  return {
    provider,
    quality,
    latency,
    hours: data.hours,
    data: data.data
  };
}

/**
 * 获取 Windy 数据
 */
async function fetchWindy(lat, lon) {
  console.log('[对比] 获取 Windy 数据...');
  
  const url = `${BACKEND_URL}/api/weather/forecast?lat=${lat}&lon=${lon}&hours=168`;
  const headers = {
    'X-Windy-API-Key': 'test-windy-key-for-comparison'  // 使用测试 Key
  };
  
  const data = await fetchJSON(url, headers);
  
  const provider = data.providerMeta?.name || 'unknown';
  const quality = data.providerMeta?.dataQuality || 'unknown';
  const latency = data.providerMeta?.latency || 0;
  
  return {
    provider,
    quality,
    latency,
    hours: data.hours,
    data: data.data
  };
}

/**
 * 通用 JSON 请求函数
 */
function fetchJSON(url, headers = {}) {
  return new Promise((resolve, reject) => {
    http.get(url, { headers }, (res) => {
      let rawData = '';
      
      res.on('data', (chunk) => {
        rawData += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(rawData);
          
          if (jsonData.success) {
            resolve(jsonData);
          } else {
            reject(new Error(jsonData.error?.message || '请求失败'));
          }
        } catch (e) {
          reject(new Error(`JSON 解析失败: ${e.message}`));
        }
      });
    }).on('error', (e) => {
      reject(new Error(`HTTP 请求失败: ${e.message}`));
    });
  });
}

/**
 * 对比两个数据源
 */
function compareData(openMeteoData, windyData) {
  console.log('\n========== 对比结果 ==========');
  
  // 基本信息
  console.log(`Open-Meteo: ${openMeteoData.hours}h, 质量=${openMeteoData.quality}, 延迟=${openMeteoData.latency}ms`);
  console.log(`Windy:       ${windyData.hours}h, 质量=${windyData.quality}, 延迟=${windyData.latency}ms`);
  
  // 数据量
  const openMeteoLength = openMeteoData.data.length;
  const windyLength = windyData.data.length;
  const lengthDiff = Math.abs(openMeteoLength - windyLength);
  console.log(`\n数据量:`);
  console.log(`  Open-Meteo: ${openMeteoLength} 条`);
  console.log(`  Windy:       ${windyLength} 条`);
  console.log(`  差异:        ${lengthDiff} 条`);
  
  // 时间戳一致性检查
  console.log(`\n时间戳一致性:`);
  const timestampErrors = [];
  for (let i = 0; i < Math.min(openMeteoLength, windyLength); i++) {
    const openMeteoTs = openMeteoData.data[i]?.timestamp;
    const windyTs = windyData.data[i]?.timestamp;
    
    if (openMeteoTs && windyTs && Math.abs(openMeteoTs - windyTs) > 1000) {
      timestampErrors.push({
        index: i,
        openMeteo: new Date(openMeteoTs).toISOString(),
        windy: new Date(windyTs).toISOString(),
        diff: Math.abs(openMeteoTs - windyTs)
      });
    }
  }
  
  if (timestampErrors.length > 0) {
    console.log(`  ⚠️ 发现 ${timestampErrors.length} 处时间戳差异 > 1s`);
    timestampErrors.slice(0, 5).forEach(err => {
      console.log(`    索引 ${err.index}: Open-Meteo=${err.openMeteo}, Windy=${err.windy}, 差=${(err.diff/1000).toFixed(2)}s`);
    });
    if (timestampErrors.length > 5) {
      console.log(`    ... (共 ${timestampErrors.length} 处差异)`);
    }
  } else {
    console.log(`  ✅ 时间戳一致`);
  }
  
  // 数值差异分析（温度、湿度、云量）
  console.log(`\n数值差异分析 (前 24 小时):`);
  let tempSum = 0, humiditySum = 0, cloudSum = 0;
  
  for (let i = 0; i < Math.min(24, openMeteoLength, windyLength); i++) {
    const openMeteo = openMeteoData.data[i];
    const windy = windyData.data[i];
    
    if (openMeteo && windy) {
      const tempDiff = Math.abs(openMeteo.temp - windy.temp);
      const humidityDiff = Math.abs(openMeteo.humidity - windy.humidity);
      const cloudDiff = Math.abs(openMeteo.cloudCover - windy.cloudCover);
      
      tempSum += tempDiff;
      humiditySum += humidityDiff;
      cloudSum += cloudDiff;
    }
  }
  
  const tempAvg = (tempSum / 24).toFixed(2);
  const humidityAvg = (humiditySum / 24).toFixed(2);
  const cloudAvg = (cloudSum / 24).toFixed(2);
  
  console.log(`  温度差异均值: ${tempAvg}°C`);
  console.log(`  湿度差异均值: ${humidityAvg}%`);
  console.log(`  云量差异均值: ${cloudAvg}%`);
  
  // 质量差异
  console.log(`\n质量等级:`);
  console.log(`  Open-Meteo: ${openMeteoData.quality}`);
  console.log(`  Windy:       ${windyData.quality}`);
  if (openMeteoData.quality === windyData.quality) {
    console.log(`  ✅ 质量一致`);
  } else {
    console.log(`  ⚠️ 质量不一致`);
  }
  
  console.log('\n====================================');
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('用法: node dualReadComparison.js <lat> <lon>');
    console.error('示例: node dualReadComparison.js 39.9 116.4');
    process.exit(1);
  }
  
  const lat = parseFloat(args[0]);
  const lon = parseFloat(args[1]);
  
  if (isNaN(lat) || isNaN(lon)) {
    console.error('错误: 坐标必须是数字');
    process.exit(1);
  }
  
  try {
    console.log(`开始双读对比测试，位置: ${lat}, ${lon}\n`);
    
    const [openMeteoData, windyData] = await Promise.all([
      fetchOpenMeteo(lat, lon),
      fetchWindy(lat, lon)
    ]);
    
    compareData(openMeteoData, windyData);
    
  } catch (error) {
    console.error('对比测试失败:', error.message);
    process.exit(1);
  }
}

main();
