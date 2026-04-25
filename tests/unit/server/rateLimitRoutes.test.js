import fs from 'fs';

describe('server route rate limiter ordering', () => {
  test('geocoding route is mounted before global /api limiter', () => {
    const source = fs.readFileSync('server/index.js', 'utf8');
    const geocodingIdx = source.indexOf("app.use('/api/geocoding', geocodingLimiter, geocodingRoutes)");
    const apiLimiterIdx = source.indexOf("app.use('/api/', apiLimiter)");

    expect(geocodingIdx).toBeGreaterThan(-1);
    expect(apiLimiterIdx).toBeGreaterThan(-1);
    expect(geocodingIdx).toBeLessThan(apiLimiterIdx);
  });

  test('geocoding limiter has dedicated error code', () => {
    const source = fs.readFileSync('server/index.js', 'utf8');
    expect(source).toContain('GEOCODING_RATE_LIMIT');
    expect(source).toContain('GEOCODING_RATE_LIMIT_MAX_REQUESTS');
  });
});
