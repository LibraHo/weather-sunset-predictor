'use strict';

const ALGORITHM_VERSION = '2026.05.10-upper-cloud-carrier-v2';

const ALGORITHM_CHANGELOG = [
  {
    version: ALGORITHM_VERSION,
    date: '2026-05-10',
    title: 'Dense upper-cloud carrier softening',
    summary: 'When high clouds and mid clouds both provide a clear color carrier, cloud-thickness signals only soften the canvas score instead of also applying a final hard cap. Haze, dust, precipitation, geometry, and true thick-curtain caps remain separate.'
  }
];

module.exports = {
  ALGORITHM_VERSION,
  ALGORITHM_CHANGELOG
};
