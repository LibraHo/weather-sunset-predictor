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
 * Both modes control two panels:
 * - `#tab-panel-forecast`    — default visible panel
 * - `#tab-panel-methodology` — hidden by default
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
export function initializeHomeTabs(documentRef = document) {
  const forecastPanel = documentRef.getElementById('tab-panel-forecast');
  const methodologyPanel = documentRef.getElementById('tab-panel-methodology');

  if (!forecastPanel || !methodologyPanel) {
    return;
  }

  const tabForecast = documentRef.getElementById('tab-forecast');
  const tabMethodology = documentRef.getElementById('tab-methodology');
  const menuButton = documentRef.getElementById('home-view-menu-btn');
  const menuDropdown = documentRef.getElementById('home-view-menu-dropdown');
  const menuOptions = Array.from(documentRef.querySelectorAll('.home-view-option'));

  const setActiveView = (view) => {
    const showForecast = view === 'forecast';

    forecastPanel.classList.toggle('hidden', !showForecast);
    methodologyPanel.classList.toggle('hidden', showForecast);
    forecastPanel.hidden = !showForecast;
    methodologyPanel.hidden = showForecast;

    if (tabForecast && tabMethodology) {
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
  };

  setActiveView('forecast');

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
