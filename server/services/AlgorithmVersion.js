'use strict';

const ALGORITHM_VERSION = '2026.05.27-cloud-thickness-proportional-v2';

const ALGORITHM_CHANGELOG = [
  {
    version: ALGORITHM_VERSION,
    date: '2026-05-27',
    title: 'Cloud-thickness proportional penalty v2',
    summary: 'Cloud-thickness penalty is now pre-thickness canvas score × 30% × thickness pressure, with the fixed -28/24 caps removed. Humid gray-curtain cases are calibrated as weak glow/watchable but not strong.'
  },
  {
    version: '2026.05.19-additive-carrier-light-gate-v1',
    date: '2026-05-19',
    title: 'Additive carrier scoring with light-path gate',
    summary: 'Positive cloud-carrier signals now add bounded points instead of multiplying repeatedly, and existing sun-direction light-path samples act as a gate when they show cloud-wall obstruction. No extra radiation/direct-ratio gate or additional API sampling is introduced.'
  },
  {
    version: '2026.05.18-cloud-thickness-evidence-v1',
    date: '2026-05-18',
    title: 'Cloud-thickness evidence scoring',
    summary: 'Cloud thickness now uses continuous thin/thick evidence from direct light, diffuse light, water vapor, low clouds, weather code, and sun-direction openings, instead of discrete -1/-2 penalties from single signals.'
  },
  {
    version: '2026.05.13-formation-factors-v1',
    date: '2026-05-13',
    title: 'Four-factor formation analysis',
    summary: 'Formation analysis is now grouped into four stable user-facing factors: cloud carrier, light path, air rendering, and limiting factors. The scoring formula is unchanged.'
  },
  {
    version: '2026.05.12-aerosol-carrier-v1',
    date: '2026-05-12',
    title: 'Aerosol weak carrier with light-path activation',
    summary: 'When clouds are scarce, moderate aerosol can act as a weak sunset color carrier only if the sun-direction light path is open. Heavy haze and dust still suppress the score.'
  },
  {
    version: '2026.05.11-opening-upper-cloud-carrier-v1',
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
