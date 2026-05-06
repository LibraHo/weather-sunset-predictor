import ChinaMapCanvas, { selectCitiesForZoom } from '../../../src/components/ChinaMapCanvas.js';
import { MAP_CITY_NAME_I18N, getLocalizedMapCityName } from '../../../src/data/mapCityNames.js';

const level1 = [
  { name: '北京' }, { name: '上海' }, { name: '广州' }, { name: '深圳' },
  { name: '成都' }, { name: '重庆' }, { name: '武汉' }, { name: '西安' },
  { name: '杭州' }, { name: '南京' }, { name: '长沙' }, { name: '昆明' },
  { name: '台北' }, { name: '首尔' }, { name: '东京' }, { name: '大阪' },
  { name: '曼谷' }, { name: '河内' }, { name: '胡志明市' }, { name: '金边' },
  { name: '万象' }, { name: '仰光' }, { name: '吉隆坡' }, { name: '雅加达' }
];
const level2 = [{ name: '苏州' }, { name: '宁波' }];
const level3 = [{ name: '义乌' }];

describe('ChinaMapCanvas city data coverage', () => {
  it('includes major Southeast Asia city labels for basemap only', () => {
    const data = new ChinaMapCanvas()._getCityData();
    const names = new Set([...data.level1, ...data.level2, ...data.level3].map(city => city.name));

    [
      '曼谷', '河内', '胡志明市', '金边', '万象', '仰光', '吉隆坡', '雅加达',
      '清迈', '普吉', '岘港', '暹粒', '曼德勒', '内比都', '槟城', '新山',
      '哥打基纳巴卢', '泗水', '万隆', '棉兰', '登巴萨'
    ].forEach((name) => {
      expect(names.has(name)).toBe(true);
    });
  });

  it('has zh-TW and English labels for every map city name', () => {
    const data = new ChinaMapCanvas()._getCityData();
    const names = [...data.level1, ...data.level2, ...data.level3].map(city => city.name);

    names.forEach((name) => {
      expect(MAP_CITY_NAME_I18N[name]?.zhTW).toBeTruthy();
      expect(MAP_CITY_NAME_I18N[name]?.en).toBeTruthy();
    });
  });

  it('localizes place names by language policy', () => {
    expect(getLocalizedMapCityName('武汉', 'zh-CN')).toBe('武汉');
    expect(getLocalizedMapCityName('武汉', 'zh-TW')).toBe('武漢');
    expect(getLocalizedMapCityName('武汉', 'en-US')).toBe('Wuhan');
    expect(getLocalizedMapCityName('武汉', 'ja-JP')).toBe('Wuhan');
    expect(getLocalizedMapCityName('东京', 'ja-JP')).toBe('東京');
    expect(getLocalizedMapCityName('首尔', 'ko-KR')).toBe('서울');
    expect(getLocalizedMapCityName('曼谷', 'fr-FR')).toBe('Bangkok');
  });
});

describe('ChinaMapCanvas mobile city label selection', () => {
  it('limits very low-zoom mobile labels to China core cities only', () => {
    const cities = selectCitiesForZoom({ level1, level2, level3 }, 4.5, true);
    expect(cities.map(c => c.name)).toEqual(['北京', '上海', '广州', '深圳', '成都', '重庆', '武汉', '西安', '杭州', '南京']);
  });

  it('adds regional capitals on mobile before showing all level1 labels', () => {
    const cities = selectCitiesForZoom({ level1, level2, level3 }, 5.5, true);
    expect(cities.map(c => c.name)).toContain('曼谷');
    expect(cities.map(c => c.name)).toContain('雅加达');
    expect(cities.map(c => c.name)).not.toContain('长沙');
  });

  it('uses less restrictive density on desktop than mobile at the same zoom', () => {
    const mobile = selectCitiesForZoom({ level1, level2, level3 }, 6.8, true);
    const desktop = selectCitiesForZoom({ level1, level2, level3 }, 6.8, false);
    expect(mobile).toHaveLength(level1.length);
    expect(desktop).toHaveLength(level1.length);
    expect(selectCitiesForZoom({ level1, level2, level3 }, 4.5, false)).toHaveLength(22);
  });

  it('delays dense mobile labels until higher zoom than desktop', () => {
    expect(selectCitiesForZoom({ level1, level2, level3 }, 8, true)).toHaveLength(level1.length);
    expect(selectCitiesForZoom({ level1, level2, level3 }, 9, true)).toHaveLength(level1.length + level2.length);
    expect(selectCitiesForZoom({ level1, level2, level3 }, 10, true)).toHaveLength(level1.length + level2.length);
    expect(selectCitiesForZoom({ level1, level2, level3 }, 11, true)).toHaveLength(level1.length + level2.length + level3.length);

    expect(selectCitiesForZoom({ level1, level2, level3 }, 7.5, false)).toHaveLength(level1.length + level2.length);
    expect(selectCitiesForZoom({ level1, level2, level3 }, 10, false)).toHaveLength(level1.length + level2.length + level3.length);
  });
});
