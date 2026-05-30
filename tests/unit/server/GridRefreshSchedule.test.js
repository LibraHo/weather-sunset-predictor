import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  cloneDefaultSchedule,
  expandJobPeriods,
  getCstClock,
  getDueScheduleJobs,
  normalizeScheduleConfig,
} = require('../../../server/services/GridRefreshSchedule.js');

describe('GridRefreshSchedule', () => {
  test('defaults to the configured separate sunrise and sunset refresh times', () => {
    expect(cloneDefaultSchedule()).toEqual({
      enabled: true,
      jobs: [
        { time: '08:00', type: 'sunrise', label: '朝霞早间刷新' },
        { time: '20:00', type: 'sunrise', label: '朝霞晚间刷新' },
        { time: '00:00', type: 'sunset', label: '晚霞夜间刷新' },
        { time: '12:00', type: 'sunset', label: '晚霞午间刷新' },
      ]
    });
  });

  test('checks exact HH:mm in China time instead of only the hour', () => {
    const config = {
      enabled: true,
      jobs: [{ time: '02:20', type: 'both', label: '夜间刷新' }]
    };

    expect(getCstClock(new Date('2026-05-10T18:19:00Z'))).toMatchObject({ time: '02:19' });
    expect(getDueScheduleJobs(config, new Date('2026-05-10T18:19:00Z'), new Set())).toHaveLength(0);

    const due = getDueScheduleJobs(config, new Date('2026-05-10T18:20:00Z'), new Set());
    expect(due).toHaveLength(1);
    expect(due[0]).toMatchObject({
      time: '02:20',
      type: 'both',
      periods: ['sunrise', 'sunset']
    });
  });

  test('uses job type to select sunrise, sunset, or both periods', () => {
    expect(expandJobPeriods('sunrise')).toEqual(['sunrise']);
    expect(expandJobPeriods('sunset')).toEqual(['sunset']);
    expect(expandJobPeriods('both')).toEqual(['sunrise', 'sunset']);
  });

  test('does not trigger the same job twice in the same day and minute', () => {
    const triggered = new Set();
    const [first] = getDueScheduleJobs(
      { enabled: true, jobs: [{ time: '02:20', type: 'sunrise' }] },
      new Date('2026-05-10T18:20:00Z'),
      triggered
    );
    expect(first.triggerKey).toBeTruthy();
    triggered.add(first.triggerKey);

    expect(getDueScheduleJobs(
      { enabled: true, jobs: [{ time: '02:20', type: 'sunrise' }] },
      new Date('2026-05-10T18:20:30Z'),
      triggered
    )).toHaveLength(0);
  });

  test('normalizes invalid schedule rows while keeping valid minute-level jobs', () => {
    const normalized = normalizeScheduleConfig({
      enabled: true,
      jobs: [
        { time: '02:20', type: 'sunrise', label: '朝霞' },
        { time: '2', type: 'sunset', label: 'invalid' },
        { time: '22:30', type: 'unknown', label: '默认 both' },
      ]
    });

    expect(normalized.jobs).toEqual([
      { time: '02:20', type: 'sunrise', label: '朝霞' },
      { time: '22:30', type: 'both', label: '默认 both' },
    ]);
  });
});
