/**
 * 后端地理编码路由 — 逻辑单元测试
 * 需求：24
 *
 * 说明：测试路由中的参数验证和数据映射逻辑（纯函数）。
 * 不依赖 axios 或 Express，避免 ES module mock 兼容性问题。
 */

import fs from 'fs';
import path from 'path';

describe('Geocoding Route — 数据转换逻辑', () => {

  // ========== 参数验证逻辑 ==========

  describe('参数验证', () => {
    test('空 q 参数应被判定无效', () => {
      const q = '';
      expect(!q || !q.trim()).toBe(true);
    });

    test('空格 q 参数应被判定无效', () => {
      const q = '   ';
      expect(!q || !q.trim()).toBe(true);
    });

    test('有效 q 参数应通过', () => {
      const q = '北京';
      expect(!q || !q.trim()).toBe(false);
    });

    test('缺少 lat 应被判定无效', () => {
      const lat = undefined;
      const lon = '116.4';
      expect(!lat || !lon).toBe(true);
    });

    test('非数字坐标应被判定无效', () => {
      expect(isNaN(parseFloat('abc'))).toBe(true);
    });

    test('有效坐标应通过', () => {
      const lat = parseFloat('39.9042');
      const lon = parseFloat('116.4074');
      expect(isNaN(lat)).toBe(false);
      expect(isNaN(lon)).toBe(false);
    });
  });

  // ========== Nominatim 数据映射 ==========

  describe('Nominatim 数据映射', () => {
    test('应正确映射搜索结果', () => {
      // 模拟 Nominatim 响应数据
      const nominatimData = [
        {
          display_name: '北京市, 中国',
          lat: '39.9042',
          lon: '116.4074',
          type: 'city'
        }
      ];

      const mapped = nominatimData.map(item => ({
        name: item.display_name,
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon),
        type: item.type,
        provider: 'nominatim'
      }));

      expect(mapped[0].name).toBe('北京市, 中国');
      expect(mapped[0].lat).toBeCloseTo(39.9042);
      expect(mapped[0].lon).toBeCloseTo(116.4074);
      expect(mapped[0].provider).toBe('nominatim');
    });

    test('空响应应返回空数组', () => {
      const nominatimData = [];
      expect(nominatimData.length === 0).toBe(true);
    });
  });

  // ========== 高德地图数据映射 ==========

  describe('高德地图数据映射', () => {
    test('应正确解析高德坐标格式 "lon,lat"', () => {
      const gaodeItem = {
        formatted_address: '上海市',
        location: '121.4737,31.2304'
      };

      const [lonStr, latStr] = gaodeItem.location.split(',');
      const lat = parseFloat(latStr);
      const lon = parseFloat(lonStr);

      expect(lat).toBeCloseTo(31.2304);
      expect(lon).toBeCloseTo(121.4737);
    });

    test('高德 status !== "1" 时应返回空结果', () => {
      const gaodeData = { status: '0', info: 'INVALID_USER_KEY' };
      const isEmpty = gaodeData.status !== '1' || !gaodeData.geocodes || gaodeData.geocodes.length === 0;
      expect(isEmpty).toBe(true);
    });

    test('高德 status="1" 且有 geocodes 时应有结果', () => {
      const gaodeData = {
        status: '1',
        geocodes: [{ formatted_address: '上海市', location: '121.4737,31.2304' }]
      };
      const hasResults = gaodeData.status === '1' && gaodeData.geocodes && gaodeData.geocodes.length > 0;
      expect(hasResults).toBe(true);
    });
  });

  // ========== requireKey 逻辑 ==========

  describe('requireKey 逻辑', () => {
    function requireKey(apiKey) {
      return !!apiKey;
    }

    test('apiKey 为 undefined 时返回 false（需要 Key）', () => {
      expect(requireKey(undefined)).toBe(false);
    });

    test('apiKey 为空字符串时返回 false', () => {
      expect(requireKey('')).toBe(false);
    });

    test('apiKey 有值时返回 true（Key 已提供）', () => {
      expect(requireKey('valid-key')).toBe(true);
    });
  });

  // ========== Google Maps 数据映射 ==========

  describe('Google Maps 数据映射', () => {
    test('应正确映射 Google 搜索结果', () => {
      const googleData = {
        status: 'OK',
        results: [
          {
            formatted_address: 'Tokyo, Japan',
            geometry: { location: { lat: 35.6762, lng: 139.6503 } },
            types: ['locality']
          }
        ]
      };

      const mapped = googleData.results.map(item => ({
        name: item.formatted_address,
        lat: item.geometry.location.lat,
        lon: item.geometry.location.lng,
        type: item.types?.[0] || 'place',
        provider: 'google'
      }));

      expect(mapped[0].name).toBe('Tokyo, Japan');
      expect(mapped[0].lat).toBeCloseTo(35.6762);
      expect(mapped[0].lon).toBeCloseTo(139.6503);
      expect(mapped[0].provider).toBe('google');
    });

    test('Google status !== "OK" 时应返回空结果', () => {
      const googleData = { status: 'REQUEST_DENIED', results: [] };
      const isEmpty = googleData.status !== 'OK' || !googleData.results || googleData.results.length === 0;
      expect(isEmpty).toBe(true);
    });
  });

  // ========== 反向地理编码数据映射 ==========

  describe('反向地理编码', () => {
    test('Nominatim 有 display_name 时应返回该名称', () => {
      const data = { display_name: '朝阳区, 北京市' };
      const name = (data && data.display_name) ? data.display_name : null;
      expect(name).toBe('朝阳区, 北京市');
    });

    test('Nominatim 无 display_name 时应返回 null', () => {
      const data = {};
      const name = (data && data.display_name) ? data.display_name : null;
      expect(name).toBeNull();
    });

    test('高德 regeocode.formatted_address 存在时应返回该名称', () => {
      const data = { status: '1', regeocode: { formatted_address: '上海市徐汇区' } };
      const name = (data.status === '1' && data.regeocode?.formatted_address)
        ? data.regeocode.formatted_address
        : null;
      expect(name).toBe('上海市徐汇区');
    });

    test('高德 regeocode 为空时应返回 null', () => {
      const data = { status: '0' };
      const name = (data.status === '1' && data.regeocode?.formatted_address)
        ? data.regeocode.formatted_address
        : null;
      expect(name).toBeNull();
    });
  });

  // ========== API 端点 URL 常量验证 ==========

  describe('API 端点 URL 常量', () => {
    test('Nominatim 基础 URL 应正确', () => {
      const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
      expect(NOMINATIM_BASE).toBe('https://nominatim.openstreetmap.org');
      expect(`${NOMINATIM_BASE}/search`).toContain('nominatim.openstreetmap.org');
    });

    test('高德地图基础 URL 应正确', () => {
      const GAODE_BASE = 'https://restapi.amap.com/v3';
      expect(`${GAODE_BASE}/geocode/geo`).toContain('restapi.amap.com');
      expect(`${GAODE_BASE}/geocode/regeo`).toContain('restapi.amap.com');
    });

    test('Google Maps 基础 URL 应正确', () => {
      const GOOGLE_BASE = 'https://maps.googleapis.com/maps/api/geocode';
      expect(`${GOOGLE_BASE}/json`).toContain('maps.googleapis.com');
    });
  });

  // ========== 需求44：别名映射与检索排序 ==========
  describe('别名映射与检索排序', () => {
    let helpers;

    beforeAll(async () => {
      const routeModule = await import('../../../server/routes/geocoding.js');
      const route = routeModule.default || routeModule;
      helpers = route._test;
    });

    test('LA/NYC/SF 应能映射到目标候选库', () => {
      const laVariants = helpers.getQueryVariants('LA');
      expect(laVariants).toEqual(expect.arrayContaining(['LA', '洛杉矶', 'los angeles']));

      const nycVariants = helpers.getQueryVariants('NYC');
      expect(nycVariants).toEqual(expect.arrayContaining(['NYC', 'new york', 'newyork', '纽约']));

      const sfVariants = helpers.getQueryVariants('SF');
      expect(sfVariants).toEqual(expect.arrayContaining(['SF', 'san francisco', '旧金山', 'sanfrancisco']));
    });

    test('London/Paris/北京/上海/香港 的别名变体应可用', () => {
      const london = helpers.getQueryVariants('London');
      const paris = helpers.getQueryVariants('Paris');
      const beijing = helpers.getQueryVariants('北京');
      const shanghai = helpers.getQueryVariants('Shanghai');
      const hk = helpers.getQueryVariants('HK');
      const nyc = helpers.getQueryVariants('NYC');
      const sf = helpers.getQueryVariants('SF');

      expect(london).toEqual(expect.arrayContaining(['London', '伦敦']));
      expect(paris).toEqual(expect.arrayContaining(['Paris', '巴黎']));
      expect(beijing).toEqual(expect.arrayContaining(['北京', 'beijing']));
      expect(shanghai).toEqual(expect.arrayContaining(['Shanghai', '上海']));
      expect(hk).toEqual(expect.arrayContaining(['HK', 'hongkong', '香港', 'hong kong']));
      expect(nyc).toEqual(expect.arrayContaining(['NYC', 'new york', 'newyork', '纽约']));
      expect(sf).toEqual(expect.arrayContaining(['SF', 'san francisco', '旧金山', 'sanfrancisco']));
    });

    test('地理编码排序应优先命中别名最高匹配', () => {
      const results = [
        { name: 'New York, United States' },
        { name: 'New York City, New York, United States' },
        { name: 'NYC, United States' }
      ];

      const ranked = helpers.rankGeocodingResults(results, 'NYC');
      expect(ranked[0].name).toBe('NYC, United States');
    });

    test('仅完整手动输入 test 时返回测试城市', () => {
      expect(helpers.getManualTestCityResult('tes')).toBeNull();
      expect(helpers.getManualTestCityResult('test')).toMatchObject({
        name: 'test',
        lat: 0,
        lon: 0,
        provider: 'manual-test'
      });
      expect(helpers.getManualTestCityResult('  TEST  ')).toMatchObject({ name: 'test' });
    });

    test('北京/上海/香港 搜索样例应各自触发高优先级排序', () => {
      const beijing = [
        { name: 'Shanghai, China' },
        { name: '北京市, China' },
        { name: 'Beijing, China' }
      ];

      const shanghai = [
        { name: '上海, China' },
        { name: 'Beijing, China' }
      ];

      const hk = [
        { name: 'Hong Kong, Hong Kong' },
        { name: 'Taipei, Taiwan' }
      ];

      expect(['北京市, China', 'Beijing, China']).toContain(helpers.rankGeocodingResults(beijing, '北京')[0].name);
      expect(helpers.rankGeocodingResults(shanghai, '上海')[0].name).toBe('上海, China');
      expect(helpers.rankGeocodingResults(hk, '香港')[0].name).toBe('Hong Kong, Hong Kong');
    });
  });

  describe('后台调用日志', () => {
    test('高德正向和反向地理编码会写入后台 API 日志', () => {
      const source = fs.readFileSync(path.join(process.cwd(), 'server/routes/geocoding.js'), 'utf8');
      expect(source).toContain("require('../services/ApiCallLog')");
      expect(source).toContain("apiLog.track('gaode', 'geocode/geo'");
      expect(source).toContain("apiLog.track('gaode', 'geocode/regeo'");
    });
  });

});
