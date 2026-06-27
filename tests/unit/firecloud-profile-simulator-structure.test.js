import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(process.cwd());

describe('firecloud profile simulator structure', () => {
  test('adds the simulator page to the home menu and document flow', () => {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const forecastMenu = html.indexOf('data-view="forecast"');
    const simulatorMenu = html.indexOf('data-view="simulator"');
    const methodologyMenu = html.indexOf('data-view="methodology"');
    const simulatorPanel = html.indexOf('id="tab-panel-simulator"');
    const mapPanel = html.indexOf('id="tab-panel-map"');

    expect(simulatorMenu).toBeGreaterThan(forecastMenu);
    expect(simulatorMenu).toBeLessThan(methodologyMenu);
    expect(simulatorPanel).toBeGreaterThan(-1);
    expect(simulatorPanel).toBeLessThan(mapPanel);
  });

  test('renders meter/kilometer controls and a cross-section canvas', () => {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const panel = html.slice(
      html.indexOf('id="tab-panel-simulator"'),
      html.indexOf('id="tab-panel-map"')
    );

    expect(panel).toContain('id="firecloud-profile-canvas"');
    expect(panel).toContain('id="profile-solar-time"');
    expect(panel).toContain('id="profile-axis-scale"');
    expect(panel).toContain('id="profile-view-mode"');
    expect(panel).toContain('value="log"');
    expect(panel).toContain('value="facingSun"');
    expect(panel).toContain('id="profile-selected-distance"');
    expect(panel).toContain('id="profile-selected-base-height"');
    expect(panel).toContain('id="profile-selected-top-height"');
    expect(panel).toContain('id="profile-selected-width"');
    expect(panel).toContain('id="profile-selected-optical-depth"');
    expect(panel).toContain('id="profile-selected-reason"');
    expect(panel).toContain('模拟规则说明');
    expect(panel).toContain('data-profile-cloud-list');
    expect(panel).toContain('km');
    expect(panel).toContain('m');
  });
});
