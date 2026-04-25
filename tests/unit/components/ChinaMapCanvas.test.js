import { selectCitiesForZoom } from '../../../src/components/ChinaMapCanvas.js';

const level1 = [
  { name: '北京' }, { name: '上海' }, { name: '广州' }, { name: '深圳' },
  { name: '成都' }, { name: '重庆' }, { name: '武汉' }, { name: '西安' },
  { name: '杭州' }, { name: '南京' }, { name: '长沙' }, { name: '昆明' }
];
const level2 = [{ name: '苏州' }, { name: '宁波' }];
const level3 = [{ name: '义乌' }];

describe('ChinaMapCanvas mobile city label selection', () => {
  it('limits low-zoom mobile labels to core cities', () => {
    const cities = selectCitiesForZoom({ level1, level2, level3 }, 5, true);
    expect(cities.map(c => c.name)).toEqual(['北京', '上海', '广州', '深圳', '成都', '重庆', '武汉', '西安', '杭州', '南京']);
  });

  it('keeps desktop low-zoom labels unchanged', () => {
    expect(selectCitiesForZoom({ level1, level2, level3 }, 5, false)).toHaveLength(level1.length);
  });

  it('delays dense mobile labels until higher zoom', () => {
    expect(selectCitiesForZoom({ level1, level2, level3 }, 7, true)).toHaveLength(level1.length);
    expect(selectCitiesForZoom({ level1, level2, level3 }, 9, true)).toHaveLength(level1.length + level2.length);
    expect(selectCitiesForZoom({ level1, level2, level3 }, 10, true)).toHaveLength(level1.length + level2.length + level3.length);
  });
});
