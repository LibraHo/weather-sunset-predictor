import { jest } from '@jest/globals';
import initializeHomeTabs from '../../../src/utils/HomeTabs.js';

describe('HomeTabs map panel activation', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <button id="home-view-menu-btn"></button>
      <div id="home-view-menu-dropdown">
        <button class="home-view-option" data-view="forecast"></button>
        <button class="home-view-option" data-view="map"></button>
      </div>
      <section id="tab-panel-forecast"></section>
      <section id="tab-panel-methodology"></section>
      <section id="tab-panel-map" class="hidden" hidden></section>
    `;
  });

  test('calls map visible callback whenever map menu is opened', () => {
    const onMapVisible = jest.fn();
    initializeHomeTabs(document, onMapVisible);

    document.querySelector('.home-view-option[data-view="map"]').click();

    expect(onMapVisible).toHaveBeenCalledTimes(1);
    expect(document.getElementById('tab-panel-map').hidden).toBe(false);
    expect(document.getElementById('tab-panel-map').classList.contains('hidden')).toBe(false);
  });
});
