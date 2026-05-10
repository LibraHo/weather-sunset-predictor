'use strict';

const ALGORITHM_VERSION = '2026.05.10-low-cloud-lightpath-v3';

const ALGORITHM_CHANGELOG = [
  {
    version: ALGORITHM_VERSION,
    date: '2026-05-10',
    title: 'Low-cloud-led light path',
    summary: 'Light-path scoring now treats low clouds as the main sunlight blocker. Dense mid/high clouds are handled as the color canvas unless low clouds dominate or rain is present.'
  }
];

module.exports = {
  ALGORITHM_VERSION,
  ALGORITHM_CHANGELOG
};
