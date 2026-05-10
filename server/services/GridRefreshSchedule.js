'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const SCHEDULE_CONFIG_DIR = path.join(os.homedir(), '.xiake');
const SCHEDULE_CONFIG_PATH = path.join(SCHEDULE_CONFIG_DIR, 'schedule-config.json');

const DEFAULT_SCHEDULE = {
  enabled: true,
  jobs: [
    { time: '10:00', type: 'both', label: '上午刷新' },
    { time: '22:00', type: 'both', label: '晚间刷新' }
  ]
};

const VALID_TYPES = new Set(['sunrise', 'sunset', 'both']);

function cloneDefaultSchedule() {
  return {
    enabled: DEFAULT_SCHEDULE.enabled,
    jobs: DEFAULT_SCHEDULE.jobs.map(job => ({ ...job }))
  };
}

function normalizeScheduleConfig(config) {
  if (!config || !Array.isArray(config.jobs)) return cloneDefaultSchedule();

  const jobs = config.jobs
    .map((job) => ({
      time: typeof job.time === 'string' ? job.time.trim() : '',
      type: VALID_TYPES.has(job.type) ? job.type : 'both',
      label: typeof job.label === 'string' ? job.label.trim() : ''
    }))
    .filter(job => /^\d{2}:\d{2}$/.test(job.time));

  return {
    enabled: config.enabled !== false,
    jobs: jobs.length > 0 ? jobs : cloneDefaultSchedule().jobs
  };
}

function readScheduleConfig() {
  try {
    if (!fs.existsSync(SCHEDULE_CONFIG_PATH)) return cloneDefaultSchedule();
    const raw = fs.readFileSync(SCHEDULE_CONFIG_PATH, 'utf-8');
    return normalizeScheduleConfig(JSON.parse(raw));
  } catch (err) {
    console.warn('[ScheduleConfig] 读取配置失败:', err.message);
    return cloneDefaultSchedule();
  }
}

function writeScheduleConfig(config) {
  const normalized = normalizeScheduleConfig(config);
  if (!fs.existsSync(SCHEDULE_CONFIG_DIR)) {
    fs.mkdirSync(SCHEDULE_CONFIG_DIR, { recursive: true });
  }
  fs.writeFileSync(SCHEDULE_CONFIG_PATH, JSON.stringify(normalized, null, 2), 'utf-8');
  return normalized;
}

function getCstClock(date = new Date()) {
  const cstMs = date.getTime() + (8 * 60 * 60 * 1000);
  const cst = new Date(cstMs);
  return {
    day: cst.toISOString().slice(0, 10),
    time: `${String(cst.getUTCHours()).padStart(2, '0')}:${String(cst.getUTCMinutes()).padStart(2, '0')}`
  };
}

function expandJobPeriods(type = 'both') {
  if (type === 'sunrise') return ['sunrise'];
  if (type === 'sunset') return ['sunset'];
  return ['sunrise', 'sunset'];
}

function getDueScheduleJobs(config, date = new Date(), triggeredKeys = new Set()) {
  const schedule = normalizeScheduleConfig(config);
  if (!schedule.enabled) return [];

  const clock = getCstClock(date);
  return schedule.jobs
    .map((job, index) => ({ ...job, index }))
    .filter(job => job.time === clock.time)
    .filter((job) => !triggeredKeys.has(`${clock.day}_${job.time}_${job.type}_${job.index}`))
    .map(job => ({
      ...job,
      triggerKey: `${clock.day}_${job.time}_${job.type}_${job.index}`,
      periods: expandJobPeriods(job.type)
    }));
}

function describeSchedule(config) {
  const schedule = normalizeScheduleConfig(config);
  if (!schedule.enabled) return 'disabled';
  return schedule.jobs.map(job => `${job.time} ${job.type}`).join(', ');
}

module.exports = {
  DEFAULT_SCHEDULE,
  SCHEDULE_CONFIG_DIR,
  SCHEDULE_CONFIG_PATH,
  cloneDefaultSchedule,
  normalizeScheduleConfig,
  readScheduleConfig,
  writeScheduleConfig,
  getCstClock,
  expandJobPeriods,
  getDueScheduleJobs,
  describeSchedule
};
