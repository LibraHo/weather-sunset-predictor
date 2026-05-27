import {
  clusterPhotosByPixelDistance,
  getZoomDistance,
  preferredPhotoUrl
} from '../../src/utils/galleryPhotoClusters.js';

const photo = (id, lat, lon, extra = {}) => ({ id, lat, lon, uploadedAt: `2026-05-0${id}T12:00:00Z`, ...extra });

describe('gallery photo pixel clustering', () => {
  test('clusters nearby photos by projected pixel distance', () => {
    const clusters = clusterPhotosByPixelDistance([
      photo(1, 39.9, 116.4, { thumbUrl: '/thumb/1' }),
      photo(2, 39.901, 116.401, { thumbUrl: '/thumb/2' }),
      photo(3, 31.2, 121.5, { thumbUrl: '/thumb/3' })
    ], {
      zoom: 6,
      distance: 40,
      project: (p) => p.id === 3 ? { x: 400, y: 400 } : { x: 100 + p.id, y: 100 + p.id }
    });

    expect(clusters).toHaveLength(2);
    expect(clusters[0].isCluster).toBe(true);
    expect(clusters[0].count).toBe(2);
    expect(clusters[0].representative.id).toBe(2);
    expect(clusters[1].isCluster).toBe(false);
  });

  test('uses smaller clustering distance at high zoom', () => {
    expect(getZoomDistance(4)).toBeGreaterThan(getZoomDistance(12));
    expect(getZoomDistance(12)).toBeGreaterThan(getZoomDistance(14));
  });

  test('prefers thumbnails and does not fall back to private originals', () => {
    expect(preferredPhotoUrl({ id: 'abc', thumbUrl: '/api/photos/abc/thumb' })).toBe('/api/photos/abc/thumb');
    expect(preferredPhotoUrl({ id: 'abc', originalUrl: '/original/abc' })).toBe('');
    expect(preferredPhotoUrl({ id: 'abc' })).toBe('');
  });
});
