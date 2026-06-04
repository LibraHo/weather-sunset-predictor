import { jest } from '@jest/globals';

describe('FavoriteController account-aware storage', () => {
  let FavoriteController;

  beforeEach(async () => {
    jest.resetModules();
    document.body.innerHTML = '<ul id="favorite-list"></ul>';
    ({ default: FavoriteController } = await import('../../../src/controllers/FavoriteController.js'));
  });

  test('signed-out add list and delete stays on local storage service', () => {
    const localFavorites = [];
    const storageService = {
      saveFavoriteLocation: jest.fn((location) => {
        localFavorites.push(location);
        return true;
      }),
      getFavoriteLocations: jest.fn(() => localFavorites),
      removeFavoriteLocation: jest.fn((key) => {
        const index = localFavorites.findIndex((fav) => `${fav.lat}_${fav.lon}` === key);
        if (index === -1) return false;
        localFavorites.splice(index, 1);
        return true;
      })
    };
    const controller = new FavoriteController({
      storageService,
      i18n: { t: (key) => key },
      onSuccess: jest.fn(),
      onError: jest.fn(),
      onLocationChange: jest.fn()
    });

    const added = controller.addFavoriteLocation({ name: 'Beijing', lat: 39.9042, lon: 116.4074, isValid: () => true });

    expect(added).toBe(true);
    expect(storageService.saveFavoriteLocation).toHaveBeenCalledWith(expect.objectContaining({ name: 'Beijing' }));
    expect(document.getElementById('favorite-list').textContent).toContain('Beijing');

    document.querySelector('.btn-favorite-remove').click();
    expect(storageService.removeFavoriteLocation).toHaveBeenCalledWith('39.9042_116.4074');
    expect(document.getElementById('favorite-list').textContent).not.toContain('Beijing');
  });
});
