import { initializeHomeTabs } from '../../../src/utils/HomeTabs.js';

describe('initializeHomeTabs - dropdown menu mode', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <button id="home-view-menu-btn" aria-expanded="false"></button>
      <div id="home-view-menu-dropdown" class="hidden">
        <button class="home-view-option" data-view="forecast"></button>
        <button class="home-view-option" data-view="methodology"></button>
      </div>
      <div id="tab-panel-forecast" role="tabpanel"></div>
      <section id="tab-panel-methodology" role="tabpanel" class="hidden" hidden></section>
    `;
  });

  test('initializes with forecast active', () => {
    initializeHomeTabs(document);

    expect(document.getElementById('tab-panel-forecast').hidden).toBe(false);
    expect(document.getElementById('tab-panel-methodology').hidden).toBe(true);
  });

  test('menu click switches to methodology and closes dropdown', () => {
    initializeHomeTabs(document);

    const menuBtn = document.getElementById('home-view-menu-btn');
    const menu = document.getElementById('home-view-menu-dropdown');
    menuBtn.click();
    expect(menu.classList.contains('hidden')).toBe(false);

    document.querySelector('.home-view-option[data-view="methodology"]').click();

    expect(document.getElementById('tab-panel-forecast').hidden).toBe(true);
    expect(document.getElementById('tab-panel-methodology').hidden).toBe(false);
    expect(menu.classList.contains('hidden')).toBe(true);
  });
});

describe('initializeHomeTabs - legacy tab mode', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div class="home-tabs" role="tablist">
        <button id="tab-forecast" class="home-tab-btn" data-tab="forecast" role="tab"></button>
        <button id="tab-methodology" class="home-tab-btn" data-tab="methodology" role="tab"></button>
      </div>
      <div id="tab-panel-forecast" role="tabpanel"></div>
      <section id="tab-panel-methodology" role="tabpanel" class="hidden" hidden></section>
    `;
  });

  test('click switches to methodology tab', () => {
    initializeHomeTabs(document);

    document.getElementById('tab-methodology').click();

    expect(document.getElementById('tab-methodology').getAttribute('aria-selected')).toBe('true');
    expect(document.getElementById('tab-panel-methodology').hidden).toBe(false);
  });

  test('returns safely when required panels are missing', () => {
    document.body.innerHTML = '<div>no panels</div>';
    expect(() => initializeHomeTabs(document)).not.toThrow();
  });
});
