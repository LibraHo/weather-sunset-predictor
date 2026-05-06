import { initializeHomeTabs } from '../../../src/utils/HomeTabs.js';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function buildDropdownDOM() {
  document.body.innerHTML = `
    <div class="home-view-menu">
      <button id="home-view-menu-btn" aria-expanded="false"></button>
      <div id="home-view-menu-dropdown" class="hidden" role="menu">
        <button class="home-view-option active" data-view="forecast" aria-checked="true"></button>
        <button class="home-view-option" data-view="methodology" aria-checked="false"></button>
      </div>
    </div>
    <div id="tab-panel-forecast" role="tabpanel"></div>
    <section id="tab-panel-methodology" role="tabpanel" class="hidden" hidden></section>
  `;
}

function buildLegacyTabDOM() {
  document.body.innerHTML = `
    <div class="home-tabs" role="tablist">
      <button id="tab-forecast" class="home-tab-btn active" data-tab="forecast"
              role="tab" aria-selected="true" tabindex="0"></button>
      <button id="tab-methodology" class="home-tab-btn" data-tab="methodology"
              role="tab" aria-selected="false" tabindex="-1"></button>
    </div>
    <div id="tab-panel-forecast" role="tabpanel"></div>
    <section id="tab-panel-methodology" role="tabpanel" class="hidden" hidden></section>
  `;
}

// ─────────────────────────────────────────────
// Suite 1: dropdown menu mode
// ─────────────────────────────────────────────

describe('initializeHomeTabs - dropdown menu mode', () => {
  beforeEach(buildDropdownDOM);

  test('initializes with forecast panel visible', () => {
    initializeHomeTabs(document);

    expect(document.getElementById('tab-panel-forecast').hidden).toBe(false);
    expect(document.getElementById('tab-panel-methodology').hidden).toBe(true);
  });

  test('menu button toggles dropdown open/closed', () => {
    initializeHomeTabs(document);
    const btn = document.getElementById('home-view-menu-btn');
    const menu = document.getElementById('home-view-menu-dropdown');

    btn.click();
    expect(menu.classList.contains('hidden')).toBe(false);
    expect(btn.getAttribute('aria-expanded')).toBe('true');

    btn.click();
    expect(menu.classList.contains('hidden')).toBe(true);
    expect(btn.getAttribute('aria-expanded')).toBe('false');
  });

  test('clicking methodology option switches view and closes menu', () => {
    initializeHomeTabs(document);
    const btn = document.getElementById('home-view-menu-btn');
    const menu = document.getElementById('home-view-menu-dropdown');
    btn.click(); // open

    document.querySelector('.home-view-option[data-view="methodology"]').click();

    expect(document.getElementById('tab-panel-forecast').hidden).toBe(true);
    expect(document.getElementById('tab-panel-methodology').hidden).toBe(false);
    expect(menu.classList.contains('hidden')).toBe(true);
    expect(btn.getAttribute('aria-expanded')).toBe('false');
  });

  test('clicking forecast option switches back to forecast view', () => {
    initializeHomeTabs(document);
    document.getElementById('home-view-menu-btn').click();
    document.querySelector('.home-view-option[data-view="methodology"]').click();

    document.getElementById('home-view-menu-btn').click();
    document.querySelector('.home-view-option[data-view="forecast"]').click();

    expect(document.getElementById('tab-panel-forecast').hidden).toBe(false);
    expect(document.getElementById('tab-panel-methodology').hidden).toBe(true);
  });

  test('supports API panel from the shared Home Menu and initial #api hash', () => {
    document.body.innerHTML = `
      <div class="home-view-menu">
        <button id="home-view-menu-btn" aria-expanded="false"></button>
        <div id="home-view-menu-dropdown" class="hidden" role="menu">
          <button class="home-view-option active" data-view="forecast" aria-checked="true"></button>
          <button class="home-view-option" data-view="methodology" aria-checked="false"></button>
          <button class="home-view-option" data-view="api" aria-checked="false"></button>
        </div>
      </div>
      <div id="tab-panel-forecast" role="tabpanel"></div>
      <section id="tab-panel-methodology" role="tabpanel" class="hidden" hidden></section>
      <section id="tab-panel-api" role="tabpanel" class="hidden" hidden></section>
    `;
    window.history.replaceState(null, '', '#api');

    initializeHomeTabs(document);

    expect(document.getElementById('tab-panel-forecast').hidden).toBe(true);
    expect(document.getElementById('tab-panel-methodology').hidden).toBe(true);
    expect(document.getElementById('tab-panel-api').hidden).toBe(false);
    expect(document.querySelector('.home-view-option[data-view="api"]').getAttribute('aria-checked')).toBe('true');

    window.history.replaceState(null, '', '/');
  });

  test('aria-checked is updated on menu options', () => {
    initializeHomeTabs(document);
    document.getElementById('home-view-menu-btn').click();
    document.querySelector('.home-view-option[data-view="methodology"]').click();

    const forecastOpt = document.querySelector('.home-view-option[data-view="forecast"]');
    const methodologyOpt = document.querySelector('.home-view-option[data-view="methodology"]');
    expect(forecastOpt.getAttribute('aria-checked')).toBe('false');
    expect(methodologyOpt.getAttribute('aria-checked')).toBe('true');
  });

  test('clicking outside the menu closes the dropdown', () => {
    initializeHomeTabs(document);
    const btn = document.getElementById('home-view-menu-btn');
    const menu = document.getElementById('home-view-menu-dropdown');
    btn.click(); // open

    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(menu.classList.contains('hidden')).toBe(true);
    expect(btn.getAttribute('aria-expanded')).toBe('false');
  });

  test('Escape key on menu button closes the dropdown', () => {
    initializeHomeTabs(document);
    const btn = document.getElementById('home-view-menu-btn');
    const menu = document.getElementById('home-view-menu-dropdown');
    btn.click(); // open

    btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(menu.classList.contains('hidden')).toBe(true);
    expect(btn.getAttribute('aria-expanded')).toBe('false');
  });

  test('non-Escape keys on menu button do not close dropdown', () => {
    initializeHomeTabs(document);
    const btn = document.getElementById('home-view-menu-btn');
    btn.click(); // open
    const menu = document.getElementById('home-view-menu-dropdown');

    btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));

    expect(menu.classList.contains('hidden')).toBe(false);
  });
});

// ─────────────────────────────────────────────
// Suite 2: legacy tab mode
// ─────────────────────────────────────────────

describe('initializeHomeTabs - legacy tab mode', () => {
  beforeEach(buildLegacyTabDOM);

  test('click switches to methodology tab and updates aria-selected', () => {
    initializeHomeTabs(document);

    document.getElementById('tab-methodology').click();

    expect(document.getElementById('tab-methodology').getAttribute('aria-selected')).toBe('true');
    expect(document.getElementById('tab-forecast').getAttribute('aria-selected')).toBe('false');
    expect(document.getElementById('tab-panel-methodology').hidden).toBe(false);
    expect(document.getElementById('tab-panel-forecast').hidden).toBe(true);
  });

  test('ArrowRight moves focus from forecast to methodology', () => {
    initializeHomeTabs(document);
    const methodologyTab = document.getElementById('tab-methodology');
    let focused = false;
    methodologyTab.focus = () => { focused = true; };

    document.getElementById('tab-forecast').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
    );

    expect(focused).toBe(true);
  });

  test('ArrowLeft wraps from forecast to methodology', () => {
    initializeHomeTabs(document);
    const methodologyTab = document.getElementById('tab-methodology');
    let focused = false;
    methodologyTab.focus = () => { focused = true; };

    document.getElementById('tab-forecast').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })
    );

    expect(focused).toBe(true);
  });

  test('ArrowRight wraps from methodology back to forecast', () => {
    initializeHomeTabs(document);
    const forecastTab = document.getElementById('tab-forecast');
    let focused = false;
    forecastTab.focus = () => { focused = true; };

    document.getElementById('tab-methodology').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
    );

    expect(focused).toBe(true);
  });

  test('Enter key activates the tab', () => {
    initializeHomeTabs(document);

    document.getElementById('tab-methodology').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    );

    expect(document.getElementById('tab-panel-methodology').hidden).toBe(false);
  });

  test('Space key activates the tab', () => {
    initializeHomeTabs(document);

    document.getElementById('tab-methodology').dispatchEvent(
      new KeyboardEvent('keydown', { key: ' ', bubbles: true })
    );

    expect(document.getElementById('tab-panel-methodology').hidden).toBe(false);
  });

  test('tabIndex is updated on active/inactive tabs', () => {
    initializeHomeTabs(document);
    document.getElementById('tab-methodology').click();

    expect(document.getElementById('tab-methodology').tabIndex).toBe(0);
    expect(document.getElementById('tab-forecast').tabIndex).toBe(-1);
  });
});

// ─────────────────────────────────────────────
// Suite 3: edge / safety cases
// ─────────────────────────────────────────────

describe('initializeHomeTabs - safety cases', () => {
  test('returns safely when panels are missing', () => {
    document.body.innerHTML = '<div>no panels here</div>';
    expect(() => initializeHomeTabs(document)).not.toThrow();
  });

  test('works without menu elements (panels-only mode)', () => {
    document.body.innerHTML = `
      <div id="tab-panel-forecast"></div>
      <section id="tab-panel-methodology" class="hidden" hidden></section>
    `;
    expect(() => initializeHomeTabs(document)).not.toThrow();
    expect(document.getElementById('tab-panel-forecast').hidden).toBe(false);
  });
});
