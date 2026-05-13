import {
  formatDate,
  formatDistance,
  formatPercent,
  formatQuality,
  formatScore,
  formatVisibility
} from '../../../miniprogram/utils/format.js';

describe('miniprogram utils/format', () => {
  test('formatScore rounds finite numbers', () => {
    expect(formatScore(82.6)).toBe('83分');
    expect(formatScore(null)).toBe('--');
  });

  test('formatQuality translates known quality levels', () => {
    expect(formatQuality('excellent')).toBe('极佳');
    expect(formatQuality('custom')).toBe('custom');
    expect(formatQuality()).toBe('--');
  });

  test('formatDate returns compact date time or placeholder', () => {
    expect(formatDate('2026-05-11T10:30:00Z', 'en-CA')).toContain('05');
    expect(formatDate('bad-date')).toBe('--');
  });

  test('formatPercent supports ratios and percentage values', () => {
    expect(formatPercent(0.45)).toBe('45%');
    expect(formatPercent(45)).toBe('45%');
    expect(formatPercent(undefined)).toBe('--');
  });

  test('formatDistance and formatVisibility render metric distances', () => {
    expect(formatDistance(0.8)).toBe('800m');
    expect(formatDistance(12.2)).toBe('12km');
    expect(formatVisibility(8.45)).toBe('8.4km');
    expect(formatVisibility(18.2)).toBe('18km');
  });
});
