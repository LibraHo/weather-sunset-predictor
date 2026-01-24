/**
 * Babel Configuration for Weather Sunset Predictor
 * 
 * This configuration enables ES6+ features for Jest testing
 */

export default {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: {
          node: 'current',
        },
      },
    ],
  ],
};
