import fs from 'fs';
import path from 'path';

const read = (relativePath) => fs.readFileSync(path.resolve(relativePath), 'utf8');

function extractParamButton(html, param) {
  const match = html.match(new RegExp(`<button[^>]*data-param="${param}"[\\s\\S]*?<\\/button>`));
  expect(match).not.toBeNull();
  return match[0];
}

describe('weather parameter selector icons', () => {
  test('web precipitation selector uses rain iconography instead of wave lines', () => {
    const precipButton = extractParamButton(read('index.html'), 'precip');

    expect(precipButton).toContain('M7 14.5h9.5');
    expect(precipButton).toContain('M8.5 17.2l-1 2.1');
    expect(precipButton).not.toContain('M3 18s2.5-4');
    expect(precipButton).not.toContain('M5 18c.8-1.5');
  });

  test('web wind selector uses wind gust iconography instead of an arrow target', () => {
    const windButton = extractParamButton(read('index.html'), 'wind');
    const pressureButton = extractParamButton(read('index.html'), 'pressure');

    expect(windButton).toContain('M4 8.4c3.1-2.5');
    expect(windButton).toContain('M3.5 13c3.2-1.8');
    expect(pressureButton).toContain('M5 17h14M5 9h14M7 13h10');
    expect(windButton).not.toContain('M5 17h14M5 9h14M7 13h10');
    expect(windButton).not.toContain('m14 8.5-3.5');
    expect(windButton).not.toContain('<circle cx="18" cy="12"');
  });

  test('mini-program weather parameter assets match the web rain and wind metaphors', () => {
    const precipIcon = read('miniprogram/assets/icons/weather-param-precipitation.svg');
    const windIcon = read('miniprogram/assets/icons/weather-param-wind.svg');

    expect(precipIcon).toContain('M7 14.5h9.5');
    expect(precipIcon).toContain('M8.5 17.2l-1 2.1');
    expect(precipIcon).not.toContain('M3 18s2.5-4');

    expect(windIcon).toContain('M4 8.4c3.1-2.5');
    expect(windIcon).toContain('M3.5 13c3.2-1.8');
    expect(windIcon).not.toContain('M5 17h14M5 9h14M7 13h10');
    expect(windIcon).not.toContain('m14 8.5-3.5');
    expect(windIcon).not.toContain('<circle cx="18" cy="12"');
  });
});
