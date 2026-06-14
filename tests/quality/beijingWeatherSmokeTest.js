#!/usr/bin/env node
/**
 * 核心城市天气场景冒烟测试
 * 用法：node tests/quality/beijingWeatherSmokeTest.js [baseUrl]
 */

const baseUrl = process.argv[2] || 'http://127.0.0.1:3000';
const cities = [
  { name: 'Beijing', lat: 39.9042, lon: 116.4074 },
  { name: 'Shanghai', lat: 31.2304, lon: 121.4737 },
  { name: 'Guangzhou', lat: 23.1291, lon: 113.2644 },
  { name: 'Chengdu', lat: 30.5728, lon: 104.0668 },
  { name: 'Shenzhen', lat: 22.5431, lon: 114.0579 }
];

async function checkCity(city) {
  const url = `${baseUrl}/api/weather/forecast?lat=${city.lat}&lon=${city.lon}&hours=72`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${city.name}: HTTP ${res.status}`);
  const obj = await res.json();

  const arr = obj?.data || [];
  const meta = obj?.providerMeta || {};

  const required = ['timestamp', 'temp', 'humidity', 'cloudCover', 'windSpeed', 'pressure', 'visibility', 'precipitation'];
  let missing = 0;
  for (const x of arr) {
    for (const k of required) {
      if (!(k in x) || x[k] == null) missing++;
    }
  }

  const bins = { 晴: 0, 多云: 0, 阴: 0, 降水: 0 };
  for (const x of arr) {
    const p = x.precipitation || 0;
    const c = x.cloudCover || 0;
    if (p >= 0.1) bins['降水']++;
    else if (c < 20) bins['晴']++;
    else if (c < 70) bins['多云']++;
    else bins['阴']++;
  }

  const aodItems = arr.filter(x => x.aerosolOpticalDepth != null || x.aod != null || x.aerosol_optical_depth != null);
  const current = arr[0] || {};
  const currentAod = current.aerosolOpticalDepth ?? current.aod ?? current.aerosol_optical_depth ?? null;

  console.log(`== ${city.name} Weather Smoke Test ==`);
  console.log('providerMeta:', meta);
  console.log('hours:', arr.length);
  console.log('missingRequiredValues:', missing);
  console.log('aerosolCoverage:', `${aodItems.length}/${arr.length}`);
  console.log('currentAod:', currentAod);
  console.log('weatherBins:', bins);
  console.log('sample0:', arr[0]);

  if (!obj.success) throw new Error(`${city.name}: success=false`);
  if (arr.length < 24) throw new Error(`${city.name}: hourly data too short`);
  if (missing > 0) throw new Error(`${city.name}: missing required fields: ${missing}`);
  if (aodItems.length === 0) throw new Error(`${city.name}: missing aerosol/AOD data`);
  if (currentAod == null) throw new Error(`${city.name}: missing current aerosol/AOD display value`);
}

async function run() {
  for (const city of cities) {
    await checkCity(city);
  }

  console.log('RESULT: PASS');
}

run().catch((e) => {
  console.error('RESULT: FAIL', e.message);
  process.exit(1);
});
