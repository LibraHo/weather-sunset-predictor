'use strict';

const ALGORITHM_VERSION = '2026.05.11-opening-upper-cloud-carrier-v1';

const ALGORITHM_CHANGELOG = [
  {
    version: ALGORITHM_VERSION,
    date: '2026-05-11',
    title: 'Opening upper-cloud carrier guard',
    summary: 'When low clouds are scarce, the sun-direction light path is open, air is clear, and mid/high clouds are both present, thick-cloud signals are softened instead of treating the scene as a fully blocked gray curtain.'
  },
  {
    version: '2026.05.10-low-cloud-lightpath-v3',
    date: '2026-05-10',
    title: 'Low-cloud-led light path',
    summary: 'Light-path scoring now treats low clouds as the main sunlight blocker. Dense mid/high clouds are handled as the color canvas unless low clouds dominate or rain is present.'
  }
];

module.exports = {
  ALGORITHM_VERSION,
  ALGORITHM_CHANGELOG
};
