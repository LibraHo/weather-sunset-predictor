/**
 * Initialize home view switcher (Forecast / Methodology).
 *
 * Supports two modes depending on which DOM elements are present:
 *
 * **Dropdown menu mode** (current UI, 需求26 Phase 10):
 * - `#home-view-menu-btn`   — toggle button (☰ icon)
 * - `#home-view-menu-dropdown` — dropdown container
 * - `.home-view-option[data-view]` — individual menu options
 *
 * **Legacy tab mode** (backward-compatible):
 * - `#tab-forecast` / `#tab-methodology` — tab buttons
 * - Keyboard: ← → to move focus, Enter/Space to activate
 *
 * Both modes control shared home panels:
 * - `#tab-panel-forecast`    — default visible panel
 * - `#tab-panel-methodology` — hidden by default
 * - `#tab-panel-map` / `#tab-panel-gallery` / `#tab-panel-feedback` / `#tab-panel-api` when present
 *
 * @param {Document} [documentRef=document] - Document reference (injectable for testing)
 * @returns {void}
 *
 * @example
 * // Standard usage in app.js
 * import initializeHomeTabs from './utils/HomeTabs.js';
 * initializeHomeTabs();
 *
 * @example
 * // Testing with injected jsdom document
 * initializeHomeTabs(document);
 */
export function initializeHomeTabs(documentRef = document, onMapVisible = null) {
  const forecastPanel = documentRef.getElementById('tab-panel-forecast');
  const methodologyPanel = documentRef.getElementById('tab-panel-methodology');

  if (!forecastPanel || !methodologyPanel) {
    return;
  }

  const mapPanel = documentRef.getElementById('tab-panel-map');
  const simulatorPanel = documentRef.getElementById('tab-panel-simulator');
  const galleryPanel = documentRef.getElementById('tab-panel-gallery');
  const userPanel = documentRef.getElementById('tab-panel-user');
  const feedbackPanel = documentRef.getElementById('tab-panel-feedback');
  const apiPanel = documentRef.getElementById('tab-panel-api');

  const tabForecast = documentRef.getElementById('tab-forecast');
  const tabMethodology = documentRef.getElementById('tab-methodology');
  const menuButton = documentRef.getElementById('home-view-menu-btn');
  const menuDropdown = documentRef.getElementById('home-view-menu-dropdown');
  const menuOptions = Array.from(documentRef.querySelectorAll('.home-view-option[data-view]'));

  const allPanels = [
    { id: 'forecast', el: forecastPanel },
    ...(simulatorPanel ? [{ id: 'simulator', el: simulatorPanel }] : []),
    { id: 'methodology', el: methodologyPanel },
    ...(mapPanel ? [{ id: 'map', el: mapPanel }] : []),
    ...(galleryPanel ? [{ id: 'gallery', el: galleryPanel }] : []),
    ...(userPanel ? [{ id: 'user', el: userPanel }] : []),
    ...(feedbackPanel ? [{ id: 'feedback', el: feedbackPanel }] : []),
    ...(apiPanel ? [{ id: 'api', el: apiPanel }] : []),
  ];

  const getInitialView = () => {
    const viewIds = new Set(allPanels.map(panel => panel.id));
    const win = documentRef.defaultView;
    const hash = win?.location?.hash ? win.location.hash.replace(/^#/, '') : '';
    const queryView = (() => {
      try { return new URLSearchParams(win?.location?.search || '').get('view'); }
      catch (_) { return null; }
    })();
    if (viewIds.has(hash)) return hash;
    if (viewIds.has(queryView)) return queryView;
    return 'forecast';
  };

  const setActiveView = (view) => {
    // 显示/隐藏所有已知 panels
    allPanels.forEach(({ id, el }) => {
      const show = id === view;
      el.classList.toggle('hidden', !show);
      el.hidden = !show;
    });

    // 兼容旧 tab 按钮
    if (tabForecast && tabMethodology) {
      const showForecast = view === 'forecast';
      tabForecast.classList.toggle('active', showForecast);
      tabMethodology.classList.toggle('active', !showForecast);
      tabForecast.setAttribute('aria-selected', String(showForecast));
      tabMethodology.setAttribute('aria-selected', String(!showForecast));
      tabForecast.tabIndex = showForecast ? 0 : -1;
      tabMethodology.tabIndex = showForecast ? -1 : 0;
    }

    if (menuOptions.length > 0) {
      menuOptions.forEach((option) => {
        const active = option.dataset.view === view;
        option.classList.toggle('active', active);
        option.setAttribute('aria-checked', String(active));
      });
    }

    // 通知地图页激活
    if (view === 'map' && typeof onMapVisible === 'function') {
      onMapVisible();
    }
  };

  setActiveView(getInitialView());

  if (tabForecast && tabMethodology) {
    const tabs = [tabForecast, tabMethodology];
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => setActiveView(tab.dataset.tab));
      tab.addEventListener('keydown', (event) => {
        const idx = tabs.indexOf(tab);
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          tabs[(idx + 1) % tabs.length].focus();
        } else if (event.key === 'ArrowLeft') {
          event.preventDefault();
          tabs[(idx - 1 + tabs.length) % tabs.length].focus();
        } else if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          setActiveView(tab.dataset.tab);
        }
      });
    });
  }

  if (menuButton && menuDropdown && menuOptions.length > 0) {
    const closeMenu = () => {
      menuDropdown.classList.add('hidden');
      menuButton.setAttribute('aria-expanded', 'false');
    };

    const openMenu = () => {
      menuDropdown.classList.remove('hidden');
      menuButton.setAttribute('aria-expanded', 'true');
    };

    menuButton.addEventListener('click', () => {
      const isHidden = menuDropdown.classList.contains('hidden');
      if (isHidden) openMenu();
      else closeMenu();
    });

    menuOptions.forEach((option) => {
      option.addEventListener('click', () => {
        setActiveView(option.dataset.view);
        closeMenu();
      });
    });

    documentRef.addEventListener('click', (event) => {
      if (!menuDropdown.contains(event.target) && !menuButton.contains(event.target)) {
        closeMenu();
      }
    });

    menuButton.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeMenu();
      }
    });
  }
}

export default initializeHomeTabs;
