// Windy API 气压数据可能需要转换
// 常见气压单位：
// - Pa（帕斯卡）: 标准大气压约 101325 Pa
// - hPa（百帕）: 标准大气压约 1013 hPa
// - mbar（毫巴）: 标准大气压约 1013 mbar

// 如果API返回的是Pa，需要除以100转换为hPa
// 如果API返回的已经是hPa，则直接使用

// 检查逻辑：
function checkPressureUnit(pressureValue) {
  if (pressureValue > 10000) {
    // 可能是Pa为单位，需要转换为hPa
    return pressureValue / 100;
  }
  return pressureValue;
}

// 示例：
// 101325 Pa -> 1013.25 hPa ✓
// 1013 hPa -> 1013 hPa ✓
console.log('Pa转hPa:', checkPressureUnit(101325));
console.log('hPa保持:', checkPressureUnit(1013));
