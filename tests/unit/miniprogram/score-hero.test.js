import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.resolve(process.cwd(), 'miniprogram/components/score-hero/index.js'), 'utf8');
const wxml = fs.readFileSync(path.resolve(process.cwd(), 'miniprogram/components/score-hero/index.wxml'), 'utf8');
const wxss = fs.readFileSync(path.resolve(process.cwd(), 'miniprogram/components/score-hero/index.wxss'), 'utf8');
const homeWxml = fs.readFileSync(path.resolve(process.cwd(), 'miniprogram/pages/home/index.wxml'), 'utf8');
const homeJs = fs.readFileSync(path.resolve(process.cwd(), 'miniprogram/pages/home/index.js'), 'utf8');

describe('miniprogram score hero scoring copy', () => {
  test('uses website score bands for firecloud grades', () => {
    expect(source).toContain('if (score >= 85) return \'excellent\';');
    expect(source).toContain('if (score >= 70) return \'good\';');
    expect(source).toContain('if (score >= 40) return \'fair\';');
    expect(source).not.toContain('if (score >= 80) return \'excellent\';');
    expect(source).not.toContain('if (score >= 65) return \'good\';');
    expect(source).not.toContain('if (score >= 45) return \'fair\';');
  });

  test('uses website score colors for the score text', () => {
    expect(source).toContain('scoreClass:');
    expect(source).toContain('if (score >= 65) return \'score-good\';');
    expect(wxml).toContain('class="score {{scoreClass}}"');
    expect(wxss).toContain('#94a3b8');
    expect(wxss).toContain('#fdba74');
    expect(wxss).toContain('#ff9f43');
    expect(wxss).toContain('#fbbf24');
    expect(wxss).toContain('#f43f5e');
    expect(wxss).toContain('linear-gradient(135deg, #fb923c 0%, #fbbf24 55%, #f43f5e 100%)');
  });

  test('keeps low score copy focused on firecloud conditions instead of going out', () => {
    expect(source).toContain("low: '偏弱'");
    expect(homeWxml).toContain('先看火烧云条件，再安排观赏。');
    expect(homeWxml).not.toContain('要不要出门');
    expect(homeJs).toContain('建议结合实时天气、视野和临近时段云况判断。');
    expect(homeJs).not.toContain('再决定是否出门');
  });
});
